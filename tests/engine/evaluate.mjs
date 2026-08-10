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
function versionNumber(v) {
  const m = textOf(v).match(/\b(?:19|20)\d{2}\b/);
  return m ? Number(m[0]) : undefined;
}
function sourceKind(inputs) { return String(inputs.source_location || '').toLowerCase(); }
function isManagedCloudSqlSource(inputs) { const s = sourceKind(inputs); return s.includes('aws rds') || s.includes('gcp cloud sql'); }
function isSelfManagedSource(inputs) { return !isManagedCloudSqlSource(inputs); }
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
  }
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
  const explicitTier = String(inputs.tier || inputs.size || '').toLowerCase();
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
  if (/general purpose|moderate|cost-sensitive|steady/.test(p) || new RegExp(`${SQL_DB_TIERS.generalPurposeSmallDatabaseSignalGb} gb|<\\s*${SQL_DB_TIERS.generalPurposeSmallDatabaseSignalGb} gb`).test(size)) return 'General Purpose';
  if (/none\/unknown|not sure|unknown/.test(p) || /not sure|unknown/.test(size) || /not sure|unknown/.test(tenants)) {
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
  const fabricText = `${textOf(inputs.fabric_constraints)} ${textOf(inputs.compliance)} ${textOf(inputs.size)} ${textOf(inputs.feature_dependencies)}`.toLowerCase();
  const mentionsGate = /dacpac|preview|gateway|private link/.test(fabricText);
  if (!mentionsGate) {
    eligibility.fabric_sql_db = E.UNKNOWN;
    addUnique(out.unknowns, 'Fabric ingestion path, then Migration Assistant gates: DACPAC size, Private Link, gateway, preview acceptance');
    addUnique(out.evidenceRequired, `Confirm an ingestion path; if it is the Migration Assistant, confirm DACPAC <= ${FABRIC_MIGRATION.maxDacpacMb} MB, no Private Link requirement, gateway acceptable, Preview acceptable`);
    return;
  }
  if (/private link required|requires private link|private link: required|private link yes/.test(fabricText)) {
    eligibility.fabric_sql_db = E.REMEDIATE;
    out.exclusions.fabric_sql_db = 'The Fabric Migration Assistant has no Private Link/VNet gateway path; the GA target itself remains available through another ingestion path.';
    return;
  }
  if (new RegExp(`dacpac\\s*>\\s*${FABRIC_MIGRATION.maxDacpacMb}|>\\s*${FABRIC_MIGRATION.maxDacpacMb}\\s*mb|over ${FABRIC_MIGRATION.maxDacpacMb}\\s*mb|>\\s*${SQL_DB_TIERS.hyperscaleSizeThresholdTb}\\s*tb`).test(fabricText)) {
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
    eligibility.sql_mi = E.UNSUPPORTED; eligibility.sql_db = E.UNSUPPORTED; eligibility.sql_vm = E.ELIGIBLE;
  }
  if (/kubernetes/.test(model)) {
    eligibility.sql_mi = E.UNSUPPORTED; eligibility.sql_db = E.UNSUPPORTED;
    if (/managed engine|arc data controller/.test(k8s)) { eligibility.arc_sql_mi = E.ELIGIBLE; eligibility.container = E.UNSUPPORTED; }
    else if (/diy|full diy/.test(k8s)) { eligibility.container = E.ELIGIBLE; eligibility.arc_sql_mi = E.UNSUPPORTED; }
    else setUnknown(eligibility, ['arc_sql_mi', 'container'], 'Kubernetes managed-vs-DIY engine model', out);
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
  if ((has(inputs.downtime, 'near-zero') || has(inputs.downtime, 'minimal'))
    && lrsSourceUnsupported(inputs)
    && !portsOpenForMiLink(inputs)
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
  if (has(inputs.downtime, 'near-zero')) return 'Distributed AG or Always On AG';
  if (has(inputs.downtime, 'minimal')) return 'Log shipping';
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
    return 'LRS';
  }
  if (has(inputs.downtime, 'offline')) return dep(inputs, 'TDE') ? 'Native backup/restore' : 'LRS';
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
    if (method === 'LRS' && v && (v < SOURCE_FLOORS.standaloneLrs.sqlServerMin || v > SOURCE_FLOORS.standaloneLrs.sqlServerMax)) {
      eligibility.sql_mi = E.UNSUPPORTED;
      addUnique(out.hardBlockers, `Standalone LRS supports SQL Server ${SOURCE_FLOORS.standaloneLrs.sqlServerMin}-${SOURCE_FLOORS.standaloneLrs.sqlServerMax}.`);
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
function methodGateFailure(inputs, target, method, out = {}) {
  const v = versionNumber(inputs.source_version);
  if (target === 'Azure SQL Managed Instance') {
    if (method === 'MI Link') {
      if (isManagedCloudSqlSource(inputs)) return 'MI Link is impossible from AWS RDS/GCP Cloud SQL because sysadmin/AG endpoints are unavailable.';
      if (v && v < SOURCE_FLOORS.miLink.sqlServerMin) return `MI Link requires SQL Server ${SOURCE_FLOORS.miLink.sqlServerMin}+.`;
      if (miLinkHostSupport(inputs) === 'unsupported') return `MI Link requires ${SOURCE_FLOORS.miLink.editions.join(', ')} edition, and on Linux hosts SQL Server ${SOURCE_FLOORS.miLink.linuxSqlServerMin}+.`;
      if (!portsOpenForMiLink(inputs)) {
        const p = MI_LINK.ports;
        return `MI Link requires ${p.sqlServerEndpoint} and ${p.managedInstanceHadrRange.start}-${p.managedInstanceHadrRange.end} in the documented directions.`;
      }
      if (miLinkKnownCapacityExceeded(inputs, out)) return out.exclusions?.mi_link || 'MI Link database capacity is exceeded.';
      return null;
    }
    if (method === 'LRS') {
      if (v && (v < SOURCE_FLOORS.standaloneLrs.sqlServerMin || v > SOURCE_FLOORS.standaloneLrs.sqlServerMax)) {
        return `Standalone LRS supports SQL Server ${SOURCE_FLOORS.standaloneLrs.sqlServerMin}-${SOURCE_FLOORS.standaloneLrs.sqlServerMax}.`;
      }
      return null;
    }
    if (method === 'Native backup/restore') return null;
    return `${method} is not a supported Azure SQL Managed Instance migration method in this rules mirror.`;
  }
  if (target === 'Azure SQL Database') {
    if (method === 'Transactional replication') {
      if (isManagedCloudSqlSource(inputs)) return 'Transactional replication requires source rights unavailable on managed cloud SQL sources.';
      if (v && v < SOURCE_FLOORS.transactionalReplicationToSqlDb.publisherSqlServerMin) return `Transactional replication publisher requires SQL Server ${SOURCE_FLOORS.transactionalReplicationToSqlDb.publisherSqlServerMin}+.`;
      return null;
    }
    if (method === 'BACPAC/SqlPackage' || method === 'modern DMS (offline)' || method === 'Data Box seed → sync delta') return null;
    return `${method} is not a supported Azure SQL Database migration method in this rules mirror.`;
  }
  if (target === 'SQL Server on Azure VM') return ['Distributed AG or Always On AG', 'Log shipping', 'Native backup/restore', 'Standalone assessment / native backup/restore'].includes(method) ? null : `${method} is not a SQL VM migration method.`;
  if (target === 'Azure VMware Solution') return method === 'VMware HCX / vMotion' ? null : `${method} is not an AVS migration method.`;
  if (target === 'SQL database in Fabric') return method === 'Fabric Migration Assistant' ? null : `${method} is not a Fabric SQL database migration method.`;
  if (target === 'Arc-enabled SQL Managed Instance') return /^Native backup\/restore/.test(method) ? null : `${method} is not an Arc-enabled SQL MI migration method.`;
  if (target === 'SQL Server in a container') return method === 'Backup/restore via mounted volume' ? null : `${method} is not a SQL Server container migration method.`;
  if (target === 'SQL Server enabled by Azure Arc') return method === 'Arc best-practices assessment' ? null : `${method} is not an Arc assessment method.`;
  return null;
}
function viableTargetKeyForLabel(label, eligibility) {
  const key = LABEL_TO_TARGET[label];
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
function finalizeStatus(inputs, out, eligibility) {
  const hasUnknown = Object.values(eligibility).includes(E.UNKNOWN) || out.unknowns.length > 0 || out.tier === E.UNKNOWN;
  if (hasValidatedEvidence(inputs) && !hasUnknown && out.hardBlockers.length === 0) {
    out.recommendationStatus = 'validated';
    out.confidence = 'high';
  } else {
    out.recommendationStatus = 'provisional';
    out.confidence = hasUnknown ? 'low' : 'medium';
  }
}

export function evaluate(inputs = {}) {
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
  if (out.primaryTarget === 'Azure SQL Managed Instance') out.tier = chooseMiTier(inputs, out);
  else if (out.primaryTarget === 'Azure SQL Database') out.tier = chooseSqlDbTier(inputs, out);
  else if (out.primaryTarget !== 'SQL database in Fabric') delete out.tier;
  const [availability, cutover] = methodAvailability(out.method, out.tier);
  out.targetAvailabilityDuringSync = availability;
  out.businessCutoverDowntime = cutover;
  if (out.method === 'LRS' && out.tier === 'MI Business Critical') out.lrsBusinessCriticalCutoverCanTakeHours = true;
  if (out.method === 'MI Link' && eligibility.sql_vm !== E.UNSUPPORTED) out.alternativeTarget = 'SQL Server on Azure VM';
  if (out.primaryTarget === 'Azure SQL Database' && eligibility.sql_mi !== E.UNSUPPORTED) out.alternativeTarget = 'Azure SQL Managed Instance';

  finalizeStatus(inputs, out, eligibility);
  out.eligibility = eligibility;
  return out;
}
