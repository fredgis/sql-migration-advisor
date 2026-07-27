/**
 * Executable mirror of reference/decision-rules.md for golden tests.
 *
 * This is deliberately a small, dependency-free test oracle. It is NOT the
 * production sql-migration-advisor engine: in production, Copilot reads the
 * markdown skill and reference rules. The mirror exists so golden scenarios
 * execute deterministically in CI. It can drift from the markdown, so each
 * scenario still carries assertRulePresent anchors checked against the real
 * rule text.
 */

const TARGETS = ['sql_vm', 'avs', 'sql_mi', 'sql_db', 'fabric_sql_db', 'arc_sql_mi', 'container', 'arc_in_place'];
const E = {
  ELIGIBLE: 'eligible',
  REMEDIATE: 'eligible_with_remediation',
  UNSUPPORTED: 'unsupported',
  UNKNOWN: 'unknown_requires_assessment'
};

function textOf(value) {
  if (Array.isArray(value)) return value.map(textOf).join(' | ');
  if (value && typeof value === 'object') return Object.values(value).map(textOf).join(' | ');
  return String(value ?? '');
}
function has(haystack, needle) { return textOf(haystack).toLowerCase().includes(String(needle).toLowerCase()); }
function any(inputs, ...needles) { const t = textOf(inputs).toLowerCase(); return needles.some(n => t.includes(String(n).toLowerCase())); }
function dep(inputs, needle) { return (inputs.feature_dependencies || []).some(d => has(d, needle)); }
function versionNumber(v) {
  const s = textOf(v);
  if (/2008/.test(s)) return 2008;
  const m = s.match(/20\d{2}/);
  return m ? Number(m[0]) : undefined;
}
function sourceKind(inputs) { return String(inputs.source_location || '').toLowerCase(); }
function isManagedCloudSqlSource(inputs) { const s = sourceKind(inputs); return s.includes('aws rds') || s.includes('gcp cloud sql'); }
function isSelfManagedSource(inputs) { return !isManagedCloudSqlSource(inputs); }
function portsOpenForMiLink(inputs) {
  const ports = String(inputs.network_ports || '').toLowerCase();
  if (!ports || /not sure|unknown/.test(ports)) return false;
  if (/(5022[^.;,]*(blocked|cannot|can't|closed)|(blocked|cannot|can't|closed)[^.;,]*5022)/.test(ports)) return false;
  if (/(11000|11999)[^.;,]*(blocked|cannot|can't|closed)|(blocked|cannot|can't|closed)[^.;,]*(11000|11999)/.test(ports)) return false;
  return /5022/.test(ports) && (/11000|11999/.test(ports));
}
function portsKnownBlockedForMiLink(inputs) {
  const ports = String(inputs.network_ports || '').toLowerCase();
  return /(5022[^.;,]*(blocked|cannot|can't|closed)|(blocked|cannot|can't|closed)[^.;,]*5022)/.test(ports)
    || /(11000|11999)[^.;,]*(blocked|cannot|can't|closed)|(blocked|cannot|can't|closed)[^.;,]*(11000|11999)/.test(ports);
}
function hasValidatedEvidence(inputs) {
  const all = textOf(inputs).toLowerCase();
  return /tool-confirmed|dependency inventory confirmed|assessment confirmed|arc discovery confirmed|ssms 22 assessment confirmed/.test(all)
    && /measured|perfmon|dmv|baseline|query store|sizing data confirmed/.test(all)
    && /region confirmed|regional availability confirmed|feature availability confirmed|target-region/.test(all)
    && /architect sign-off|architect signed off|architect approval|architect-approved/.test(all);
}
function addUnique(arr, value) { if (value && !arr.includes(value)) arr.push(value); }
function setUnknown(eligibility, keys, reason, out) {
  for (const k of keys) eligibility[k] = E.UNKNOWN;
  addUnique(out.unknowns, reason);
  addUnique(out.evidenceRequired, reason);
}
function methodAvailability(method, tier) {
  if (method === 'MI Link') return ['read-only', '<1min'];
  if (method === 'LRS') return ['unavailable', tier === 'MI Business Critical' ? 'hours' : 'minutes'];
  if (method === 'Native backup/restore') return ['not-present', 'full-restore-time'];
  if (method === 'BACPAC/SqlPackage') return ['not-present', 'full-load-time'];
  if (method === 'Transactional replication') return ['read-write', 'near-zero'];
  if (method === 'modern DMS (offline)') return ['not-present', 'total-migration-time'];
  if (method === 'Distributed AG or Always On AG') return ['read-only', 'near-zero'];
  if (method === 'Log shipping') return ['unavailable', 'minimal'];
  if (method === 'Fabric Migration Assistant') return ['not-present', 'full-load-time'];
  if (/Data Box|BACPAC|bcp|ADF|SqlPackage/.test(method)) return ['not-present', 'full-load-time'];
  return ['unknown_requires_assessment', 'unknown_requires_assessment'];
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
  return undefined;
}
function chooseSqlDbTier(inputs, out) {
  const p = String(inputs.performance || '').toLowerCase();
  const size = String(inputs.size || '').toLowerCase();
  const tenants = String(inputs.tenant_count || '').toLowerCase();
  if (/>\s*4\s*tb|over 4 tb|multi-tb|multitb/.test(size)) return 'Hyperscale';
  if (/intermittent|seasonal|idle|auto-pause|dev\/test/.test(p)) return 'Serverless';
  if (/many tenants|multi-tenant|variable demand|elastic/.test(tenants)) return 'Elastic Pool';
  if (/business critical|low-latency|low latency|high transaction log|strict sla|zone redundancy|read-scale|in-memory/.test(p)) return 'Business Critical';
  if (/general purpose|moderate|cost-sensitive|steady/.test(p) || /150 gb|<\s*150 gb/.test(size)) return 'General Purpose';
  if (/none\/unknown|not sure|unknown/.test(p) || /not sure|unknown/.test(size) || /not sure|unknown/.test(tenants)) {
    addUnique(out.unknowns, 'SQL DB tier-driving size/performance/tenancy inputs');
    addUnique(out.evidenceRequired, 'Performance baseline and tenancy profile');
    return E.UNKNOWN;
  }
  return undefined;
}
function applyFabric(inputs, eligibility, out) {
  const fabricDriven = has(inputs.driver, 'analytics/Fabric') || any(inputs, 'analytics-first', 'BI/analytics-first');
  if (!fabricDriven) {
    eligibility.fabric_sql_db = E.UNSUPPORTED;
    out.exclusions.fabric_sql_db = 'Fabric branch only applies to analytics/Fabric-driven simple schemas.';
    return;
  }
  const fabricText = `${textOf(inputs.fabric_constraints)} ${textOf(inputs.compliance)} ${textOf(inputs.size)} ${textOf(inputs.feature_dependencies)}`.toLowerCase();
  const mentionsGate = /dacpac|preview|gateway|private link/.test(fabricText);
  if (!mentionsGate) {
    eligibility.fabric_sql_db = E.UNKNOWN;
    addUnique(out.unknowns, 'Fabric Preview gates: DACPAC size, Private Link, gateway, preview acceptance');
    addUnique(out.evidenceRequired, 'Confirm DACPAC <= 20 MB, no Private Link requirement, gateway acceptable, Preview acceptable');
    return;
  }
  if (/private link required|requires private link|private link: required|private link yes/.test(fabricText)) {
    eligibility.fabric_sql_db = E.UNSUPPORTED;
    out.exclusions.fabric_sql_db = 'Fabric SQL database Preview has no Private Link/VNet gateway path.';
    return;
  }
  if (/dacpac\s*>\s*20|>\s*20\s*mb|over 20\s*mb|>\s*4\s*tb/.test(fabricText)) {
    eligibility.fabric_sql_db = E.UNSUPPORTED;
    out.exclusions.fabric_sql_db = 'Fabric Migration Assistant requires DACPAC <= 20 MB.';
    return;
  }
  if (/preview (not|no)|preview unacceptable|gateway (not|no)|cannot use on-prem data gateway/.test(fabricText)) {
    eligibility.fabric_sql_db = E.UNSUPPORTED;
    out.exclusions.fabric_sql_db = 'Fabric Preview acceptance and on-prem data gateway are mandatory.';
    return;
  }
  if (/dacpac\s*(<=|≤|under|=)\s*20|no private link|gateway acceptable|preview accepted/.test(fabricText)) eligibility.fabric_sql_db = E.ELIGIBLE;
  else eligibility.fabric_sql_db = E.UNKNOWN;
}
function applyFeatureEligibility(inputs, eligibility, out) {
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
  if (dep(inputs, 'linked servers')) { eligibility.sql_mi = E.REMEDIATE; eligibility.sql_db = E.UNSUPPORTED; }
  if (dep(inputs, 'SQL Agent')) { eligibility.sql_mi = E.ELIGIBLE; eligibility.sql_db = E.REMEDIATE; }
  if (dep(inputs, 'SQL CLR') || dep(inputs, 'Service Broker') || dep(inputs, 'cross-DB')) { eligibility.sql_mi = E.REMEDIATE; eligibility.sql_db = E.UNSUPPORTED; }
  if (dep(inputs, 'Not sure') || dep(inputs, 'unknown dependencies')) setUnknown(eligibility, ['sql_mi', 'sql_db'], 'Dependency inventory', out);
}
function applyManagement(inputs, eligibility, out) {
  const model = String(inputs.management_model || '').toLowerCase();
  const k8s = String(inputs.kubernetes_model || '').toLowerCase();
  const v = versionNumber(inputs.source_version);
  if (has(inputs.intent, 'assessment-only') || has(inputs.intent, 'modernize in place') || has(inputs.driver, 'modernize in place')) {
    eligibility.arc_in_place = v && v < 2014 ? E.UNSUPPORTED : E.ELIGIBLE;
    if (v && v < 2014) {
      out.exclusions.arc_in_place = 'Arc migration/assessment experience requires SQL Server 2014+.';
      addUnique(out.hardBlockers, 'SQL Server 2012 is below the 2014+ Arc experience floor');
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
  const v = versionNumber(inputs.source_version);
  if (eligibility.arc_in_place === E.ELIGIBLE && (has(inputs.intent, 'assessment-only') || has(inputs.intent, 'modernize in place'))) return ['SQL Server enabled by Azure Arc', 'Arc best-practices assessment'];
  if (eligibility.arc_in_place === E.UNSUPPORTED && (has(inputs.intent, 'assessment-only') || has(inputs.intent, 'modernize in place'))) return ['SQL Server on Azure VM', 'Standalone assessment / native backup/restore'];
  if (eligibility.arc_sql_mi === E.UNKNOWN || eligibility.container === E.UNKNOWN) return ['provisional shortlist only', 'Clarify Kubernetes engine model first'];
  if (eligibility.arc_sql_mi === E.ELIGIBLE) return ['Arc-enabled SQL Managed Instance', any(inputs, 'sovereignty', 'air-gapped') ? 'Native backup/restore' : 'Native backup/restore after endpoint is available'];
  if (eligibility.container === E.ELIGIBLE && /kubernetes/i.test(String(inputs.management_model || ''))) return ['SQL Server in a container', 'Backup/restore via mounted volume'];
  if (eligibility.avs === E.ELIGIBLE && has(inputs.driver, 'data-center exit')) return ['Azure VMware Solution', 'VMware HCX / vMotion'];
  if (eligibility.fabric_sql_db === E.UNKNOWN) return ['provisional shortlist only', 'Confirm Fabric Preview gates first'];
  if (eligibility.fabric_sql_db === E.ELIGIBLE) return ['SQL database in Fabric', 'Fabric Migration Assistant'];
  if (eligibility.sql_mi === E.UNKNOWN || eligibility.sql_db === E.UNKNOWN) return ['provisional shortlist only', 'Assessment and dependency discovery first'];
  if (eligibility.sql_mi === E.UNSUPPORTED && eligibility.sql_db === E.UNSUPPORTED) return ['SQL Server on Azure VM', chooseVmMethod(inputs)];
  if (eligibility.sql_vm === E.ELIGIBLE && (eligibility.sql_mi === E.UNSUPPORTED || eligibility.sql_db === E.UNSUPPORTED) && has(inputs.management_model, 'need OS')) return ['SQL Server on Azure VM', chooseVmMethod(inputs)];
  if (any(inputs.network_ports, 'limited WAN') && any(inputs.size, '> 4 TB', 'multi-TB', 'multitb')) return ['Azure SQL Managed Instance or Azure SQL Database', 'Data Box seed → sync delta'];
  if (any(inputs.size, 'estate scale', 'business case', 'dependency map')) return ['Azure Migrate discovery first', 'Azure Migrate appliance/import/Arc discovery'];
  if (dep(inputs, 'TDE')) return ['Azure SQL Managed Instance', 'Native backup/restore'];
  if (dep(inputs, 'SQL Agent') || dep(inputs, 'linked servers') || dep(inputs, 'homogeneous') || dep(inputs, 'PolyBase/cloud files') || dep(inputs, 'SQL CLR') || dep(inputs, 'Service Broker') || dep(inputs, 'cross-DB')) return ['Azure SQL Managed Instance', chooseMiMethod(inputs, out)];
  if (isManagedCloudSqlSource(inputs) && has(inputs.downtime, 'near-zero')) return ['Azure SQL Managed Instance', chooseMiMethod(inputs, out)];
  if (has(inputs.source_version, '2008')) return ['Azure SQL Managed Instance', chooseMiMethod(inputs, out)];
  if (has(inputs.driver, 'app modernization') || eligibility.fabric_sql_db === E.UNSUPPORTED || any(inputs.size, '> 4 TB', '150 GB') || any(inputs.performance, 'intermittent', 'strict SLA', 'transaction log') || any(inputs.tenant_count, 'many tenants')) return ['Azure SQL Database', chooseSqlDbMethod(inputs)];
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
  if (any(inputs.size, '< 150 GB', 'small')) return 'BACPAC/SqlPackage';
  return 'modern DMS (offline)';
}
function chooseMiMethod(inputs, out) {
  const v = versionNumber(inputs.source_version);
  const targetTier = chooseMiTier(inputs, { unknowns: [], evidenceRequired: [] });
  const dbCountText = `${textOf(inputs.size)} ${textOf(inputs.performance)}`.toLowerCase();
  const m = dbCountText.match(/(\d+)\s*(database|db|link)/);
  const dbCount = m ? Number(m[1]) : undefined;
  const cap = /next-gen|next gen/.test(dbCountText) ? 500 : 100;
  if (dbCount && dbCount > cap) {
    out.exclusions.mi_link = `MI Link capacity ${cap} links exceeded by ${dbCount} databases.`;
  }
  if (has(inputs.downtime, 'near-zero') || has(inputs.downtime, 'minimal')) {
    if (!isManagedCloudSqlSource(inputs) && v >= 2016 && portsOpenForMiLink(inputs) && (!dbCount || dbCount <= cap)) return 'MI Link';
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
      else if (v && v < 2016) out.exclusions.mi_link = 'MI Link requires SQL Server 2016+.';
      else if (portsKnownBlockedForMiLink(inputs)) out.exclusions.mi_link = 'MI Link requires 5022 and 11000-11999 in the documented directions.';
    }
    if (method === 'LRS' && v && v < 2008) {
      eligibility.sql_mi = E.UNSUPPORTED;
      addUnique(out.hardBlockers, 'Standalone LRS supports SQL Server 2008-2022.');
    }
  }
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
  else if (primaryTarget === 'SQL database in Fabric') out.tier = 'Fabric SQL database Preview';

  applyMethodGates(inputs, primaryTarget, method, eligibility, out);
  const [availability, cutover] = methodAvailability(method, out.tier);
  out.targetAvailabilityDuringSync = availability;
  out.businessCutoverDowntime = cutover;
  if (method === 'LRS' && out.tier === 'MI Business Critical') out.lrsBusinessCriticalCutoverCanTakeHours = true;
  if (method === 'MI Link') out.alternativeTarget = 'Azure SQL Managed Instance via LRS fallback';
  if (primaryTarget === 'Azure SQL Database' && eligibility.sql_mi !== E.UNSUPPORTED) out.alternativeTarget = 'Azure SQL Managed Instance';

  finalizeStatus(inputs, out, eligibility);
  out.eligibility = eligibility;
  return out;
}



