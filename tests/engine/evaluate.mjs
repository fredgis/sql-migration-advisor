/**
 * Executable mirror of reference/decision-rules.md for golden tests.
 *
 * This is deliberately a small, dependency-free test oracle. It is NOT the
 * production sql-migration-advisor engine: in production, Copilot reads the
 * markdown skill and reference rules. Machine-checkable constants and gates
 * are loaded from reference/decision-rules.data.json so the JavaScript mirror
 * cannot silently drift on values.
 */

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const RULES = require('../../reference/decision-rules.data.json');
// The set of methods a target can be reached by is not a property of this file: it is the section 8
// matrix, carried by advisor-coverage.json with a role that says whether a cell may be recommended.
// Reading it here is what stops the method cascade from quietly narrowing the field — a method that
// is never enumerated is never rejected either, so nothing can argue with its absence.
const COVERAGE = require('../../skills/generate-migration-prerequisite-plan/reference/advisor-coverage.json');

const TARGETS = ['sql_vm', 'avs', 'sql_mi', 'sql_db', 'fabric_sql_db', 'arc_sql_mi', 'container', 'arc_in_place'];
const TARGET_LABELS = {
  sql_vm: 'SQL Server on Azure VM',
  avs: 'Azure VMware Solution',
  sql_mi: 'Azure SQL Managed Instance',
  sql_db: 'Azure SQL Database',
  fabric_sql_db: 'SQL database in Fabric',
  arc_sql_mi: 'Arc-enabled SQL Managed Instance',
  container: 'SQL Server in a container',
  arc_in_place: 'SQL Server enabled by Azure Arc'
};
const LABEL_TO_TARGET = Object.fromEntries(Object.entries(TARGET_LABELS).map(([key, label]) => [label, key]));
const E = {
  ELIGIBLE: 'eligible',
  REMEDIATE: 'eligible_with_remediation',
  UNSUPPORTED: 'unsupported',
  // A target the customer ruled out is not a target that cannot work. Saying `unsupported` for a
  // stated preference tells a reader six months later that Arc was rejected on its merits, when
  // nothing had ever said so, and preferences change while incompatibilities do not.
  PREFERENCE: 'excluded_by_preference',
  UNKNOWN: 'unknown_requires_assessment'
};
const MI_LINK = RULES.miLink;
const ARC_FLOORS = RULES.azureArcFloors;
const SOURCE_FLOORS = RULES.sourceVersionFloors;
const ARC_WIZARD = RULES.arcPortalWizard;
const FABRIC_MIGRATION = RULES.fabricMigration;
const SQL_DB_TIERS = RULES.sqlDatabaseTiers;
const VALIDATED_EVIDENCE_KEYS = RULES.validatedEvidence.requiredBooleans;

function textOf(value) {
  if (Array.isArray(value)) return value.map(textOf).join(' | ');
  if (value && typeof value === 'object') return Object.values(value).map(textOf).join(' | ');
  return String(value ?? '');
}
function has(haystack, needle) { return textOf(haystack).toLowerCase().includes(String(needle).toLowerCase()); }
function any(inputs, ...needles) { const t = textOf(inputs).toLowerCase(); return needles.some(n => t.includes(String(n).toLowerCase())); }
function dep(inputs, needle) { return (inputs.feature_dependencies || []).some(d => has(d, needle)); }
function isBlankAnswer(value) {
  const items = Array.isArray(value) ? value : [value];
  return items.every(v => textOf(v).trim() === '');
}
function downtimeUnknown(inputs) {
  const t = textOf(inputs.downtime).trim();
  return t === '' || /not sure|unknown/i.test(t);
}
function versionNumber(v) {
  const m = textOf(v).match(/\b(?:19|20)\d{2}\b/);
  return m ? Number(m[0]) : undefined;
}
function sourceKind(inputs) { return String(inputs.source_location || '').toLowerCase(); }
function isManagedCloudSqlSource(inputs) { const s = sourceKind(inputs); return s.includes('aws rds') || s.includes('gcp cloud sql'); }
function portPattern(port) { return new RegExp(`${port}[^.;,]*(blocked|cannot|can't|closed)|(blocked|cannot|can't|closed)[^.;,]*${port}`); }
function rangePattern(range) { return new RegExp(`(${range.start}|${range.end})[^.;,]*(blocked|cannot|can't|closed)|(blocked|cannot|can't|closed)[^.;,]*(${range.start}|${range.end})`); }
function portsOpenForMiLink(inputs) {
  const ports = String(inputs.network_ports || '').toLowerCase();
  const endpoint = MI_LINK.ports.sqlServerEndpoint;
  const hadr = MI_LINK.ports.managedInstanceHadrRange;
  if (!ports || /not sure|unknown/.test(ports)) return false;
  if (portPattern(endpoint).test(ports)) return false;
  if (rangePattern(hadr).test(ports)) return false;
  return ports.includes(String(endpoint)) && (ports.includes(String(hadr.start)) || ports.includes(String(hadr.end)));
}
function portsKnownBlockedForMiLink(inputs) {
  const ports = String(inputs.network_ports || '').toLowerCase();
  return portPattern(MI_LINK.ports.sqlServerEndpoint).test(ports)
    || rangePattern(MI_LINK.ports.managedInstanceHadrRange).test(ports);
}
// MI Link needs a supported host OS and SQL Server edition, not just a supported SQL version.
// Linux hosts are supported from SQL Server 2017 onwards; SQL Server 2016 is Windows Server only.
// Windows hosts must be Windows Server 2012 or later: Microsoft states this in the link
// Limitations, because Windows 10 and 11 clients cannot enable the Always On availability group
// feature the link depends on. v1.12 removed a 2016+ floor as unsourced, which was right about
// 2016 and wrong to conclude there is no floor at all.
// Returns 'ok', 'unsupported' or 'unknown'; unknown must not be read as a pass.
function miLinkHostSupport(inputs) {
  const floors = SOURCE_FLOORS.miLink;
  const os = String(inputs.source_os || '').toLowerCase();
  const edition = String(inputs.source_edition || '').toLowerCase();
  if (!os || !edition || /not sure|unknown/.test(os) || /not sure|unknown/.test(edition)) return 'unknown';
  if (!floors.editions.some(e => edition.includes(e.toLowerCase()))) return 'unsupported';
  if (/linux/.test(os)) {
    const version = versionNumber(inputs.source_version);
    if (!version) return 'unknown';
    if (version < floors.linuxSqlServerMin) return 'unsupported';
    return 'ok';
  }
  // A Windows client OS can never host the link, whatever its version number.
  if (/windows (?:10|11)\b|\bwin\s?(?:10|11)\b|windows client/.test(os)) return 'unsupported';
  const winYear = versionNumber(os);
  // "Windows Server" with no version is not evidence of a supported version.
  if (/windows/.test(os) && !winYear) return 'unknown';
  if (winYear && winYear < floors.windowsServerMin) return 'unsupported';
  if (!/windows/.test(os)) return 'unknown';
  return 'ok';
}
function hasValidatedEvidence(inputs) {
  const evidence = inputs.evidence;
  return !!evidence
    && typeof evidence === 'object'
    && VALIDATED_EVIDENCE_KEYS.every(key => evidence[key] === true);
}
function addUnique(arr, value) { if (value && !arr.includes(value)) arr.push(value); }
function setUnknown(eligibility, keys, reason, out) {
  for (const k of keys) eligibility[k] = E.UNKNOWN;
  addUnique(out.unknowns, reason);
  addUnique(out.evidenceRequired, reason);
}
function methodAvailability(method, tier) {
  const model = RULES.methodAvailability[method]
    || (/Data Box|BACPAC|bcp|ADF|SqlPackage/.test(method) ? RULES.methodAvailability['bcp / Smart Bulk Copy / BACPAC / ADF'] : undefined);
  if (!model) return [E.UNKNOWN, E.UNKNOWN];
  if (model.businessCutoverDowntimeByTier) return [model.targetAvailabilityDuringSync, model.businessCutoverDowntimeByTier[tier] || model.businessCutoverDowntimeByTier.default];
  return [model.targetAvailabilityDuringSync, model.businessCutoverDowntime];
}
function chooseMiTier(inputs, out) {
  const p = String(inputs.performance || '').toLowerCase();
  const explicitTier = String(inputs.size || '').toLowerCase();
  if (/next-gen|next gen/.test(explicitTier) || /next-gen|next gen/.test(p)) return 'MI Next-gen General Purpose';
  if (/business critical|low-latency|low latency|high iops|log throughput|read-scale|read scale|highest ha|heavy tempdb|in-memory/.test(p)) return 'MI Business Critical';
  if (/general purpose|moderate|cost-sensitive|cost sensitive|general enterprise/.test(p)) return 'MI General Purpose';
  if (/none\/unknown|not sure|unknown/.test(p)) {
    addUnique(out.unknowns, 'MI tier-driving performance inputs');
    addUnique(out.evidenceRequired, 'Perfmon/DMV baseline, wait stats, log rate, HA/read-scale requirement');
    return E.UNKNOWN;
  }
  const dbCount = normalizedDatabaseCount(inputs);
  if (dbCount && dbCount > MI_LINK.capacityLinks.generalPurpose && !p && !explicitTier) {
    addUnique(out.unknowns, 'MI service tier for MI Link capacity');
    addUnique(out.evidenceRequired, 'select or assess the MI service tier');
    return E.UNKNOWN;
  }
  return undefined;
}
function chooseSqlDbTier(inputs, out) {
  const p = String(inputs.performance || '').toLowerCase();
  const size = String(inputs.size || '').toLowerCase();
  const tenants = String(inputs.tenant_count || '').toLowerCase();
  if (new RegExp(`>\\s*${SQL_DB_TIERS.hyperscaleSizeThresholdTb}\\s*tb|over ${SQL_DB_TIERS.hyperscaleSizeThresholdTb} tb|multi-tb|multitb`).test(size)) return 'Hyperscale';
  if (/intermittent|seasonal|idle|auto-pause|dev\/test/.test(p)) return 'Serverless';
  if (/many tenants|multi-tenant|variable demand|elastic/.test(tenants)) return 'Elastic Pool';
  if (/business critical|low-latency|low latency|high transaction log|strict sla|zone redundancy|read-scale|in-memory/.test(p)) return 'Business Critical';
  const perfStatedUnknown = /none\/unknown|not sure|unknown/.test(p);
  // The small-database signal means "under 150 GB". Unanchored it also matched the
  // "150 GB - 4 TB" range, which is not small, and it was tested before the unknown
  // branch below, so an explicit "not sure" on tier drivers still returned General
  // Purpose. Two ways to reach a tier nobody had evidence for.
  //
  // An absent performance answer is deliberately not treated as an unknown here: the
  // tier question is only asked when a tier is in play, so absence usually means the
  // interview never needed it. The engine claims no tier instead, which is silence
  // rather than a false claim.
  const smallDatabase = new RegExp(`(?:<|under|below|up to)\\s*${SQL_DB_TIERS.generalPurposeSmallDatabaseSignalGb}\\s*gb`).test(size);
  if (/general purpose|moderate|cost-sensitive|steady/.test(p) || (!perfStatedUnknown && smallDatabase)) return 'General Purpose';
  if (perfStatedUnknown || /not sure|unknown/.test(size) || /not sure|unknown/.test(tenants)) {
    addUnique(out.unknowns, 'SQL DB tier-driving size/performance/tenancy inputs');
    addUnique(out.evidenceRequired, 'Performance baseline and tenancy profile');
    return E.UNKNOWN;
  }
  return undefined;
}
function applyFabric(inputs, eligibility, out) {
  const fabricDriven = has(inputs.driver, 'analytics/Fabric') || any(inputs, 'analytics-first', 'BI/analytics-first');
  // The target is GA; only the Migration Assistant is Preview. So neither a non-analytics
  // driver nor "preview not acceptable" may mark the target unsupported — the first is a
  // ranking signal, the second only disqualifies the assistant as a method.
  out.fabricIndicated = fabricDriven;
  if (!fabricDriven) {
    eligibility.fabric_sql_db = E.ELIGIBLE;
    out.rankingNotes = out.rankingNotes || {};
    out.rankingNotes.fabric_sql_db = 'GA target, but not indicated without an analytics/Fabric driver; ranked below SQL DB/MI.';
    return;
  }
  // The database size was concatenated into the text the DACPAC gate tests, so a 4 TB database
  // triggered "DACPAC > 20 MB" even when the DACPAC was declared under the limit. They are
  // different quantities: a DACPAC holds schema, not data. Only the constraints answer and the
  // compliance context describe the assistant's gates.
  const assistantText = `${textOf(inputs.fabric_constraints)} ${textOf(inputs.compliance)}`.toLowerCase();
  const fabricText = `${assistantText} ${textOf(inputs.feature_dependencies)}`.toLowerCase();
  const mentionsGate = /dacpac|preview|gateway|private link/.test(assistantText);
  if (!mentionsGate) {
    eligibility.fabric_sql_db = E.UNKNOWN;
    addUnique(out.unknowns, 'Fabric ingestion path, then Migration Assistant gates: DACPAC size, Private Link, gateway, preview acceptance');
    addUnique(out.evidenceRequired, `Confirm an ingestion path; if it is the Migration Assistant, confirm DACPAC <= ${FABRIC_MIGRATION.maxDacpacMb} MB, no Private Link requirement, gateway acceptable, Preview acceptable`);
    return;
  }
  // "no private link required" contains "private link required" as a substring, so an
  // unanchored test reads the negation as its opposite. That misfired on three of the
  // four Fabric scenarios: they were handed a Private Link blocker they had explicitly
  // ruled out, and it masked the DACPAC and preview gates below, which never ran.
  const privateLinkRuledOut = /no private link|without private link|private link not required|private link: no/.test(fabricText);
  if (!privateLinkRuledOut && /private link required|requires private link|private link: required|private link yes/.test(fabricText)) {
    eligibility.fabric_sql_db = E.REMEDIATE;
    out.exclusions.fabric_sql_db = 'The Fabric Migration Assistant has no Private Link/VNet gateway path; the GA target itself remains available through another ingestion path.';
    return;
  }
  // The "> 4 TB" alternative belonged to the database size, not to the DACPAC. Keeping it here
  // made a large database look like an oversized DACPAC, which is a different limit entirely.
  if (new RegExp(`dacpac\\s*>\\s*${FABRIC_MIGRATION.maxDacpacMb}|>\\s*${FABRIC_MIGRATION.maxDacpacMb}\\s*mb|over ${FABRIC_MIGRATION.maxDacpacMb}\\s*mb`).test(assistantText)) {
    eligibility.fabric_sql_db = E.REMEDIATE;
    out.exclusions.fabric_sql_db = `The Fabric Migration Assistant requires DACPAC <= ${FABRIC_MIGRATION.maxDacpacMb} MB; use another ingestion path for the GA target.`;
    return;
  }
  if (/preview (not|no)|preview unacceptable|gateway (not|no)|cannot use on-prem data gateway/.test(fabricText)) {
    eligibility.fabric_sql_db = E.REMEDIATE;
    out.exclusions.fabric_sql_db = 'Preview acceptance and the on-prem data gateway are Migration Assistant gates, not target gates; select a non-assistant ingestion path.';
    return;
  }
  if (new RegExp(`dacpac\\s*(<=|≤|under|=)\\s*${FABRIC_MIGRATION.maxDacpacMb}|no private link|gateway acceptable|preview accepted`).test(fabricText)) eligibility.fabric_sql_db = E.ELIGIBLE;
  else eligibility.fabric_sql_db = E.UNKNOWN;
}
function applyFeatureEligibility(inputs, eligibility, out) {
  // A missing or empty dependency list is not evidence of absence: it is the shape an
  // unanswered multi-select produces. Reading it as "no dependencies" would silently
  // clear the MI/SQL DB blockers, so it resolves to unknown instead.
  if (isBlankAnswer(inputs.feature_dependencies)) {
    setUnknown(eligibility, ['sql_mi', 'sql_db'], 'Dependency inventory', out);
  }
  if (dep(inputs, 'FILESTREAM') || dep(inputs, 'FileTable')) {
    eligibility.sql_mi = E.UNSUPPORTED; eligibility.sql_db = E.UNSUPPORTED;
    out.exclusions.sql_mi = 'FILESTREAM/FileTable is a hard MI incompatibility.';
    out.exclusions.sql_db = 'FILESTREAM/FileTable is a hard SQL DB incompatibility.';
    // The container was grouped with the VM and AVS as eligible, but it runs SQL Server on Linux,
    // which has no FILESTREAM or FileTable at all. Offering it was offering a target that cannot
    // host the dependency the profile is built around.
    eligibility.container = E.UNSUPPORTED;
    out.exclusions.container = 'SQL Server on Linux, which the container image runs, has no FILESTREAM/FileTable.';
  }
  if (dep(inputs, 'PolyBase/cloud files')) { eligibility.sql_mi = E.ELIGIBLE; }
  if (dep(inputs, 'PolyBase/external RDBMS')) {
    eligibility.sql_mi = E.UNSUPPORTED; eligibility.sql_db = E.UNSUPPORTED;
    out.exclusions.sql_mi = 'PolyBase external RDBMS connectors are not supported on MI.';
    out.exclusions.sql_db = 'PolyBase external RDBMS connectors require refactoring for SQL DB.';
  }
  if (dep(inputs, 'PolyBase/unknown')) setUnknown(eligibility, ['sql_mi', 'sql_db'], 'PolyBase external data source type', out);
  if (dep(inputs, 'homogeneous SQL↔SQL DTC') || dep(inputs, 'homogeneous SQL-to-SQL DTC')) {
    eligibility.sql_mi = E.ELIGIBLE; eligibility.sql_db = E.UNSUPPORTED;
    out.exclusions.sql_db = 'Azure SQL Database does not support this DTC dependency.';
  }
  if (dep(inputs, 'heterogeneous DTC')) {
    eligibility.sql_mi = E.UNSUPPORTED; eligibility.sql_db = E.UNSUPPORTED;
    out.exclusions.sql_mi = 'Heterogeneous DTC to third-party RDBMS is not supported on MI.';
    out.exclusions.sql_db = 'DTC dependency is not supported on SQL DB.';
  }
  if (dep(inputs, 'DTC/unknown')) setUnknown(eligibility, ['sql_mi', 'sql_db'], 'DTC participants and linked-server map', out);
  if (dep(inputs, 'linked servers')) {
    eligibility.sql_mi = E.REMEDIATE; eligibility.sql_db = E.UNSUPPORTED;
    out.exclusions.sql_db = 'Linked servers are a hard Azure SQL Database blocker unless refactored.';
  }
  if (dep(inputs, 'SQL Agent')) { eligibility.sql_mi = E.ELIGIBLE; eligibility.sql_db = E.REMEDIATE; }
  if (dep(inputs, 'SQL CLR') || dep(inputs, 'Service Broker') || dep(inputs, 'cross-DB')) { eligibility.sql_mi = E.REMEDIATE; eligibility.sql_db = E.UNSUPPORTED; }
  if (dep(inputs, 'Not sure') || dep(inputs, 'unknown dependencies')) setUnknown(eligibility, ['sql_mi', 'sql_db'], 'Dependency inventory', out);
}
function applyManagement(inputs, eligibility, out) {
  const model = String(inputs.management_model || '').toLowerCase();
  const k8s = String(inputs.kubernetes_model || '').toLowerCase();
  const v = versionNumber(inputs.source_version);
  if (has(inputs.intent, 'assessment-only') || has(inputs.intent, 'modernize in place') || has(inputs.driver, 'modernize in place')) {
    eligibility.arc_in_place = v && v < ARC_FLOORS.overallMigrationExperience.sqlServerMin ? E.UNSUPPORTED : E.ELIGIBLE;
    if (eligibility.arc_in_place === E.UNSUPPORTED) {
      out.exclusions.arc_in_place = `Arc migration/assessment experience requires SQL Server ${ARC_FLOORS.overallMigrationExperience.sqlServerMin}+.`;
      addUnique(out.hardBlockers, `SQL Server ${v} is below the ${ARC_FLOORS.overallMigrationExperience.sqlServerMin}+ Arc experience floor`);
    }
  }
  if (/need os|file-system|file system|engine control|third-party agents/.test(model)) {
    eligibility.sql_mi = E.PREFERENCE; eligibility.sql_db = E.PREFERENCE; eligibility.sql_vm = E.ELIGIBLE;
    out.exclusions.sql_mi = 'Excluded by the stated management model, not by a technical limit: the workload needs OS or engine control. Revisit if that requirement changes.';
    out.exclusions.sql_db = 'Excluded by the stated management model, not by a technical limit.';
  }
  if (/kubernetes/.test(model)) {
    eligibility.sql_mi = E.PREFERENCE; eligibility.sql_db = E.PREFERENCE;
    out.exclusions.sql_mi = 'Excluded by the stated management model: Kubernetes on-prem, edge or multi-cloud. Not a technical limit of the target.';
    out.exclusions.sql_db = 'Excluded by the stated management model: Kubernetes on-prem, edge or multi-cloud.';
    // Both branches used to mark the losing option UNSUPPORTED, which says the target cannot be
    // done. Neither is a technical limit: the customer picked one Kubernetes engine model over the
    // other, and the choice is reversible. The lines above already draw this distinction for
    // sql_mi and sql_db; these two did not, so the engine contradicted the rule its own knowledge
    // base states -- "excluded_by_preference is not unsupported".
    // A preference must never resurrect a target a hard dependency already ruled out. Choosing a
    // DIY container is a choice between two Kubernetes engine models; it does not give SQL Server
    // on Linux a FILESTREAM implementation. This branch used to overwrite the exclusion with
    // ELIGIBLE, so a FILESTREAM profile was offered a container that cannot host it. The guard is
    // named after the incompatibility rather than testing for UNSUPPORTED, because UNSUPPORTED is
    // also the resting state of both Kubernetes targets for every profile that never asked for one.
    const filestream = dep(inputs, 'FILESTREAM') || dep(inputs, 'FileTable');
    if (/managed engine|arc data controller/.test(k8s)) {
      eligibility.arc_sql_mi = E.ELIGIBLE;
      if (!filestream) {
        eligibility.container = E.PREFERENCE;
        out.exclusions.container = 'Excluded by the stated Kubernetes engine model: a managed engine through Arc data services was chosen over a self-run container. Not a technical limit of the target.';
      }
    } else if (/diy|full diy/.test(k8s)) {
      if (!filestream) eligibility.container = E.ELIGIBLE;
      eligibility.arc_sql_mi = E.PREFERENCE;
      out.exclusions.arc_sql_mi = 'Excluded by the stated Kubernetes engine model: a full DIY container was chosen over a managed engine. Arc-enabled SQL Managed Instance remains available if that preference changes.';
    } else setUnknown(eligibility, ['arc_sql_mi', 'container'], 'Kubernetes managed-vs-DIY engine model', out);
  }
  if (has(inputs.driver, 'data-center exit') && /need os|file-system|file system|engine control/.test(model)) eligibility.avs = E.ELIGIBLE;
}
function chooseTarget(inputs, eligibility, out) {
  if (eligibility.arc_in_place === E.ELIGIBLE && (has(inputs.intent, 'assessment-only') || has(inputs.intent, 'modernize in place'))) return ['SQL Server enabled by Azure Arc', 'Arc best-practices assessment'];
  if (eligibility.arc_in_place === E.UNSUPPORTED && (has(inputs.intent, 'assessment-only') || has(inputs.intent, 'modernize in place'))) return ['SQL Server on Azure VM', 'Standalone assessment / native backup/restore'];
  if (eligibility.arc_sql_mi === E.UNKNOWN || eligibility.container === E.UNKNOWN) return ['provisional shortlist only', 'Clarify Kubernetes engine model first'];
  if (eligibility.arc_sql_mi === E.ELIGIBLE) return ['Arc-enabled SQL Managed Instance', any(inputs, 'sovereignty', 'air-gapped') ? 'Native backup/restore' : 'Native backup/restore after endpoint is available'];
  if (eligibility.container === E.ELIGIBLE && /kubernetes/i.test(String(inputs.management_model || ''))) return ['SQL Server in a container', 'Backup/restore via mounted volume'];
  if (eligibility.avs === E.ELIGIBLE && has(inputs.driver, 'data-center exit')) return ['Azure VMware Solution', 'VMware HCX / vMotion'];
  if (out.fabricIndicated && eligibility.fabric_sql_db === E.UNKNOWN) return ['provisional shortlist only', 'Confirm a Fabric ingestion path first; Migration Assistant Preview gates apply only if that path is chosen'];
  if (out.fabricIndicated && eligibility.fabric_sql_db === E.ELIGIBLE) return ['SQL database in Fabric', 'Fabric Migration Assistant'];
  if (eligibility.sql_mi === E.UNKNOWN || eligibility.sql_db === E.UNKNOWN) return ['provisional shortlist only', 'Assessment and dependency discovery first'];
  if (eligibility.sql_mi === E.UNSUPPORTED && eligibility.sql_db === E.UNSUPPORTED) return ['SQL Server on Azure VM', chooseVmMethod(inputs)];
  if (eligibility.sql_vm === E.ELIGIBLE && (eligibility.sql_mi === E.UNSUPPORTED || eligibility.sql_db === E.UNSUPPORTED) && has(inputs.management_model, 'need OS')) return ['SQL Server on Azure VM', chooseVmMethod(inputs)];
  if (any(inputs.network_ports, 'limited WAN') && any(inputs.size, `> ${SQL_DB_TIERS.hyperscaleSizeThresholdTb} TB`, 'multi-TB', 'multitb')) return ['Azure SQL Database', 'Data Box seed → sync delta'];
  if (any(inputs.size, 'estate scale', 'business case', 'dependency map')) return ['provisional shortlist only', 'Azure Migrate appliance/import/Arc discovery'];
  if (dep(inputs, 'TDE')) return ['Azure SQL Managed Instance', 'Native backup/restore'];
  // Diverting to SQL DB because MI Link is blocked and LRS is out of range only made sense while
  // DMS was unreachable for Managed Instance. It is not a reason to leave the target family when
  // the profile carries an instance-scoped dependency that SQL DB cannot host.
  if ((has(inputs.downtime, 'near-zero') || has(inputs.downtime, 'minimal'))
    && lrsSourceUnsupported(inputs)
    && !portsOpenForMiLink(inputs)
    && !dep(inputs, 'SQL Agent') && !dep(inputs, 'linked servers') && !dep(inputs, 'PolyBase/cloud files')
    && !dep(inputs, 'SQL CLR') && !dep(inputs, 'Service Broker') && !dep(inputs, 'cross-DB')
    && eligibility.sql_db !== E.UNSUPPORTED) return ['Azure SQL Database', chooseSqlDbMethod(inputs)];
  if (dep(inputs, 'SQL Agent') || dep(inputs, 'linked servers') || dep(inputs, 'homogeneous') || dep(inputs, 'PolyBase/cloud files') || dep(inputs, 'SQL CLR') || dep(inputs, 'Service Broker') || dep(inputs, 'cross-DB')) return ['Azure SQL Managed Instance', chooseMiMethod(inputs, out)];
  if (isManagedCloudSqlSource(inputs) && has(inputs.downtime, 'near-zero')) return ['Azure SQL Managed Instance', chooseMiMethod(inputs, out)];
  if (has(inputs.source_version, String(SOURCE_FLOORS.standaloneLrs.sqlServerMin))) return ['Azure SQL Managed Instance', chooseMiMethod(inputs, out)];
  if ((has(inputs.downtime, 'near-zero') || has(inputs.downtime, 'minimal')) && versionNumber(inputs.source_version) < SOURCE_FLOORS.transactionalReplicationToSqlDb.publisherSqlServerMin) return ['Azure SQL Managed Instance', chooseMiMethod(inputs, out)];
  if ((has(inputs.downtime, 'near-zero') || has(inputs.downtime, 'minimal')) && portsKnownBlockedForMiLink(inputs) && !lrsSourceUnsupported(inputs)) return ['Azure SQL Managed Instance', chooseMiMethod(inputs, out)];
  if (has(inputs.driver, 'app modernization') || !out.fabricIndicated || eligibility.fabric_sql_db === E.REMEDIATE || any(inputs.size, `> ${SQL_DB_TIERS.hyperscaleSizeThresholdTb} TB`, `${SQL_DB_TIERS.generalPurposeSmallDatabaseSignalGb} GB`) || any(inputs.performance, 'intermittent', 'strict SLA', 'transaction log') || any(inputs.tenant_count, 'many tenants')) return ['Azure SQL Database', chooseSqlDbMethod(inputs)];
  if (has(inputs.downtime, 'near-zero') || has(inputs.downtime, 'minimal')) return ['Azure SQL Managed Instance', chooseMiMethod(inputs, out)];
  return ['Azure SQL Database', chooseSqlDbMethod(inputs)];
}
function chooseVmMethod(inputs) {
  const v = versionNumber(inputs.source_version);
  const agFloor = SOURCE_FLOORS.alwaysOnAvailabilityGroupToVm.sqlServerMin;
  const linuxSource = /linux/i.test(String(inputs.source_os || ''));
  // Selecting a method the source cannot run, then rejecting it at the gate, produces a
  // provisional shortlist where a working answer existed. The floor belongs here too.
  if (has(inputs.downtime, 'near-zero') && (!v || v >= agFloor) && !linuxSource) return 'Distributed AG or Always On AG';
  // Log shipping is Windows-only, and availability groups need the version floor. When the source
  // meets neither, DMS is the documented online path to a SQL VM rather than a longer outage.
  if (has(inputs.downtime, 'minimal') || has(inputs.downtime, 'near-zero')) {
    if (linuxSource || (v && v < agFloor)) return 'Azure DMS (online)';
    return 'Log shipping';
  }
  return 'Native backup/restore';
}
function chooseSqlDbMethod(inputs) {
  if (has(inputs.downtime, 'minimal') || has(inputs.downtime, 'near-zero')) return 'Transactional replication';
  if (any(inputs.size, `< ${SQL_DB_TIERS.generalPurposeSmallDatabaseSignalGb} GB`, 'small')) return 'BACPAC/SqlPackage';
  return 'modern DMS (offline)';
}
function miLinkCapacityForTier(tier) {
  if (/next-gen|next gen/i.test(String(tier || ''))) return MI_LINK.capacityLinks.nextGenGeneralPurpose;
  if (/business critical/i.test(String(tier || ''))) return MI_LINK.capacityLinks.businessCritical;
  if (/general purpose/i.test(String(tier || ''))) return MI_LINK.capacityLinks.generalPurpose;
  return undefined;
}
function normalizedDatabaseCount(inputs) {
  const count = Number(inputs.database_count);
  return Number.isFinite(count) && count > 0 ? count : undefined;
}
function versionAtLeast(actual, required) {
  const a = String(actual || '').split('.').map(Number);
  const r = String(required || '').split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, r.length); i += 1) {
    const av = Number.isFinite(a[i]) ? a[i] : 0;
    const rv = Number.isFinite(r[i]) ? r[i] : 0;
    if (av !== rv) return av > rv;
  }
  return true;
}
function lrsRangeMessage(v) {
  const s = SOURCE_FLOORS.standaloneLrs;
  const arc = ARC_FLOORS.lrsToManagedInstanceConservative;
  if (v > s.sqlServerMax && v <= arc.sqlServerMax) {
    return `Standalone LRS is documented for SQL Server ${s.sqlServerMin}-${s.sqlServerMax}, but Arc-orchestrated LRS lists SQL Server up to ${arc.sqlServerMax}. On SQL Server ${v} the route exists only through the Azure Arc portal; confirm the control plane before ruling LRS out.`;
  }
  return `Standalone LRS supports SQL Server ${s.sqlServerMin}-${s.sqlServerMax}.`;
}
function lrsSourceUnsupported(inputs) {
  const v = versionNumber(inputs.source_version);
  return !!v && (v < SOURCE_FLOORS.standaloneLrs.sqlServerMin || v > SOURCE_FLOORS.standaloneLrs.sqlServerMax);
}
function applyArcWizardBatchLimit(inputs, out) {
  const selected = Number(inputs.migration_batch_size);
  if (!Number.isFinite(selected) || selected <= 0) return;
  const extension = inputs.arc_extension_version;
  if (!extension && selected > ARC_WIZARD.batchLimitBeforeExtension) {
    out.arcWizardBatchEligibility = E.UNKNOWN;
    addUnique(out.unknowns, 'Azure Extension for SQL Server version for Arc portal wizard batch limit');
    addUnique(out.evidenceRequired, 'verify Azure Extension for SQL Server version');
    return;
  }
  const limit = versionAtLeast(extension, ARC_WIZARD.extensionMinVersionForBatchLimit)
    ? ARC_WIZARD.batchLimitAtOrAboveExtension
    : ARC_WIZARD.batchLimitBeforeExtension;
  if (selected > limit) out.exclusions.arc_wizard_batch = `Arc portal wizard batch limit ${limit} databases exceeded by ${selected} selected databases.`;
}
function chooseMiMethod(inputs, out) {
  const v = versionNumber(inputs.source_version);
  const targetTier = chooseMiTier(inputs, { unknowns: [], evidenceRequired: [] });
  const dbCount = normalizedDatabaseCount(inputs);
  const cap = miLinkCapacityForTier(targetTier);
  if (dbCount && !cap && dbCount > MI_LINK.capacityLinks.generalPurpose) {
    out.capacityEligibility = E.UNKNOWN;
    addUnique(out.unknowns, 'MI Link capacity depends on selected MI service tier');
    addUnique(out.evidenceRequired, 'select or assess the MI service tier');
  } else if (dbCount && cap && dbCount > cap) {
    out.exclusions.mi_link = `MI Link capacity ${cap} links exceeded by ${dbCount} databases.`;
  }
  applyArcWizardBatchLimit(inputs, out);
  if (has(inputs.downtime, 'near-zero') || has(inputs.downtime, 'minimal')) {
    if (!isManagedCloudSqlSource(inputs) && v >= SOURCE_FLOORS.miLink.sqlServerMin && miLinkHostSupport(inputs) !== 'unsupported' && portsOpenForMiLink(inputs) && (!dbCount || (cap && dbCount <= cap) || (!cap && dbCount <= MI_LINK.capacityLinks.generalPurpose) || out.capacityEligibility === E.UNKNOWN)) return 'MI Link';
    // B3: DMS online is the path that survives when MI Link is unavailable and LRS does not
    // qualify. Returning LRS unconditionally here is what made DMS unreachable for this target
    // while the matrix declared it supported and P23/P24 documented its prerequisites.
    if (lrsSourceUnsupported(inputs)) return 'Azure DMS (online)';
    return 'LRS';
  }
  // An offline window is what native backup/restore is for: the simplest path, the fewest moving
  // parts, and the one a real session picked when it was offered. LRS exists to shorten a cutover
  // that cannot be long, so returning it here contradicted the rules and surprised the reader.
  if (has(inputs.downtime, 'offline')) return 'Native backup/restore';
  return 'LRS';
}
function applyMethodGates(inputs, target, method, eligibility, out) {
  const v = versionNumber(inputs.source_version);
  if (target === 'Azure SQL Managed Instance') {
    if (method !== 'MI Link') {
      if (isManagedCloudSqlSource(inputs)) out.exclusions.mi_link = 'MI Link is impossible from AWS RDS/GCP Cloud SQL because sysadmin/AG endpoints are unavailable.';
      else if (v && v < SOURCE_FLOORS.miLink.sqlServerMin) out.exclusions.mi_link = `MI Link requires SQL Server ${SOURCE_FLOORS.miLink.sqlServerMin}+.`;
      else if (portsKnownBlockedForMiLink(inputs)) {
        const p = MI_LINK.ports;
        out.exclusions.mi_link = `MI Link requires ${p.sqlServerEndpoint} and ${p.managedInstanceHadrRange.start}-${p.managedInstanceHadrRange.end} in the documented directions.`;
      }
    }
    // Invariant 7: a method limitation eliminates the method, never the target. Marking the whole
    // Managed Instance family unsupported because standalone LRS stops at 2022 sent SQL Server 2025
    // to a VM while DMS, MI Link and native restore were all still available for MI.
    if (method === 'LRS' && v && (v < SOURCE_FLOORS.standaloneLrs.sqlServerMin || v > SOURCE_FLOORS.standaloneLrs.sqlServerMax)) {
      addMethodExclusion('Azure SQL Managed Instance', lrsRangeMessage(v), out);
      out.exclusions.lrs = lrsRangeMessage(v);
    }
  }
}
function miLinkKnownCapacityExceeded(inputs, out = {}) {
  const dbCount = normalizedDatabaseCount(inputs);
  if (!dbCount) return false;
  const tier = out.tier || chooseMiTier(inputs, { unknowns: [], evidenceRequired: [] });
  const cap = miLinkCapacityForTier(tier);
  return !!cap && dbCount > cap;
}
// The gate below used to be a whitelist narrower than the matrix, so a method the knowledge base
// supports was answered with "is not a supported method" — a statement about this file, not about
// Azure. Method labels vary between the rules prose and the engine, so they are normalised once and
// judged against the set the matrix actually declares for the target.
const METHOD_ALIASES = [
  [/backup\/restore via mounted volume/i, 'container-restore'],
  [/mi link/i, 'mi-link'],
  [/^lrs$|log replay/i, 'lrs'],
  [/\bdms\b/i, 'dms'],
  [/data box/i, 'databox'],
  [/native backup\/restore|standalone assessment/i, 'native-restore'],
  [/always on|distributed ag/i, 'ag'],
  [/log shipping/i, 'log-shipping'],
  [/hcx|vmotion/i, 'hcx'],
  [/transactional replication/i, 'repl'],
  [/bacpac/i, 'bacpac'],
  [/fabric migration assistant/i, 'fabric-assistant'],
  [/arc best-practices assessment/i, 'arc-assessment'],
];
function canonicalMethod(method) {
  const text = String(method || '');
  for (const [pattern, key] of METHOD_ALIASES) if (pattern.test(text)) return key;
  return text;
}
const ACCEPTED_METHODS = {
  'Azure SQL Managed Instance': ['mi-link', 'lrs', 'dms', 'native-restore', 'repl', 'bacpac'],
  'Azure SQL Database': ['dms', 'repl', 'bacpac', 'databox'],
  'SQL Server on Azure VM': ['ag', 'log-shipping', 'native-restore', 'dms', 'repl', 'bacpac'],
  'Azure VMware Solution': ['hcx', 'native-restore', 'ag', 'log-shipping', 'repl', 'bacpac'],
  'SQL database in Fabric': ['fabric-assistant', 'repl', 'bacpac'],
  'Arc-enabled SQL Managed Instance': ['native-restore', 'repl', 'bacpac'],
  'SQL Server in a container': ['container-restore', 'native-restore', 'repl', 'bacpac'],
  'SQL Server enabled by Azure Arc': ['arc-assessment'],
};
const UNSUPPORTED_METHOD_MESSAGE = {
  'Azure SQL Managed Instance': (m) => `${m} is not a supported Azure SQL Managed Instance migration method in this rules mirror.`,
  'Azure SQL Database': (m) => `${m} is not a supported Azure SQL Database migration method in this rules mirror.`,
  'SQL Server on Azure VM': (m) => `${m} is not a SQL VM migration method.`,
  'Azure VMware Solution': (m) => `${m} is not an AVS migration method.`,
  'SQL database in Fabric': (m) => `${m} is not a Fabric SQL database migration method.`,
  'Arc-enabled SQL Managed Instance': (m) => `${m} is not an Arc-enabled SQL MI migration method.`,
  'SQL Server in a container': (m) => `${m} is not a SQL Server container migration method.`,
  'SQL Server enabled by Azure Arc': (m) => `${m} is not an Arc assessment method.`,
};
function replicationPublisherFailure(inputs) {
  if (isManagedCloudSqlSource(inputs)) return 'Transactional replication requires source rights unavailable on managed cloud SQL sources.';
  return null;
}
function agFloorFailure(inputs) {
  const v = versionNumber(inputs.source_version);
  if (v && v < SOURCE_FLOORS.alwaysOnAvailabilityGroupToVm.sqlServerMin) {
    return `Always On availability groups require SQL Server ${SOURCE_FLOORS.alwaysOnAvailabilityGroupToVm.sqlServerMin}+, and distributed availability groups require SQL Server ${SOURCE_FLOORS.distributedAvailabilityGroupToVm.sqlServerMin}+.`;
  }
  return null;
}
function methodGateFailure(inputs, target, method, out = {}) {
  const v = versionNumber(inputs.source_version);
  const kind = canonicalMethod(method);
  if (ACCEPTED_METHODS[target] && !ACCEPTED_METHODS[target].includes(kind)) return (UNSUPPORTED_METHOD_MESSAGE[target] || ((m) => `${m} is not a documented migration method for ${target}.`))(method);
  if (target === 'Azure SQL Managed Instance') {
    if (kind === 'mi-link') {
      if (isManagedCloudSqlSource(inputs)) return 'MI Link is impossible from AWS RDS/GCP Cloud SQL because sysadmin/AG endpoints are unavailable.';
      if (v && v < SOURCE_FLOORS.miLink.sqlServerMin) return `MI Link requires SQL Server ${SOURCE_FLOORS.miLink.sqlServerMin}+.`;
      // Fail closed. Testing only for 'unsupported' let 'unknown' through, so a source whose OS
      // and edition nobody had stated was handed the one method that depends on them most. An
      // unverified prerequisite is not a satisfied prerequisite.
      const host = miLinkHostSupport(inputs);
      if (host === 'unsupported') return `MI Link requires ${SOURCE_FLOORS.miLink.editions.join(', ')} edition, a Windows Server ${SOURCE_FLOORS.miLink.windowsServerMin} or later host, and on Linux hosts SQL Server ${SOURCE_FLOORS.miLink.linuxSqlServerMin}+.`;
      if (host === 'unknown') return `MI Link prerequisites are unverified: confirm the source edition (${SOURCE_FLOORS.miLink.editions.join(', ')}) and the host OS, which must be Windows Server ${SOURCE_FLOORS.miLink.windowsServerMin} or later, or Linux with SQL Server ${SOURCE_FLOORS.miLink.linuxSqlServerMin}+.`;
      if (!portsOpenForMiLink(inputs)) {
        const p = MI_LINK.ports;
        return `MI Link requires ${p.sqlServerEndpoint} and ${p.managedInstanceHadrRange.start}-${p.managedInstanceHadrRange.end} in the documented directions.`;
      }
      if (miLinkKnownCapacityExceeded(inputs, out)) return out.exclusions?.mi_link || 'MI Link database capacity is exceeded.';
      return null;
    }
    if (kind === 'lrs') {
      if (v && (v < SOURCE_FLOORS.standaloneLrs.sqlServerMin || v > SOURCE_FLOORS.standaloneLrs.sqlServerMax)) {
        return lrsRangeMessage(v);
      }
      return null;
    }
    if (kind === 'native-restore') return null;
    if (kind === 'repl') return replicationPublisherFailure(inputs);
    if (kind === 'dms' || kind === 'bacpac') return null;
    return `${method} is not a supported Azure SQL Managed Instance migration method in this rules mirror.`;
  }
  if (target === 'Azure SQL Database') {
    if (kind === 'repl') {
      if (isManagedCloudSqlSource(inputs)) return 'Transactional replication requires source rights unavailable on managed cloud SQL sources.';
      if (v && v < SOURCE_FLOORS.transactionalReplicationToSqlDb.publisherSqlServerMin) return `Transactional replication publisher requires SQL Server ${SOURCE_FLOORS.transactionalReplicationToSqlDb.publisherSqlServerMin}+.`;
      return null;
    }
    if (method === 'BACPAC/SqlPackage' || method === 'modern DMS (offline)' || method === 'Data Box seed → sync delta') return null;
    if (kind === 'bacpac' || kind === 'dms' || kind === 'databox') return null;
    return `${method} is not a supported Azure SQL Database migration method in this rules mirror.`;
  }
  if (target === 'SQL Server on Azure VM') {
    if (!ACCEPTED_METHODS[target].includes(kind)) return `${method} is not a SQL VM migration method.`;
    if (kind === 'repl') return replicationPublisherFailure(inputs);
    // The floors existed in the rules data and were never applied, so SQL Server 2008 with a
    // near-zero tolerance was handed "Distributed AG or Always On AG": Always On needs 2012+ and
    // distributed AGs need 2016+. A method a source cannot run is worse than a slower one.
    if (kind === 'ag' && v && v < SOURCE_FLOORS.alwaysOnAvailabilityGroupToVm.sqlServerMin) {
      return `Always On availability groups require SQL Server ${SOURCE_FLOORS.alwaysOnAvailabilityGroupToVm.sqlServerMin}+, and distributed availability groups require SQL Server ${SOURCE_FLOORS.distributedAvailabilityGroupToVm.sqlServerMin}+.`;
    }
    return null;
  }
  if (target === 'Azure VMware Solution') return kind === 'ag' ? agFloorFailure(inputs) : kind === 'repl' ? replicationPublisherFailure(inputs) : null;
  if (target === 'SQL database in Fabric') return kind === 'repl' ? replicationPublisherFailure(inputs) : null;
  if (target === 'Arc-enabled SQL Managed Instance') return kind === 'repl' ? replicationPublisherFailure(inputs) : null;
  if (target === 'SQL Server in a container') return kind === 'repl' ? replicationPublisherFailure(inputs) : null;
  if (target === 'SQL Server enabled by Azure Arc') return method === 'Arc best-practices assessment' ? null : `${method} is not an Arc assessment method.`;
  return null;
}
// Every method the matrix declares for the chosen target is enumerated and judged, and the list is
// returned whether or not it wins. A recommendation is a ranking, not a revelation: the reader is
// entitled to see what else qualified, and to hand any qualifying candidate to the prerequisite
// skill instead of the one this engine ranked first.
const COVERAGE_TARGET_LABELS = {
  'SQL VM': 'SQL Server on Azure VM',
  'AVS': 'Azure VMware Solution',
  'SQL MI': 'Azure SQL Managed Instance',
  'SQL DB': 'Azure SQL Database',
  'Fabric SQL DB': 'SQL database in Fabric',
  'Arc SQL MI': 'Arc-enabled SQL Managed Instance',
  'SQL container': 'SQL Server in a container',
};
function buildMethodCandidates(inputs, eligibility, out) {
  out.methodCandidates = [];
  const target = out.primaryTarget;
  if (!target || target === 'provisional shortlist only') return;
  const cells = COVERAGE.dispositions.filter(
    (cell) => COVERAGE_TARGET_LABELS[cell.target] === target
      && (cell.advisorRole === 'primary' || cell.advisorRole === 'secondary')
      && cell.status !== 'out-of-scope'
  );
  const selectedKind = canonicalMethod(out.method);
  const seen = new Set();
  for (const cell of cells) {
    const kind = canonicalMethod(cell.method);
    if (seen.has(kind)) continue;
    seen.add(kind);
    const failure = methodGateFailure(inputs, target, cell.method, out);
    out.methodCandidates.push({
      method: cell.method,
      role: cell.advisorRole,
      status: failure ? 'unavailable' : 'available',
      selected: kind === selectedKind,
      reason: failure || `Prerequisite paths ${(cell.paths || []).join(', ') || 'documented in the prerequisite catalog'} apply.`,
      prerequisitePaths: cell.paths || [],
    });
  }
  // The winner is always in the list, even when it is a target-specific label the matrix words
  // differently, so the reader never sees a recommendation that is absent from its own shortlist.
  // Audit 9: an empty path array here satisfied the invariant while hiding a missing mapping, so
  // the routes the matrix words differently are named rather than papered over. An assessment is
  // not a migration and correctly has no prerequisite path.
  const OFF_MATRIX_PATHS = {
    'Backup/restore via mounted volume': ['P19'],
    'Data Box seed → sync delta': ['P14'],
    'Arc best-practices assessment': [],
    'Standalone assessment / native backup/restore': ['P05'],
    'Native backup/restore after endpoint is available': ['P17', 'P18'],
  };
  if (out.method && !out.methodCandidates.some((c) => c.selected)) {
    const mapped = OFF_MATRIX_PATHS[out.method];
    out.methodCandidates.unshift({
      method: out.method,
      role: 'primary',
      status: 'available',
      selected: true,
      reason: 'Selected by the target-specific rules in decision-rules.md B3.',
      prerequisitePaths: mapped || [],
    });
    if (!mapped) out.unmappedWinner = out.method;
  }

  const winner = out.methodCandidates.find((c) => c.selected);
  out.controlPlane = chooseControlPlane(inputs, target, out.method);
  out.appliedOverlays = overlaysFor(target, winner);
  // The method path and its overlays are two different things, and naming them separately is what
  // lets a reader apply both instead of choosing between them.
  out.selectedMethodPath = winner ? (winner.prerequisitePaths || []).filter((p) => !out.appliedOverlays.some((o) => o.id === p)) : [];
}
// Which control plane runs the migration is not cosmetic: it decides which support matrix applies
// (standalone LRS is documented for SQL Server 2008-2022 while the Arc route lists 2025) and which
// prerequisites travel with the recommendation. It was printed on the card and dropped from the
// JSON, so an Arc-orchestrated restore was indistinguishable from a standalone one downstream.
function chooseControlPlane(inputs, target, method) {
  const kind = canonicalMethod(method);
  if (kind === 'hcx') return 'vmware-hcx';
  if (kind === 'fabric-assistant') return 'fabric';
  if (kind === 'dms') return 'azure-dms';
  if (kind === 'arc-assessment') return 'azure-arc';
  if (/arc/i.test(String(inputs.management_model || '')) || has(inputs.intent, 'modernize in place')) return 'azure-arc';
  if (target === 'Arc-enabled SQL Managed Instance') return 'azure-arc';
  if (any(inputs.size, 'estate scale', 'business case', 'dependency map')) return 'azure-migrate';
  return 'standalone';
}
// An AVS-hosted SQL Server needs the method path and the platform overlay together. Returning one
// path forced a reader to drop the other: P27 alone describes a platform nobody migrates to, and
// the method path alone describes a generic SQL Server rather than AVS.
function overlaysFor(target, candidate) {
  const overlays = [];
  const paths = candidate?.prerequisitePaths || [];
  if (target === 'Azure VMware Solution' && paths.includes('P27')) {
    overlays.push({ id: 'P27', title: 'Hosted SQL Server platform overlay', role: 'platform', why: 'The target is a SQL Server hosted on Azure VMware Solution, so the platform carries prerequisites the method path does not.' });
  }
  return overlays;
}
function viableTargetKeyForLabel(label, eligibility) {  const key = LABEL_TO_TARGET[label];
  return key && [E.ELIGIBLE, E.REMEDIATE].includes(eligibility[key]) ? key : undefined;
}
function addMethodExclusion(target, reason, out) {
  const key = LABEL_TO_TARGET[target] || target;
  if (key) out.exclusions[`${key}_method`] = reason;
}
function chooseConsistentFallback(inputs, eligibility, out) {
  const candidates = [
    ['sql_vm', TARGET_LABELS.sql_vm, chooseVmMethod(inputs)],
    ['sql_db', TARGET_LABELS.sql_db, chooseSqlDbMethod(inputs)],
    ['sql_mi', TARGET_LABELS.sql_mi, chooseMiMethod(inputs, out)]
  ];
  for (const [key, label, method] of candidates) {
    if (![E.ELIGIBLE, E.REMEDIATE].includes(eligibility[key])) continue;
    const reason = methodGateFailure(inputs, label, method, out);
    if (!reason) return [label, method];
    addMethodExclusion(label, reason, out);
  }
  addUnique(out.evidenceRequired, 'Run Azure Migrate / Arc assessment and dependency discovery to validate any provisional candidate.');
  return ['provisional shortlist only', 'Assessment and dependency discovery first'];
}
function enforceOutputConsistency(inputs, eligibility, out) {
  if (out.primaryTarget === 'provisional shortlist only') return;
  const key = viableTargetKeyForLabel(out.primaryTarget, eligibility);
  const methodFailure = methodGateFailure(inputs, out.primaryTarget, out.method, out);
  if (key && !methodFailure) return;
  if (!key) addMethodExclusion(out.primaryTarget, `Target eligibility is ${eligibility[LABEL_TO_TARGET[out.primaryTarget]] || 'not in eligibility map'}.`, out);
  if (methodFailure) addMethodExclusion(out.primaryTarget, methodFailure, out);
  const [fallbackTarget, fallbackMethod] = chooseConsistentFallback(inputs, eligibility, out);
  out.primaryTarget = fallbackTarget;
  out.primary_target = fallbackTarget;
  out.method = fallbackMethod;
  delete out.alternativeTarget;
}
function applyBackupBlobPath(inputs, out) {
  // BACKUP-BLOB-PATH. A session reported this gate as `passed` with the upload path never
  // verified, which is how a cutover date gets fixed against an assumption. LRS belongs here:
  // it replays full and log backups staged in a Blob container, so it depends on the same
  // upload path as a native restore.
  //
  // Data Box used to sit in this list. A weekly review caught it: Data Box is the offline
  // transport that exists precisely because the network path is blocked or too slow, so gating
  // it on Blob reachability refused the one method that survives a blocked path. Detach/attach
  // and a file-level copy move a file without HTTPS to Blob for the same reason.
  const method = String(out.method ?? '');
  const blobFree = /data box|detach|attach|file copy|file share/i.test(method);
  const blobBound = /backup\/restore|backup and restore|bacpac|\bLRS\b|log replay/i.test(method);
  if (blobFree || !blobBound) {
    out.methodGateStatus = out.methodGateStatus ?? 'passed';
    return;
  }
  const blob = String(inputs.blob_https_reachability ?? '');
  if (/confirmed/i.test(blob)) {
    out.methodGateStatus = out.methodGateStatus ?? 'passed';
    return;
  }
  if (/blocked/i.test(blob)) {
    // A target with its own file system does not need Blob at all. The knowledge base documents
    // "backup to a file (.bak) + copy" as its own route into a SQL Server on Azure VM, so refusing
    // the whole method eliminated a migration Microsoft documents, on a criterion that does not
    // apply to it: a profile that requires a VM lost its recommendation and collapsed to a
    // shortlist. The rule text said "every variant moves through HTTPS to Azure Blob", which is
    // true for Managed Instance -- it restores only FROM URL -- and false for a VM, AVS or a
    // container.
    //
    // The escape is narrow on purpose. It fires only when the profile actually wants a target with
    // a file system: offering a VM to someone who asked for managed PaaS would answer a question
    // they did not ask. And it does not report `passed`, because the file-transfer route is no more
    // verified than the Blob one was -- it moves the evidence, it does not remove it.
    const wantsFileSystem = !/managed[_ ]?paas/i.test(String(inputs.management_model ?? ''));
    const fileSystemTarget = /azure vm|vmware|avs|container/i.test(String(out.primaryTarget ?? ''));
    if (wantsFileSystem && fileSystemTarget) {
      out.methodGateStatus = 'unknown_requires_assessment';
      addUnique(out.unknowns, 'BACKUP-BLOB-PATH: HTTPS to Azure Blob is blocked, so the Blob-staged variant is out. This target has a file system, so a local backup copied into it remains available once the transfer route is proven.');
      addUnique(out.evidenceRequired, 'Prove a file-transfer route into the target and measure it end to end for the largest database, then rehearse a restore from the copied file.');
      return;
    }
    addUnique(out.hardBlockers, 'BACKUP-BLOB-PATH: HTTPS to Azure Blob is blocked, so this backup-based path cannot carry the data. Open the path, or select a method that does not traverse Blob: Data Box, detach/attach or a file-level copy into a target that has a file system.');
    out.methodGateStatus = 'refused';
  } else {
    // The third state is the whole point. Without it the only way to describe an unverified
    // prerequisite is `passed` or `refused`, and a reader forced to choose picks `passed`.
    out.methodGateStatus = 'unknown_requires_assessment';
  }
  addUnique(out.unknowns, 'BACKUP-BLOB-PATH: the HTTPS upload path to Azure Blob is not verified, so this method gate cannot report passed.');
  addUnique(out.evidenceRequired, 'Upload a representative backup to Azure Blob and restore it into the target before fixing a cutover date.');
}
function applyClrPermission(inputs, out, eligibility) {
  // CLR-PERMISSION. SAFE is not a clearance. Under `clr strict security`, on by default since
  // SQL Server 2017, the engine treats SAFE and EXTERNAL_ACCESS assemblies as UNSAFE unless they
  // are signed or hash-trusted, so the permission set alone settles nothing.
  const deps = [].concat(inputs.feature_dependencies ?? []).join(' ');
  if (!/\bCLR\b/i.test(deps)) return;
  const set = String(inputs.clr_permission_set ?? '');
  if (/UNSAFE/i.test(set)) {
    eligibility.sql_mi = E.UNKNOWN;
    addUnique(out.unknowns, 'CLR-PERMISSION: UNSAFE assemblies may call unmanaged code and reach the host, which managed PaaS does not expose.');
    addUnique(out.evidenceRequired, 'Inventory every UNSAFE assembly with its external file, network and native-library calls before ranking a PaaS target.');
    return;
  }
  if (/SAFE|EXTERNAL_ACCESS/i.test(set)) {
    addUnique(out.evidenceRequired, 'CLR-PERMISSION: sign each assembly, or trust its hash, because clr strict security treats SAFE and EXTERNAL_ACCESS as UNSAFE. A permission set is not a compatibility result.');
    return;
  }
  eligibility.sql_mi = E.UNKNOWN;
  addUnique(out.unknowns, 'CLR-PERMISSION: the assembly permission sets were never stated, and an unstated permission set is not SAFE.');
  addUnique(out.evidenceRequired, 'Produce an assembly inventory with permission sets, signatures and external calls.');
}
function finalizeStatus(inputs, out, eligibility) {
  applyBackupBlobPath(inputs, out);
  const hasUnknown = Object.values(eligibility).includes(E.UNKNOWN) || out.unknowns.length > 0 || out.tier === E.UNKNOWN;
  // No validated status. Four self-declared booleans used to promote a recommendation to
  // validated/high while the skill reads no artefact, which turned an unverified claim into an
  // assurance. Those booleans are now recorded as claims to verify elsewhere.
  out.recommendationStatus = 'provisional';
  out.confidence = hasUnknown ? 'low' : 'medium';
  if (hasValidatedEvidence(inputs)) {
    out.evidenceClaimed = true;
    addUnique(out.evidenceRequired, 'Attach the assessment artefacts to the architect sign-off: type, URI or hash, tool and version, date, target region and approver. This skill records the claim, it does not verify it.');
  }
}

// Stable option IDs, as declared in SKILL.md. The interview shows a human label and records an
// ID; the rules match on IDs. Before this existed, the mirror recognised its own dialect
// ("assessment-only", "analytics/Fabric") while the interview displayed "Assessment only" and
// "Analytics / Fabric unification", so the suite stayed green on vocabulary no user ever sends.
// Each ID expands to the phrasing the rules already understand, and the displayed label maps to
// the same ID, so both spellings now reach the same rule.
const OPTION_IDS = {
  SINGLE_DB: 'single database',
  FEW_DATABASES: 'a few databases (2-10)',
  LARGE_ESTATE: 'large estate / estate scale / business case / dependency map',
  ON_PREM: 'on-prem / Azure VM',
  // AZURE_VM was folded into ON_PREM behind a shared label. It is its own value now, because rules
  // turn on whether the source already runs in Azure, but it still maps onto the same phrase so an
  // answer given either way reaches the same rules.
  AZURE_VM: 'Azure VM',
  AWS_EC2: 'AWS EC2',
  AWS_RDS: 'AWS RDS for SQL Server',
  GCP_COMPUTE: 'GCP Compute Engine',
  GCP_CLOUD_SQL: 'GCP Cloud SQL for SQL Server',
  SQL2008: '2008/2008 R2',
  SQL2012: '2012',
  SQL2014: '2014',
  SQL2016: '2016',
  SQL2017_2019: '2017/2019',
  SQL2022: '2022',
  SQL2025: '2025',
  MIGRATE_NOW: 'migrate now',
  MODERNIZE_IN_PLACE: 'modernize in place / not ready',
  ASSESSMENT_ONLY: 'assessment-only',
  REHOST_FIRST: 'rehost first, modernize later',
  EOS_ESU: 'end-of-support/ESU',
  COST: 'cost',
  APP_MODERNIZATION: 'app modernization',
  DATACENTER_EXIT: 'data-center exit',
  FABRIC_ANALYTICS: 'analytics/Fabric',
  SOVEREIGNTY_EDGE: 'sovereignty/edge',
  MANAGED_PAAS: 'fully managed PaaS',
  OS_CONTROL: 'need OS / file-system / engine control',
  KUBERNETES: 'kubernetes on-prem/edge/multicloud',
  ARC_MANAGED_ENGINE: 'managed engine via Arc data controller',
  DIY_CONTAINER: 'full DIY container',
  // v2.1: the enums below were prose in the interview and IDs nowhere, so a session answered
  // in a vocabulary neither this mirror nor the contract recognised. Each expands to the exact
  // wording the rules already match on, so adding an ID changes no decision.
  UNDER_150_GB: '< 150 GB',
  FROM_150_GB_TO_4_TB: '150 GB - 4 TB',
  FROM_4_TB_TO_128_TB: '> 4 TB up to 128 TB',
  OVER_128_TB: '> 128 TB',
  NEAR_ZERO: 'near-zero',
  MINIMAL: 'minimal',
  OFFLINE: 'offline',
  GOOD_BANDWIDTH: 'good ExpressRoute / high bandwidth',
  LIMITED_WAN: 'limited WAN',
  VERY_LARGE_MULTI_TB: 'very large multi-TB move',
  PORTS_CONFIRMED_OPEN: 'ports confirmed open in both directions 5022 and 11000-11999',
  PORTS_BLOCKED: '5022 or 11000-11999 blocked',
  BLOB_HTTPS_CONFIRMED: 'HTTPS to Azure Blob confirmed',
  BLOB_HTTPS_BLOCKED: 'HTTPS to Azure Blob blocked',
  BLOB_HTTPS_UNKNOWN: 'HTTPS to Azure Blob not verified',
  STANDARD_COMMERCIAL: 'standard commercial',
  EU_DATA_BOUNDARY: 'EU data boundary',
  GOVERNMENT_SOVEREIGN: 'government / sovereign cloud',
  EDGE_AIR_GAPPED: 'edge / air-gapped / disconnected',
  LIST_FEATURES: 'let me list the feature dependencies',
  LIST_SERVICES: 'let me list the ancillary services',
  LIST_TIER_DRIVERS: 'let me list the tier drivers',
  // "None, confirmed" is the answer that clears a blocker, so it has to be a first-class value
  // rather than an empty field. Reading blank as "none" is the defect that shipped in v1.15.
  NONE_CONFIRMED: 'None',
  WINDOWS_SERVER_2012_OR_LATER: 'Windows Server 2012 or later',
  WINDOWS_SERVER_BELOW_2012: 'Windows Server below 2012',
  WINDOWS_CLIENT: 'Windows 10/11 client',
  LINUX: 'Linux',
  ENTERPRISE: 'Enterprise edition',
  STANDARD: 'Standard edition',
  DEVELOPER: 'Developer edition',
  EXPRESS: 'Express edition',
  WEB: 'Web edition',
  TDE_ENABLED: 'TDE enabled',
  TDE_NOT_ENABLED: 'TDE not enabled',
  CLR_SAFE: 'CLR SAFE permission set',
  CLR_EXTERNAL_ACCESS: 'CLR EXTERNAL_ACCESS permission set',
  CLR_UNSAFE: 'CLR UNSAFE permission set',
  SYSADMIN_AVAILABLE: 'sysadmin available on the source',
  LIMITED_RIGHTS: 'limited rights on the source',
  SQL_LOGINS_ONLY: 'SQL logins only',
  WINDOWS_LOGINS: 'Windows / AD logins',
  ENTRA_ID: 'Microsoft Entra ID',
  MIXED_AUTH: 'mixed authentication'
};
// Displayed labels that do not contain the phrasing the rules match on. A label the rules
// already recognise needs no entry here.
const LABEL_TO_ID = {
  'large estate (10+ servers/dbs)': 'LARGE_ESTATE',
  'on-prem': 'ON_PREM',
  'gcp cloud sql': 'GCP_CLOUD_SQL',
  'move to azure now': 'MIGRATE_NOW',
  'modernize in place / not ready to move yet (assess first)': 'MODERNIZE_IN_PLACE',
  'assessment only': 'ASSESSMENT_ONLY',
  'rehost first, modernize later': 'REHOST_FIRST',
  'end-of-support / esu pressure': 'EOS_ESU',
  'cost optimization': 'COST',
  'data-center exit (vmware estate)': 'DATACENTER_EXIT',
  'analytics / fabric unification': 'FABRIC_ANALYTICS',
  'sovereignty / edge': 'SOVEREIGNTY_EDGE',
  'need kubernetes on-prem / edge / multi-cloud': 'KUBERNETES',
  'managed engine (arc data controller: auto patch/backup/ha)': 'ARC_MANAGED_ENGINE',
  'full diy container (we own ha/patch/backup)': 'DIY_CONTAINER'
};
function expandOption(value) {
  if (Array.isArray(value)) return value.map(expandOption);
  const raw = String(value ?? '').trim();
  if (!raw) return value;
  if (OPTION_IDS[raw]) return `${raw} ${OPTION_IDS[raw]}`;
  const id = LABEL_TO_ID[raw.toLowerCase()];
  return id ? `${raw} ${OPTION_IDS[id]}` : value;
}
function normalizeInputs(inputs) {
  const out = { ...inputs };
  for (const key of ['scope', 'source_location', 'source_version', 'intent', 'driver', 'management_model', 'kubernetes_model', 'feature_dependencies',
    'size', 'downtime', 'compliance', 'network_bandwidth', 'mi_link_ports', 'blob_https_reachability',
    'source_os', 'source_edition', 'tde_status', 'clr_permission_set', 'source_permissions', 'authentication']) {
    if (key in out) out[key] = expandOption(out[key]);
  }
  // v2.1 split one network question into bandwidth, MI Link ports and Blob reachability, because a
  // single answer could satisfy one gate while leaving another unverified. The 90 scenarios written
  // before the split still send network_ports, so the composite is read as the union of the parts.
  const composite = [out.network_ports, out.network_bandwidth, out.mi_link_ports, out.blob_https_reachability]
    .filter(v => v !== undefined && v !== null && String(v).length > 0).join(' · ');
  if (composite) out.network_ports = composite;
  // Scope is a real input: a large estate goes to discovery, not to a target. It was displayed,
  // never declared and never consumed, so the answer was silently discarded.
  if (!out.size && /large estate/i.test(String(out.scope ?? ''))) out.size = 'estate scale / business case / dependency map';
  return out;
}
function applyHyperscaleCeiling(inputs, eligibility, out) {
  // HYPERSCALE-CEILING. 128 TB is the Hyperscale maximum for a single database, and Managed
  // Instance tops out far below it. Above that, no Azure SQL target holds the database as it
  // stands, so it has to be sharded or moved to a VM. The rule was written, indexed, and applied
  // nowhere: a 200 TB database was being recommended onto Azure SQL Database at medium confidence.
  if (!new RegExp(`over ${SQL_DB_TIERS.hyperscaleMaxSizeTb} tb|>\\s*${SQL_DB_TIERS.hyperscaleMaxSizeTb}\\s*tb`, 'i').test(String(inputs.size ?? ''))) return;
  eligibility.sql_db = E.UNSUPPORTED;
  eligibility.sql_mi = E.UNSUPPORTED;
  eligibility.sql_vm = E.ELIGIBLE;
  out.exclusions.sql_db = `A single database above ${SQL_DB_TIERS.hyperscaleMaxSizeTb} TB exceeds the Hyperscale ceiling.`;
  out.exclusions.sql_mi = `Managed Instance storage tops out far below ${SQL_DB_TIERS.hyperscaleMaxSizeTb} TB; it is not an as-is destination at this size.`;
  addUnique(out.hardBlockers, `The database exceeds the ${SQL_DB_TIERS.hyperscaleMaxSizeTb} TB Hyperscale ceiling for a single database.`);
  addUnique(out.evidenceRequired, 'Partition or shard the database, or size SQL Server on Azure VM storage for it. Confirm which before choosing a target.');
}
function applySourcePermissions(inputs, out) {
  // MI Link and transactional replication both need elevated rights on the source: the link sets
  // up an availability group, and a publisher needs its own privileges. The field was declared in
  // the contract and in the rule index, and read by nothing, so limited rights changed no answer.
  const method = String(out.method ?? '');
  if (!/MI Link|Transactional replication|distributed availability|Always On/i.test(method)) return;
  const perms = String(inputs.source_permissions ?? '');
  if (/sysadmin_available|sysadmin available/i.test(perms)) return;
  if (/limited/i.test(perms)) {
    addUnique(out.hardBlockers, `${method} requires elevated rights on the source, and the account was reported as having limited rights.`);
    out.methodGateStatus = 'refused';
  } else {
    addUnique(out.unknowns, `${method} requires sysadmin on the source to configure endpoints, and the available rights were never stated.`);
    out.methodGateStatus = out.methodGateStatus === 'refused' ? 'refused' : 'unknown_requires_assessment';
  }
  addUnique(out.evidenceRequired, 'Confirm the migration account holds sysadmin on the source instance before scheduling this method.');
}
function applyLrsWindow(inputs, out) {
  // LRS-WINDOW. The Log Replay Service has a hard 30-day maximum, after which the restore chain
  // must start again. Nobody collects an expected duration, so the constraint is always recorded;
  // it becomes an unknown only when the estate is large enough for 30 days to be a real risk.
  if (!/\bLRS\b|log replay/i.test(String(out.method ?? ''))) return;
  addUnique(out.evidenceRequired, `Confirm the migration completes inside the ${SOURCE_FLOORS.standaloneLrs.maxMigrationWindowDays}-day Log Replay Service window; past it the restore chain must be restarted from a new full backup.`);
  const large = /4 tb|128 tb|multi-tb|multitb/i.test(String(inputs.size ?? ''));
  const slow = /limited wan|very large/i.test(`${inputs.network_bandwidth ?? ''} ${inputs.network_ports ?? ''}`);
  if (!large && !slow) return;
  addUnique(out.unknowns, `At this size or bandwidth the ${SOURCE_FLOORS.standaloneLrs.maxMigrationWindowDays}-day LRS window is a real constraint, and the expected duration was never estimated.`);
  out.methodGateStatus = out.methodGateStatus === 'refused' ? 'refused' : 'unknown_requires_assessment';
}
function applyMethodPrerequisiteGates(inputs, out) {
  out.methodGateStatus = undefined;
  applyBackupBlobPath(inputs, out);
  applySourcePermissions(inputs, out);
  applyLrsWindow(inputs, out);
}
function applyRefusedMethodGate(inputs, eligibility, out) {
  // A gate that reports `refused` while its method stays on the card is worse than no gate: the
  // card contradicts itself and the reader has to decide which half to believe.
  if (out.methodGateStatus !== 'refused') return;
  const rejected = String(out.method ?? '');
  addMethodExclusion(out.primaryTarget, `${rejected} was refused by its own gate.`, out);
  // Findings raised against the rejected method must go with it, or the card carries an unknown
  // about a method nobody is proposing any more.
  const mentions = (text) => rejected && String(text).toLowerCase().includes(rejected.toLowerCase());
  out.unknowns = out.unknowns.filter(u => !mentions(u));
  out.evidenceRequired = out.evidenceRequired.filter(e => !mentions(e));
  const [fallbackTarget, fallbackMethod] = chooseConsistentFallback(inputs, eligibility, out);
  out.primaryTarget = fallbackTarget;
  out.primary_target = fallbackTarget;
  out.method = fallbackMethod;
  delete out.alternativeTarget;
  applyMethodPrerequisiteGates(inputs, out);
  if (out.methodGateStatus === 'refused') {
    // Nothing viable survived. Say so rather than presenting a refused method.
    out.primaryTarget = 'provisional shortlist only';
    out.primary_target = 'provisional shortlist only';
    out.method = 'Assessment and dependency discovery first';
    out.methodGateStatus = 'unknown_requires_assessment';
    addUnique(out.unknowns, 'Every candidate method was refused by one of its own gates; the target cannot be settled from the interview alone.');
  }
}
export function evaluate(rawInputs = {}) {
  const inputs = normalizeInputs(rawInputs);
  const eligibility = {
    sql_vm: E.ELIGIBLE,
    avs: E.UNSUPPORTED,
    sql_mi: E.ELIGIBLE,
    sql_db: E.ELIGIBLE,
    fabric_sql_db: E.UNSUPPORTED,
    arc_sql_mi: E.UNSUPPORTED,
    container: E.UNSUPPORTED,
    arc_in_place: E.UNSUPPORTED
  };
  const out = { hardBlockers: [], unknowns: [], evidenceRequired: [], exclusions: {} };
  applyFabric(inputs, eligibility, out);
  applyFeatureEligibility(inputs, eligibility, out);
  applyClrPermission(inputs, out, eligibility);
  applyHyperscaleCeiling(inputs, eligibility, out);
  applyManagement(inputs, eligibility, out);

  const [primaryTarget, method] = chooseTarget(inputs, eligibility, out);
  out.primaryTarget = primaryTarget;
  out.primary_target = primaryTarget;
  out.method = method;

  if (primaryTarget === 'Azure SQL Managed Instance') out.tier = chooseMiTier(inputs, out);
  else if (primaryTarget === 'Azure SQL Database') out.tier = chooseSqlDbTier(inputs, out);
  else if (primaryTarget === 'SQL database in Fabric') out.tier = 'Fabric SQL database (GA)';

  applyMethodGates(inputs, primaryTarget, method, eligibility, out);
  enforceOutputConsistency(inputs, eligibility, out);
  buildMethodCandidates(inputs, eligibility, out);
  // The three gates below run *after* the consistency pass, not before it. Running them first
  // meant they judged a method the consistency pass then replaced, leaving an unknown on the card
  // that belonged to a method nobody was proposing any more.
  applyMethodPrerequisiteGates(inputs, out);
  applyRefusedMethodGate(inputs, eligibility, out);
  if (out.primaryTarget === 'Azure SQL Managed Instance') out.tier = chooseMiTier(inputs, out);
  else if (out.primaryTarget === 'Azure SQL Database') out.tier = chooseSqlDbTier(inputs, out);
  else if (out.primaryTarget !== 'SQL database in Fabric') delete out.tier;
  const [availability, cutover] = methodAvailability(out.method, out.tier);
  out.targetAvailabilityDuringSync = availability;
  // A cutover class is a promise made to the business. Deriving it from a method that was
  // itself picked by defaulting an unanswered downtime question states a number nobody
  // supplied, so an unknown tolerance yields an unknown class rather than "minutes".
  if (downtimeUnknown(inputs)) {
    out.businessCutoverDowntime = E.UNKNOWN;
    addUnique(out.unknowns, 'Cutover downtime tolerance');
    addUnique(out.evidenceRequired, 'Agree the business cutover downtime tolerance with the application owner, then re-rank the methods');
  } else {
    out.businessCutoverDowntime = cutover;
  }
  if (out.method === 'LRS' && out.tier === 'MI Business Critical') out.lrsBusinessCriticalCutoverCanTakeHours = true;
  // Log shipping availability is a restore-mode choice, not a property of the method. The shipped
  // value assumes WITH NORECOVERY, the standard migration configuration. WITH STANDBY makes the
  // secondary queryable between restore jobs, so the value flips to read-only. A weekly review
  // caught the rule text calling both modes `unavailable`.
  if (out.method === 'Log shipping') {
    addUnique(out.evidenceRequired, 'Log shipping: confirm the secondary restore mode. WITH NORECOVERY leaves the target unavailable; WITH STANDBY makes it read-only between restore jobs, and every restore disconnects the readers. The reported availability assumes NORECOVERY.');
  }
  if (out.method === 'MI Link' && eligibility.sql_vm !== E.UNSUPPORTED) out.alternativeTarget = 'SQL Server on Azure VM';
  if (out.primaryTarget === 'Azure SQL Database' && eligibility.sql_mi !== E.UNSUPPORTED) out.alternativeTarget = 'Azure SQL Managed Instance';

  finalizeStatus(inputs, out, eligibility);
  out.eligibility = eligibility;
  return out;
}

// Safety nets that evaluate() cannot reach. chooseTarget only ever emits a target and
// method that already satisfy each other's gates, and sql_vm is never marked
// unsupported, so the per-target method guards and the fallback's later candidates
// never fire in a normal run. Deleting them would remove the net that catches a future
// rule change; exporting them lets the suite prove they still work.
export const __guards = { methodGateFailure, chooseConsistentFallback, chooseTarget, normalizeInputs, OPTION_IDS, LABEL_TO_ID, TARGET_LABELS, E, MI_LINK };
