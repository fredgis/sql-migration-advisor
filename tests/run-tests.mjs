import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { evaluate, __guards as guards } from './engine/evaluate.mjs';
import { validateGoldenScenarios } from './validate-scenarios.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = (...p) => path.join(root, ...p);
const jsonMode = process.argv.includes('--json');
const results = [];

// Deliberate anti-degeneracy gates. If future rules legitimately change the
// scenario distribution, consciously re-baseline these rather than drifting.
//
// MAX_TARGET_SHARE is a tripwire against the engine collapsing to one answer, not a law
// about the corpus. Re-baselined from 0.32 to 0.34 in v1.9 when three MI Link host-gate
// scenarios were added (Linux source, Windows Server below the floor, Express edition),
// taking Azure SQL Managed Instance from 23/75 to 26/78. Raise it only with the scenarios
// that justify it named here; raising it to make a build pass is how the guard dies.
const MAX_TARGET_SHARE = 0.34;
const MIN_DISTINCT_METHODS = 18;
const MIN_DISTINCT_AVAILABILITY_VALUES = 5;
const ELIGIBLE_STATES = new Set(['eligible', 'eligible_with_remediation']);
const TARGET_TO_KEY = new Map([
  ['SQL Server on Azure VM', 'sql_vm'],
  ['Azure VMware Solution', 'avs'],
  ['Azure SQL Managed Instance', 'sql_mi'],
  ['Azure SQL Database', 'sql_db'],
  ['SQL database in Fabric', 'fabric_sql_db'],
  ['Arc-enabled SQL Managed Instance', 'arc_sql_mi'],
  ['SQL Server in a container', 'container'],
  ['SQL Server enabled by Azure Arc', 'arc_in_place']
]);

function readText(relativePath) { return fs.readFileSync(rel(relativePath), 'utf8'); }
function norm(s) { return String(s).toLowerCase().replace(/[`*_]/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' '); }
function lineOf(text, index) { return text.slice(0, Math.max(index, 0)).split(/\r?\n/).length; }
function add(name, ok, details = [], meta = {}) { results.push({ name, ok, details, ...meta }); }
function asRegex(pattern) {
  try { return new RegExp(pattern, 'imsu'); }
  catch { return new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'imsu'); }
}
function locatePattern(text, pattern) {
  const re = asRegex(pattern);
  const m = re.exec(text);
  return m ? { index: m.index, line: lineOf(text, m.index), match: m[0].slice(0, 120).replace(/\s+/g, ' ') } : null;
}
function walk(dir, predicate, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, predicate, out);
    else if (predicate(p)) out.push(p);
  }
  return out;
}
function fileLine(file, line) { return `${path.relative(root, file)}:${line}`.replaceAll('/', '\\'); }
function getByPath(obj, dotted) {
  return dotted.split('.').reduce((acc, part) => acc == null ? undefined : acc[part], obj);
}
function valuesEqual(expected, actual) {
  return JSON.stringify(expected) === JSON.stringify(actual);
}
function compareExpected(scenario, actual) {
  const failures = [];
  const expect = scenario.expect || {};
  for (const [field, expected] of Object.entries(expect)) {
    if (field === 'mustNotRecommend') continue;
    if (field === 'methodOneOf') {
      if (!expected.includes(actual.method)) failures.push(`expected method one of ${JSON.stringify(expected)}, got ${JSON.stringify(actual.method)}`);
      continue;
    }
    if (field === 'eligibility') {
      for (const [target, expectedState] of Object.entries(expected)) {
        const actualState = actual.eligibility?.[target];
        if (!valuesEqual(expectedState, actualState)) failures.push(`eligibility.${target}: expected ${JSON.stringify(expectedState)}, got ${JSON.stringify(actualState)}`);
      }
      continue;
    }
    const actualField = field === 'primary_target' ? actual.primaryTarget : getByPath(actual, field);
    if (!valuesEqual(expected, actualField)) failures.push(`${field}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actualField)}`);
  }
  for (const forbidden of expect.mustNotRecommend || []) {
    const haystack = `${actual.primaryTarget} ${actual.alternativeTarget || ''} ${actual.method}`.toLowerCase();
    const needle = String(forbidden).toLowerCase();
    if (needle && haystack.includes(needle)) failures.push(`mustNotRecommend: output contained ${JSON.stringify(forbidden)}`);
  }
  return failures;
}
function versionNumber(v) {
  const m = String(v ?? '').match(/\b(?:19|20)\d{2}\b/);
  return m ? Number(m[0]) : undefined;
}
function textOf(value) {
  if (Array.isArray(value)) return value.map(textOf).join(' | ');
  if (value && typeof value === 'object') return Object.values(value).map(textOf).join(' | ');
  return String(value ?? '');
}
function isManagedCloudSqlSource(inputs) {
  const source = String(inputs.source_location || '').toLowerCase();
  return source.includes('aws rds') || source.includes('gcp cloud sql');
}
function portBlocked(text, port) {
  const p = String(text || '').toLowerCase();
  return new RegExp(`${port}[^.;,]*(blocked|cannot|can't|closed)|(blocked|cannot|can't|closed)[^.;,]*${port}`).test(p);
}
function rangeBlocked(text, range) {
  const p = String(text || '').toLowerCase();
  return new RegExp(`(${range.start}|${range.end})[^.;,]*(blocked|cannot|can't|closed)|(blocked|cannot|can't|closed)[^.;,]*(${range.start}|${range.end})`).test(p);
}
function portsOpenForMiLink(inputs, data) {
  const ports = String(inputs.network_ports || '').toLowerCase();
  const endpoint = data.miLink.ports.sqlServerEndpoint;
  const hadr = data.miLink.ports.managedInstanceHadrRange;
  if (!ports || /not sure|unknown/.test(ports)) return false;
  if (portBlocked(ports, endpoint) || rangeBlocked(ports, hadr)) return false;
  return ports.includes(String(endpoint)) && (ports.includes(String(hadr.start)) || ports.includes(String(hadr.end)));
}
function normalizedDatabaseCount(inputs) {
  const count = Number(inputs.database_count);
  return Number.isFinite(count) && count > 0 ? count : undefined;
}
function miLinkCapacityForTier(tier, data) {
  if (/next-gen|next gen/i.test(String(tier || ''))) return data.miLink.capacityLinks.nextGenGeneralPurpose;
  if (/business critical/i.test(String(tier || ''))) return data.miLink.capacityLinks.businessCritical;
  if (/general purpose/i.test(String(tier || ''))) return data.miLink.capacityLinks.generalPurpose;
  return undefined;
}
function methodContradiction(scenario, actual, data) {
  const inputs = scenario.inputs || {};
  const target = actual.primaryTarget;
  if (target === 'provisional shortlist only') {
    return actual.recommendationStatus === 'provisional' ? null : 'provisional shortlist must carry recommendationStatus=provisional';
  }
  const key = TARGET_TO_KEY.get(target);
  if (!key) return `primaryTarget ${JSON.stringify(target)} is not a target in the eligibility map`;
  if (!ELIGIBLE_STATES.has(actual.eligibility?.[key])) return `primaryTarget ${target} has eligibility ${JSON.stringify(actual.eligibility?.[key])}`;
  const v = versionNumber(inputs.source_version);
  const method = actual.method;
  if (target === 'Azure SQL Managed Instance') {
    if (method === 'MI Link') {
      if (isManagedCloudSqlSource(inputs)) return 'MI Link selected for managed cloud SQL source';
      if (v && v < data.sourceVersionFloors.miLink.sqlServerMin) return `MI Link selected below SQL Server ${data.sourceVersionFloors.miLink.sqlServerMin}`;
      if (!portsOpenForMiLink(inputs, data)) return 'MI Link selected without required open ports 5022 and 11000-11999';
      const cap = miLinkCapacityForTier(actual.tier, data);
      const dbCount = normalizedDatabaseCount(inputs);
      if (dbCount && cap && dbCount > cap) return `MI Link selected with ${dbCount} databases over capacity ${cap}`;
      return null;
    }
    if (method === 'LRS') {
      const floor = data.sourceVersionFloors.standaloneLrs;
      if (v && (v < floor.sqlServerMin || v > floor.sqlServerMax)) return `LRS selected for SQL Server ${v}, outside ${floor.sqlServerMin}-${floor.sqlServerMax}`;
      return null;
    }
    if (method === 'Native backup/restore') return null;
    return `method ${JSON.stringify(method)} is not viable for Azure SQL Managed Instance`;
  }
  if (target === 'Azure SQL Database') {
    if (method === 'Transactional replication') {
      if (isManagedCloudSqlSource(inputs)) return 'Transactional replication selected for managed cloud SQL source';
      if (v && v < data.sourceVersionFloors.transactionalReplicationToSqlDb.publisherSqlServerMin) return `Transactional replication selected below SQL Server ${data.sourceVersionFloors.transactionalReplicationToSqlDb.publisherSqlServerMin}`;
      return null;
    }
    if (['BACPAC/SqlPackage', 'modern DMS (offline)', 'Data Box seed → sync delta'].includes(method)) return null;
    return `method ${JSON.stringify(method)} is not viable for Azure SQL Database`;
  }
  const methodAllow = {
    'SQL Server on Azure VM': ['Distributed AG or Always On AG', 'Log shipping', 'Native backup/restore', 'Standalone assessment / native backup/restore'],
    'Azure VMware Solution': ['VMware HCX / vMotion'],
    'SQL database in Fabric': ['Fabric Migration Assistant'],
    'Arc-enabled SQL Managed Instance': ['Native backup/restore after endpoint is available', 'Native backup/restore'],
    'SQL Server in a container': ['Backup/restore via mounted volume'],
    'SQL Server enabled by Azure Arc': ['Arc best-practices assessment']
  }[target] || [];
  return methodAllow.includes(method) ? null : `method ${JSON.stringify(method)} is not viable for ${target}`;
}
function outputConsistencyFailures(scenarios, data) {
  const failures = [];
  for (const s of scenarios) {
    const actual = evaluate(s.inputs || {});
    const primaryFailure = methodContradiction(s, actual, data);
    if (primaryFailure) failures.push(`${s.id}: ${primaryFailure}`);
    if (actual.alternativeTarget) {
      const altKey = TARGET_TO_KEY.get(actual.alternativeTarget);
      if (!altKey) failures.push(`${s.id}: alternativeTarget ${JSON.stringify(actual.alternativeTarget)} is not a target in the eligibility map`);
      else if (!ELIGIBLE_STATES.has(actual.eligibility?.[altKey])) failures.push(`${s.id}: alternativeTarget ${actual.alternativeTarget} has eligibility ${JSON.stringify(actual.eligibility?.[altKey])}`);
    }
  }
  return failures;
}

const rulesPath = rel('reference', 'decision-rules.md');
const skillPath = rel('skills', 'get-migration-assessment', 'SKILL.md');
const rules = readText(path.join('reference', 'decision-rules.md'));
const skill = readText(path.join('skills', 'get-migration-assessment', 'SKILL.md'));
const rulesData = JSON.parse(readText(path.join('reference', 'decision-rules.data.json')));
let scenarios = [];
try {
  scenarios = JSON.parse(readText(path.join('tests', 'golden-scenarios.json')));
  add('golden-scenarios-json', Array.isArray(scenarios) && scenarios.length >= 48, [`${Array.isArray(scenarios) ? scenarios.length : 0} scenarios loaded`]);
} catch (err) {
  add('golden-scenarios-json', false, [String(err)]);
}

{
  // Shape validation, separate from the count check above. A mistyped key would otherwise
  // leave a scenario in the file but out of the run, so it would look covered and never be.
  const { errors, unsupported, count } = validateGoldenScenarios();
  const details = errors.length
    ? errors
    : [`${count} scenarios match tests\\golden-scenarios.schema.json.`];
  for (const u of unsupported) details.push(`note: schema keyword not implemented by the validator: ${u}`);
  add('golden-scenarios-schema', errors.length === 0, details);
}

{
  const failures = [];
  let required = [];
  try {
    required = JSON.parse(readText(path.join('tests', 'required-scenarios.json')));
    if (!Array.isArray(required)) failures.push('tests\\required-scenarios.json must be an array');
  } catch (err) {
    failures.push(`could not parse tests\\required-scenarios.json: ${err.message || err}`);
  }
  const ids = new Set(scenarios.map(s => s.id));
  const seenRequired = new Set();
  for (const entry of required) {
    if (!entry?.id) {
      failures.push(`required scenario entry is missing id: ${JSON.stringify(entry)}`);
      continue;
    }
    if (seenRequired.has(entry.id)) failures.push(`${entry.id}: duplicate required-scenarios entry`);
    seenRequired.add(entry.id);
    if (!entry.reason) failures.push(`${entry.id}: required-scenarios entry must include a one-line reason`);
    if (!ids.has(entry.id)) failures.push(`${entry.id}: missing from tests\\golden-scenarios.json — ${entry.reason || 'no reason supplied'}`);
  }
  add('required-scenarios-registry', failures.length === 0, failures.length ? failures : [`${required.length} required scenarios are present in tests\\golden-scenarios.json.`]);
}

{
  const failures = [];
  const targetCounts = new Map();
  const availabilityValues = new Set();
  for (const s of scenarios) {
    try {
      const actual = evaluate(s.inputs || {});
      targetCounts.set(actual.primaryTarget, (targetCounts.get(actual.primaryTarget) || 0) + 1);
      availabilityValues.add(actual.targetAvailabilityDuringSync);
      const scenarioFailures = compareExpected(s, actual);
      if (scenarioFailures.length) failures.push(`${s.id}: ${scenarioFailures.join('; ')}`);
    } catch (err) {
      failures.push(`${s.id}: engine threw ${err.stack || err}`);
    }
  }
  add('golden-decision-outcomes', failures.length === 0, failures.length ? failures : [`Executed ${scenarios.length} scenarios against tests\\engine\\evaluate.mjs.`], { executedScenarios: scenarios.length });
}

{
  const failures = outputConsistencyFailures(scenarios, rulesData);
  add('output-consistency-invariant', failures.length === 0, failures.length ? failures : [`Checked ${scenarios.length} scenarios: primary/alternative targets agree with eligibility and selected methods pass gates.`], { checkedScenarios: scenarios.length });
}

{
  const targetCounts = {};
  const methodCounts = {};
  const availabilityCounts = {};
  for (const s of scenarios) {
    const actual = evaluate(s.inputs || {});
    targetCounts[actual.primaryTarget] = (targetCounts[actual.primaryTarget] || 0) + 1;
    methodCounts[actual.method] = (methodCounts[actual.method] || 0) + 1;
    availabilityCounts[actual.targetAvailabilityDuringSync] = (availabilityCounts[actual.targetAvailabilityDuringSync] || 0) + 1;
  }
  const maxTarget = Math.max(0, ...Object.values(targetCounts));
  const maxTargetShare = scenarios.length ? maxTarget / scenarios.length : 0;
  const distinctMethods = Object.keys(methodCounts).length;
  const availabilityDistinct = Object.keys(availabilityCounts).length;
  const failures = [];
  if (maxTargetShare > MAX_TARGET_SHARE) failures.push(`primary_target distribution collapsed: max share ${maxTarget}/${scenarios.length} = ${maxTargetShare.toFixed(3)} > ${MAX_TARGET_SHARE}; ${JSON.stringify(targetCounts)}`);
  if (distinctMethods < MIN_DISTINCT_METHODS) failures.push(`method diversity ${distinctMethods} < ${MIN_DISTINCT_METHODS}; ${JSON.stringify(methodCounts)}`);
  if (availabilityDistinct < MIN_DISTINCT_AVAILABILITY_VALUES) failures.push(`targetAvailabilityDuringSync diversity ${availabilityDistinct} < ${MIN_DISTINCT_AVAILABILITY_VALUES}; ${JSON.stringify(availabilityCounts)}`);
  add('decision-distribution-sanity', failures.length === 0, failures.length ? failures : [
    `primary_target max share ${maxTarget}/${scenarios.length} = ${maxTargetShare.toFixed(3)} <= ${MAX_TARGET_SHARE}; distribution ${JSON.stringify(targetCounts)}`,
    `distinct methods ${distinctMethods} >= ${MIN_DISTINCT_METHODS}; distribution ${JSON.stringify(methodCounts)}`,
    `distinct targetAvailabilityDuringSync values ${availabilityDistinct} >= ${MIN_DISTINCT_AVAILABILITY_VALUES}; distribution ${JSON.stringify(availabilityCounts)}`
  ]);
}

{
  const requiredMustNot = new Map([
    ['mi-link-11000-blocked-falls-to-lrs', 'MI Link'],
    ['port-5022-blocked-no-mi-link-lrs-in', 'MI Link'],
    ['aws-rds-to-mi-near-zero-no-mi-link', 'MI Link'],
    ['gcp-cloud-sql-no-mi-link', 'MI Link'],
    ['retired-tooling-never-current-recommendation', 'DMS classic']
  ]);
  const failures = [];
  for (const [id, forbidden] of requiredMustNot) {
    const scenario = scenarios.find(s => s.id === id);
    if (!scenario) failures.push(`${id}: missing scenario`);
    else if (!(scenario.expect?.mustNotRecommend || []).includes(forbidden)) failures.push(`${id}: mustNotRecommend must include ${forbidden}`);
  }
  add('must-not-recommend-metadata', failures.length === 0, failures.length ? failures : ['Required must-not-recommend guards are populated.']);
}

{
  const files = [rel('skills','get-migration-assessment','SKILL.md'), rel('reference','decision-rules.md'), rel('docs','sql-server-to-azure-migration.md')]
    .concat(walk(rel('examples'), () => true))
    .concat(walk(rel('tools','diagram'), p => p.toLowerCase().endsWith('.html')));
  const failures = [];
  const forbidden = [
    { id: 'wrong replication range', re: /2016[–-]2019/u },
    { id: 'unsourced TDE statistic', re: /~80%|fails\s+~80/iu },
    { id: 'unsourced dependency statistic', re: /~60%/u },
    { id: 'unsourced landing-zone statistic', re: /~4x|4x\s+faster/iu },
    { id: 'undocumented sql_variant claim', re: /sql_variant/iu },
    { id: 'old MI Link 10 database capacity', re: /MI Link[^\n]*(?:up to\s*)?10\s+(?:simultaneous\s+)?(?:databases|dbs|links)|(?:up to\s*)?10\s+(?:simultaneous\s+)?(?:databases|dbs|links)[^\n]*MI Link/iu, allow: /wizard|portal|batch|selection limit|not MI Link capacity/iu },
    // LRS is not a universal fallback: it supports SQL Server 2008-2022 and has a 30-day
    // window. This was corrected in one place in v1.9 and left standing in another, so the
    // weekly review reported it again. The qualifier must travel with the recommendation.
    { id: 'unconditional LRS fallback', re: /(?:choose|use|fall back to|falls back to|fallback to)\s+LRS/iu, allow: /only when|only if|qualifies|2008[–-]2022|30-day|not a legal fallback|gates? pass/iu },
    // Same shape, second offender: MI Link is scoped to Azure SQL Managed Instance. Saying an
    // Arc-enabled SQL MI endpoint makes the MI methods apply pulls MI Link in by implication,
    // which is how this survived the v1.9 fix to the section 8 matrix.
    { id: 'MI Link implied for Arc-enabled SQL MI', re: /Arc-enabled SQL M(?:I|anaged Instance)[^\n]*(?:MI Link|vehicles of|methods of §?5\.2)/iu, allow: /not supported|not applicable|does not|never|Windows Server only/iu },
    // Microsoft requires port 135 in BOTH directions for MI managed DTC. Grouping it with the
    // inbound-only set is how the rules read until v1.12, and a team following that literally
    // opens 135 inbound only, so MI-initiated calls to the participant's RPC endpoint mapper
    // fail after cutover.
    { id: 'DTC port 135 without its outbound direction', re: /135[^\n]*14000[–-]15000\s+inbound|ports?\s+135\s+(?:and|,)[^\n]*inbound/iu, allow: /both inbound and outbound|inbound and outbound/iu },
    // AHB on Hyperscale is a creation-date cohort, not an "existing database" rule. Without the
    // 15 December 2023 qualifier the engine flags newer Hyperscale databases as AHB-eligible
    // and mis-prices the migration, which is the permissive direction.
    { id: 'AHB Hyperscale without its creation-date qualifier', re: /Hyperscale[^\n]*(?:can continue|continue to)\s+us(?:e|ing)\s+(?:Azure Hybrid Benefit|AHB)|(?:existing|older)\s+Hyperscale[^\n]*AHB/iu, allow: /15 Dec(?:ember)? 2023|December 15, 2023/iu },
    // SQL MI tops out far below 128 TB, so it is not an as-is destination for a single database
    // above the Hyperscale ceiling. v1.9 fixed the knowledge base and left SKILL.md standing.
    { id: 'SQL MI offered as an as-is destination above 128 TB', re: /above 128 TB[^\n]*(?:SQL MI|Managed Instance)|128 TB[^\n]*moved to SQL MI/iu, allow: /not\b[^\n]*as-is|is \*\*not\*\*|far below|shard/iu },
    // v1.12 removed a "Windows Server 2016+" floor as unsourced and concluded there is no floor at
    // all. The premise was right, the conclusion wrong: Microsoft's link Limitations state "You must
    // host SQL Server instances on Windows Server 2012 or later", because Windows 10 and 11 clients
    // cannot enable Always On availability groups. Worse, v1.13 added a gate forbidding any floor,
    // so the repository protected its own error for five versions. This gate is inverted: the wrong
    // floors are forbidden, and a separate check below requires the correct one to be stated.
    { id: 'MI Link gated on the wrong Windows Server floor', re: /Win(?:dows)?\s*(?:Server|Srv)\s*20(?:1[4-9]|2\d)\s*\+/iu, allow: /Windows Server only|Arc-driven|Arc portal|SQL Server/iu },
    { id: 'claims Microsoft publishes no Windows Server floor for MI Link', re: /(?:publishes|states|documents) no (?:separate )?Windows Server (?:version )?floor|do not invent one/iu },
    // The ESU programme covers SQL Server 2014 and 2016 only. "2014 and earlier" implies a free
    // Azure ESU for 2012 and 2008 that ended in July 2023, which is the permissive direction: it
    // tells a customer they are covered when they are not. v1.12 fixed Step D1 and the knowledge
    // base and left the Step A1 eligibility row standing.
    { id: 'ESU described as covering 2014 and earlier', re: /ESU[^\n]*2014 (?:and|or) earlier|2014 (?:and|or) earlier[^\n]*ESU/iu },
    // The knowledge base records transactional replication as an Online path to Fabric SQL
    // database, yet the section 12 summary matrix still rated its minimum downtime as hours.
    // A summary that contradicts the detail row silently eliminates Fabric for low-downtime
    // migrations, and the summary is what a reader skims.
    { id: 'Fabric SQL DB minimum downtime summarised as hours-only', re: /Min\.\s*downtime achievable[^\n]*\|\s*~?h\s*\|/iu, allow: /transactional replication/iu },
    // Azure Migrate is GA, but its Arc-based agentless discovery is Preview. Offering the three
    // discovery paths as interchangeable recommends a preview service to customers who forbid
    // them, which is the permissive direction.
    { id: 'Azure Migrate Arc discovery offered without its Preview status', re: /Azure Migrate\**\s*appliance[/ ]?(?:or )?import\/?Arc(?:-based)? (?:agentless )?discovery/iu, allow: /Preview/iu }
  ];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split(/\r?\n/);
    lines.forEach((line, i) => {
      // A changelog row states what a past version claimed, so it has to be allowed to quote the
      // very wording later versions forbid. Rewording history to satisfy a gate would falsify the
      // record, which is worse than the gate it satisfies.
      const isChangelogRow = /^\|\s*v\d+\.\d+\s*\|/.test(line.trim());
      if (!isChangelogRow) {
        for (const f of forbidden) if (f.re.test(line) && !(f.allow && f.allow.test(line))) failures.push(`${fileLine(file, i + 1)} ${f.id}: ${line.trim()}`);
      }
      const isAuthoritativeRuleFile = !file.includes(`${path.sep}tools${path.sep}`) && !file.includes(`${path.sep}examples${path.sep}`);
      if (isAuthoritativeRuleFile && /MI Link/i.test(line) && /\bports?\b|5022/i.test(line) && !/11000/.test(line) && !/managed DTC|DTC ports|Retired|ports below|Worked case/i.test(line)) failures.push(`${fileLine(file, i + 1)} MI Link ports mention omits 11000-11999: ${line.trim()}`);
      const retiredContext = /retired|unavailable|deprecated|replaced|do not recommend|never recommend|use instead/i.test(line);
      const recommendsDea = /\b(run|use|recommend|capture)\s+(?:retired\s+)?DEA\b|\bDEA\s+capture\b/i.test(line);
      const recommendsReplay = /\b(run|use|recommend)\s+Distributed Replay\b|Distributed Replay\s+(?:capture|replay)/i.test(line);
      if ((recommendsDea || recommendsReplay) && !retiredContext) failures.push(`${fileLine(file, i + 1)} retired validation tool recommended: ${line.trim()}`);
    });
  }
  // A forbidden-pattern list can only prove an error is absent. This proves the correction is
  // present: Microsoft requires Windows Server 2012 or later to host the link, and the repository
  // spent five versions claiming no floor exists at all. Silence here is exactly what let that
  // survive, so the floor must be stated in each authoritative document.
  {
    const floor = rulesData.sourceVersionFloors.miLink.windowsServerMin;
    const re = new RegExp(`Windows Server ${floor}(?: or later|\\+)`, 'iu');
    for (const [label, text] of [['reference\\decision-rules.md', rules], ['skills/get-migration-assessment/SKILL.md', skill], ['docs\\sql-server-to-azure-migration.md', readText(path.join('docs', 'sql-server-to-azure-migration.md'))]]) {
      if (!re.test(text)) failures.push(`${label} does not state the MI Link host floor Windows Server ${floor} or later`);
    }
  }
  add('forbidden-patterns', failures.length === 0, failures.length ? failures : ['No forbidden anti-regression patterns found; the MI Link Windows Server floor is stated in all three rule documents.']);
}

{
  const check = spawnSync(process.execPath, [rel('tools','rules','check-rules-data.mjs')], { cwd: root, encoding: 'utf8' });
  const details = [];
  if (check.stdout.trim()) details.push(...check.stdout.trim().split(/\r?\n/));
  if (check.stderr.trim()) details.push(...check.stderr.trim().split(/\r?\n/));
  add('rules-data-consistency', check.status === 0, details.length ? details : [`exit ${check.status}`], { exitCode: check.status });
}

{
  const check = spawnSync(process.execPath, [rel('tools','weekly-check','check-consistency.mjs')], { cwd: root, encoding: 'utf8' });
  const details = [];
  if (check.stdout.trim()) details.push(...check.stdout.trim().split(/\r?\n/));
  if (check.stderr.trim()) details.push(...check.stderr.trim().split(/\r?\n/));
  add('version-consistency', check.status === 0, details.length ? details : [`exit ${check.status}`], { exitCode: check.status });
}

{
  const missing = [];
  for (const s of scenarios) {
    for (const pattern of s.assertRulePresent || []) {
      if (!locatePattern(rules, pattern)) missing.push(`${s.id}: ${pattern}`);
    }
  }
  add('golden-rule-presence', missing.length === 0, missing.length ? missing.map(m => `reference\\decision-rules.md missing ${m}`) : [`All rule anchors found for ${scenarios.length} scenarios.`]);
}

{
  const section = (rules.match(/### A0\. Required input normalization[\s\S]*?### A1\./u) || [''])[0];
  const declared = new Set([...section.matchAll(/`([a-z_]+)`/g)].map(m => m[1]));
  const skillNorm = norm(skill);
  const failures = [];
  for (const key of declared) {
    if (!skillNorm.includes(norm(key))) {
      const aliases = {
        downtime: ['downtime tolerance'],
        network_ports: ['network path and ports', 'ports'],
        size: ['largest db size'],
        tenant_count: ['tenants', 'tenant variability'],
        performance: ['tier drivers', 'iops', 'latency'],
        compliance: ['compliance sovereignty'],
        fabric_constraints: ['fabric', 'private link', 'gateway'],
        kubernetes_model: ['kubernetes engine model', 'managed engine', 'full diy container'],
        database_count: ['number of databases', 'database count', 'one link/database'],
        migration_batch_size: ['10 databases per batch', 'wizard selection limit'],
        arc_extension_version: ['Azure Extension for SQL Server', '1.1.3348.364'],
        evidence: ['recommendation evidence', 'validated requires']
      }[key] || [];
      if (!aliases.some(a => skillNorm.includes(norm(a)))) failures.push(`SKILL.md does not collect normalized input ${key}`);
    }
  }
  for (const s of scenarios) {
    for (const key of Object.keys(s.inputs || {})) {
      if (!declared.has(key)) failures.push(`${s.id}: input key '${key}' is not declared in reference\\decision-rules.md A0`);
      const aliases = key === 'downtime' ? ['downtime tolerance'] : key === 'network_ports' ? ['network path and ports','ports'] : key === 'size' ? ['largest db size'] : key === 'tenant_count' ? ['tenants','tenant variability'] : key === 'performance' ? ['tier drivers','iops','latency'] : key === 'compliance' ? ['compliance','sovereignty'] : key === 'fabric_constraints' ? ['fabric','private link','gateway'] : key === 'kubernetes_model' ? ['kubernetes engine model','managed engine','full diy container'] : key === 'database_count' ? ['number of databases','database count','one link/database'] : key === 'migration_batch_size' ? ['10 databases per batch','wizard selection limit'] : key === 'arc_extension_version' ? ['Azure Extension for SQL Server','1.1.3348.364'] : key === 'evidence' ? ['recommendation evidence','validated requires'] : [];
      if (!skillNorm.includes(norm(key)) && !aliases.some(a => skillNorm.includes(norm(a)))) failures.push(`${s.id}: SKILL.md cannot collect input '${key}'`);
    }
  }
  add('branch-reachability', failures.length === 0, failures.length ? [...new Set(failures)] : [`${declared.size} normalized inputs are declared and reachable from SKILL.md.`]);
}

{
  const required = [
    /unknown_requires_assessment/u,
    /do \*\*not\*\* silently pick the safer target/iu,
    /`recommendationStatus` is always `provisional`/u,
    /Never turn an unknown into a silent safe default/u,
    /If a tier-driving input is missing, emit `unknown_requires_assessment`/u
  ];
  const missing = required.filter(re => !re.test(rules)).map(re => String(re));
  add('no-silent-defaults', missing.length === 0, missing.length ? missing : ['Unknown decision-driving inputs produce assessment/provisional status, not defaults.']);
}

{
  // The engine keeps guards that a normal run cannot reach: chooseTarget only ever emits
  // a target and method that already satisfy each other, and sql_vm is never marked
  // unsupported, so the per-target method rejections and the fallback's later candidates
  // never fire. A coverage report calls them dead. They are not dead, they are a net, and
  // a net nobody has ever tested is a net nobody should rely on. This exercises them
  // directly, so removing a guard fails the suite instead of quietly widening the engine.
  const { methodGateFailure, chooseConsistentFallback, chooseTarget, TARGET_LABELS, E, MI_LINK } = guards;
  const fresh = () => ({ hardBlockers: [], unknowns: [], evidenceRequired: [], exclusions: {} });
  const onPrem = { source_location: 'on-prem / Azure VM', source_version: '2019', source_os: 'Windows Server 2019', source_edition: 'Enterprise' };
  const failures = [];
  const expect = (label, actual, predicate) => { if (!predicate(actual)) failures.push(`${label}: got ${JSON.stringify(actual)}`); };

  expect('MI rejects an unknown method',
    methodGateFailure(onPrem, TARGET_LABELS.sql_mi, 'BACPAC/SqlPackage', fresh()),
    v => typeof v === 'string' && v.includes('not a supported Azure SQL Managed Instance migration method'));
  expect('SQL DB rejects an unknown method',
    methodGateFailure(onPrem, TARGET_LABELS.sql_db, 'MI Link', fresh()),
    v => typeof v === 'string' && v.includes('not a supported Azure SQL Database migration method'));
  expect('MI Link names both port requirements when they are blocked',
    methodGateFailure({ ...onPrem, network_ports: '5022 blocked' }, TARGET_LABELS.sql_mi, 'MI Link', fresh()),
    v => typeof v === 'string' && v.includes(String(MI_LINK.ports.sqlServerEndpoint)) && v.includes(String(MI_LINK.ports.managedInstanceHadrRange.end)));
  expect('an unhandled target is not rejected',
    methodGateFailure(onPrem, 'Some target the rules do not model', 'any method', fresh()),
    v => v === null);
  // Defence in depth on the availability-group floor. chooseVmMethod no longer selects AG below
  // SQL Server 2012, so this rejection is unreachable through evaluate(); it is the second lock,
  // and the one that would catch a future selector that forgets the floor.
  expect('the AG floor is refused even when a method chooser proposes it',
    methodGateFailure({ ...onPrem, source_version: '2008/2008 R2' }, TARGET_LABELS.sql_vm, 'Distributed AG or Always On AG', fresh()),
    v => typeof v === 'string' && v.includes('Always On availability groups require SQL Server'));

  // sql_vm unsupported forces the loop past its first candidate, which is the branch a
  // normal run can never take.
  const out1 = fresh();
  expect('the fallback skips an ineligible candidate and takes the next',
    chooseConsistentFallback({ ...onPrem, downtime: 'offline' }, { sql_vm: E.UNSUPPORTED, sql_db: E.ELIGIBLE, sql_mi: E.UNSUPPORTED }, out1),
    v => Array.isArray(v) && v[0] === TARGET_LABELS.sql_db);

  const out2 = fresh();
  expect('the fallback returns the shortlist when nothing qualifies',
    chooseConsistentFallback({ ...onPrem, downtime: 'offline' }, { sql_vm: E.UNSUPPORTED, sql_db: E.UNSUPPORTED, sql_mi: E.UNSUPPORTED }, out2),
    v => Array.isArray(v) && v[0] === 'provisional shortlist only');
  expect('exhausting the fallback records the assessment to run',
    out2.evidenceRequired,
    v => v.some(e => /Azure Migrate \/ Arc assessment/.test(e)));

  // A rejected candidate must say why, otherwise the exclusion map loses the reason. SQL Server
  // 2025 with a short window is the case: MI Link needs ports nobody confirmed, and LRS stops at
  // 2022, so the fallback has to reject something and record it.
  const out3 = fresh();
  chooseConsistentFallback({ ...onPrem, source_version: '2025', downtime: 'minimal' },
    { sql_vm: E.UNSUPPORTED, sql_db: E.UNSUPPORTED, sql_mi: E.ELIGIBLE }, out3);
  expect('a rejected fallback candidate records its exclusion',
    Object.keys(out3.exclusions),
    v => v.some(k => k.endsWith('_method')));

  // chooseTarget ends on a terminal return that the current rules can never reach:
  // applyFabric always leaves fabric_sql_db as unknown, eligible or remediate, and each
  // of those returns earlier. The terminal return is what stops the function returning
  // undefined if that ever stops being true, so it is exercised through a crafted map.
  const out4 = { ...fresh(), fabricIndicated: true };
  expect('chooseTarget still answers when no earlier branch claims the case',
    chooseTarget({ ...onPrem, source_version: '2022', downtime: 'offline', feature_dependencies: ['None'], size: '2 TB' },
      { sql_vm: E.ELIGIBLE, avs: E.UNSUPPORTED, sql_mi: E.ELIGIBLE, sql_db: E.ELIGIBLE,
        fabric_sql_db: E.UNSUPPORTED, arc_sql_mi: E.UNSUPPORTED, container: E.UNSUPPORTED, arc_in_place: E.UNSUPPORTED },
      out4),
    v => Array.isArray(v) && v[0] === TARGET_LABELS.sql_db && typeof v[1] === 'string' && v[1].length > 0);

  add('engine-guard-checks', failures.length === 0,
    failures.length ? failures : ['10 unreachable-by-design guards exercised directly: method rejections, port message, unhandled target, the fallback skip, exhaustion and exclusion paths, and the chooseTarget terminal return.']);
}

{
  // Round-trip gate: every option SKILL.md displays must reach a rule. The suite used to speak
  // the mirror's own dialect ("assessment-only", "analytics/Fabric") while the interview showed
  // "Assessment only" and "Analytics / Fabric unification", so 86 green scenarios coexisted with
  // an interview whose answers the engine did not recognise. This walks the displayed labels.
  const { OPTION_IDS, LABEL_TO_ID, normalizeInputs } = guards;
  const failures = [];

  // 1. Every ID in SKILL.md is known to the engine, and every engine ID is documented.
  const declaredInSkill = new Set([...skill.matchAll(/\*\*`([A-Z][A-Z0-9_]+)`\*\*/g)].map(m => m[1]));
  for (const id of declaredInSkill) if (!(id in OPTION_IDS)) failures.push(`SKILL.md offers option ID ${id}, which the engine does not know`);
  for (const id of Object.keys(OPTION_IDS)) if (!declaredInSkill.has(id)) failures.push(`the engine knows option ID ${id}, which SKILL.md never offers`);

  // 2. Every mapped label expands to the same normalized text as its ID, so the label a user
  //    sees and the ID a script sends cannot diverge.
  for (const [label, id] of Object.entries(LABEL_TO_ID)) {
    const viaLabel = normalizeInputs({ intent: label }).intent;
    const viaId = normalizeInputs({ intent: id }).intent;
    if (String(viaLabel).toLowerCase().includes(OPTION_IDS[id].toLowerCase()) === false) failures.push(`label "${label}" does not expand to the ${id} rule vocabulary`);
    if (String(viaId).includes(OPTION_IDS[id]) === false) failures.push(`ID ${id} does not expand to its own rule vocabulary`);
  }

  // 3. The four options the external audit found unconsumed must now change the answer.
  const base = { source_location: 'On-prem', source_version: '2017/2019', management_model: 'Fully managed PaaS', feature_dependencies: ['None'], downtime: 'offline' };
  const decides = [
    ['Large estate (10+ servers/DBs)', { ...base, intent: 'Move to Azure now', scope: 'Large estate (10+ servers/DBs)' }, /Azure Migrate/],
    ['Assessment only', { ...base, intent: 'Assessment only' }, /Arc best-practices assessment/],
    ['Analytics / Fabric unification', { ...base, intent: 'Move to Azure now', driver: 'Analytics / Fabric unification' }, /Fabric/],
    ['LARGE_ESTATE', { ...base, intent: 'MIGRATE_NOW', scope: 'LARGE_ESTATE' }, /Azure Migrate/],
    ['ASSESSMENT_ONLY', { ...base, intent: 'ASSESSMENT_ONLY' }, /Arc best-practices assessment/],
    ['FABRIC_ANALYTICS', { ...base, intent: 'MIGRATE_NOW', driver: 'FABRIC_ANALYTICS' }, /Fabric/]
  ];
  for (const [label, inputs, expected] of decides) {
    const r = evaluate(inputs);
    const seen = `${r.primary_target} ${r.method}`;
    if (!expected.test(seen)) failures.push(`the displayed option "${label}" does not reach its rule: got "${seen}"`);
  }

  add('interview-round-trip', failures.length === 0,
    failures.length ? failures : [`${declaredInSkill.size} option IDs are declared in SKILL.md, known to the engine, and every mapped label reaches the same rule as its ID.`]);
}

{
  // The cross-cloud matrix is 25 of the 61 leaf constants the engine never reads: it implements
  // those rules in code instead. Editing the data would therefore change nothing and no test
  // would fail, which is the quiet kind of drift. Until the engine reads the matrix directly,
  // this replays it: for every source and method the data marks unsupported, the engine must
  // refuse it, and for every one marked eligible it must not refuse it outright.
  const matrix = rulesData.crossCloudEligibility;
  const methodLabels = {
    miLink: ['Azure SQL Managed Instance', 'MI Link'],
    lrs: ['Azure SQL Managed Instance', 'LRS'],
    transactionalReplication: ['Azure SQL Database', 'Transactional replication']
  };
  const failures = [];
  let checked = 0;
  for (const [source, methods] of Object.entries(matrix)) {
    for (const [method, verdict] of Object.entries(methods)) {
      const pair = methodLabels[method];
      if (!pair) continue;
      const inputs = {
        source_location: source, source_version: '2019',
        source_os: 'Windows Server 2019', source_edition: 'Enterprise',
        network_ports: '5022 open and 11000-11999 open'
      };
      const reason = guards.methodGateFailure(inputs, pair[0], pair[1], { exclusions: {}, unknowns: [], evidenceRequired: [] });
      const dataSaysUnsupported = /^unsupported/.test(String(verdict));
      checked += 1;
      if (dataSaysUnsupported && !reason) failures.push(`${source} / ${method}: the rules data says "${verdict}" but the engine accepts it`);
      if (!dataSaysUnsupported && reason) failures.push(`${source} / ${method}: the rules data says "${verdict}" but the engine refuses it — ${reason}`);
    }
  }
  add('cross-cloud-matrix-honoured', failures.length === 0,
    failures.length ? failures : [`${checked} source/method combinations from crossCloudEligibility replayed against the engine.`]);
}

{
  // The contracts are only worth having if the skill and the rules actually defer to them.
  // A contract nobody references is a fourth copy of the vocabulary, which is the problem it
  // was created to solve.
  const inputContract = readText(path.join('reference', 'input-contract.md'));
  const outputContract = readText(path.join('reference', 'output-contract.md'));
  const failures = [];

  // 1. The skill points at both contracts rather than restating them.
  if (!/input-contract\.md/.test(skill)) failures.push('SKILL.md does not reference reference/input-contract.md');
  if (!/output-contract\.md/.test(skill)) failures.push('SKILL.md does not reference reference/output-contract.md');

  // 2. Every option ID the engine knows is documented in the input contract, and vice versa.
  for (const id of Object.keys(guards.OPTION_IDS)) {
    if (!new RegExp(`\\b${id}\\b`).test(inputContract)) failures.push(`input-contract.md does not document option ID ${id}`);
  }
  // Option IDs use an underscore or a digit, which separates them from product names written
  // in capitals such as FILESTREAM, DTC or TDE. Those are feature names, not option IDs.
  const contractIds = new Set([...inputContract.matchAll(/`([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)`/g)].map(m => m[1]));
  const vocabulary = new Set(['NONE_CONFIRMED', 'UNKNOWN', 'NOT_APPLICABLE', 'UPPER_SNAKE_CASE']);
  for (const id of contractIds) {
    if (vocabulary.has(id) || id in guards.OPTION_IDS) continue;
    failures.push(`input-contract.md documents option ID ${id}, which the engine does not know`);
  }

  // 3. Every field the engine reads is documented, with its unknown behaviour.
  const engineSource = readText(path.join('tests', 'engine', 'evaluate.mjs'));
  const engineFields = [...new Set([...engineSource.matchAll(/inputs\.([a-z_][A-Za-z0-9_]*)/g)].map(m => m[1]))];
  for (const f of engineFields) {
    if (!new RegExp(`\`${f}\``).test(inputContract)) failures.push(`input-contract.md does not document the field ${f}, which the engine reads`);
  }

  // 4. The three answer states are defined and distinguished.
  for (const state of ['NONE_CONFIRMED', 'UNKNOWN', 'NOT_APPLICABLE']) {
    if (!inputContract.includes(state)) failures.push(`input-contract.md does not define ${state}`);
  }

  // 5. The output contract forbids what the skill can no longer claim, and requires the self-check.
  if (!/`provisional`\s*—\s*\*\*the only value/.test(outputContract)) failures.push('output-contract.md does not state that provisional is the only status');
  if (!/Self-check, before rendering/.test(outputContract)) failures.push('output-contract.md does not define the pre-render self-check');
  if (!/do not repair the output silently/i.test(outputContract)) failures.push('output-contract.md does not forbid silently repairing a failed invariant');
  if (!/Self-check/i.test(skill)) failures.push('SKILL.md Operations does not include the self-check step');

  add('contracts-wired', failures.length === 0,
    failures.length ? failures : [`${Object.keys(guards.OPTION_IDS).length} option IDs and ${engineFields.length} engine fields are documented in the input contract; the skill defers to both contracts and runs the self-check.`]);
}

{
  // The direction nobody was checking. `rule-index-consistent` proves every rule consumes a
  // documented field; `interview-round-trip` proves the engine and the skill agree. Neither
  // proves the *interview* speaks the contract, so a real session answered in IDs the contract
  // had never heard of -- six of ten sampled -- while every gate stayed green.
  const inputContract = readText(path.join('reference', 'input-contract.md'));
  const failures = [];

  // Every option ID the interview offers must be defined in the contract.
  const offered = new Set([...skill.matchAll(/\*\*`([A-Z][A-Z0-9_]{2,})`\*\*/gu)].map(m => m[1]));
  for (const id of offered) {
    if (!new RegExp(`\`${id}\``, 'u').test(inputContract)) failures.push(`the interview offers ${id}, which input-contract.md does not define`);
  }

  // Every canonical field the interview names must be defined too. Fields appear in the
  // questions as `field_name`, which is how the contract writes them.
  const RESERVED = new Set(['unknown_requires_assessment', 'none_confirmed', 'not_applicable', 'eligible_with_remediation',
    'excluded_by_preference', 'ask_user', 'web_fetch', 'allowed_tools']);
  const named = new Set([...skill.matchAll(/`([a-z][a-z0-9]*_[a-z0-9_]+)`/gu)].map(m => m[1]).filter(f => !RESERVED.has(f)));
  for (const field of named) {
    if (!new RegExp(`\`${field}\``, 'u').test(inputContract)) failures.push(`the interview names field '${field}', which input-contract.md does not define`);
  }

  // The three list-or-none questions that separate "none" from "not checked" must keep all three answers.
  for (const intent of ['LIST_FEATURES', 'LIST_SERVICES', 'LIST_TIER_DRIVERS']) {
    if (!offered.has(intent)) failures.push(`${intent} is no longer offered, so a list question can collapse "none" into "not checked" again`);
  }

  // The invariant count is quoted in five documents. A number stated once and never rechecked is
  // exactly how "18 gates" and "9 invariants" survived past the releases that changed them.
  const invariantCount = (readText(path.join('reference', 'output-contract.md')).match(/^\| \d+ \| /gmu) || []).length;
  for (const doc of ['README.md', path.join('howto', 'how-the-skill-works.md'), path.join('blume', 'docs', 'index.mdx'), path.join('docs', 'sql-migration-advisor-developer-pitch.md')]) {
    const text = readText(doc);
    for (const m of text.matchAll(/(\d+|nine|ten) (?:pre-render self-check |self-check )?invariants/giu)) {
      // Changelog rows record what was true at the time and must not be rewritten.
      const line = text.slice(text.lastIndexOf('\n', m.index) + 1, text.indexOf('\n', m.index));
      if (/^\| v[0-9]/u.test(line)) continue;
      const stated = /^\d+$/u.test(m[1]) ? Number(m[1]) : { nine: 9, ten: 10 }[m[1].toLowerCase()];
      if (stated !== invariantCount) failures.push(`${doc} claims ${m[1]} invariants; the output contract defines ${invariantCount}`);
    }
  }

  // The gate count is quoted in five documents and has been wrong in three of them at least twice.
  // Counting it here is cheaper than remembering. Count distinct names, not add() calls: one gate
  // is registered twice, in a try and its catch, and only ever runs once.
  const gateCount = new Set([...readText(path.join('tests', 'run-tests.mjs')).matchAll(/^\s*add\('([a-z0-9-]+)'/gmu)].map(m => m[1])).size;
  const scenarioCount = scenarios.length;
  const QUOTED = ['README.md', 'CONTRIBUTING.md', path.join('howto', 'how-the-skill-works.md'), path.join('blume', 'docs', 'index.mdx'), path.join('docs', 'sql-migration-advisor-developer-pitch.md'), path.join('tests', 'README.md')];
  for (const doc of QUOTED) {
    const text = readText(doc);
    const check = (re, actual, what) => {
      for (const m of text.matchAll(re)) {
        const line = text.slice(text.lastIndexOf('\n', m.index) + 1, text.indexOf('\n', m.index));
        if (/^\| v[0-9]/u.test(line)) continue; // changelog rows record what was true then
        if (Number(m[1]) !== actual) failures.push(`${doc} claims ${m[1]} ${what}; there are ${actual}`);
      }
    };
    check(/(\d+) gates/giu, gateCount, 'gates');
    check(/(\d+) (?:golden )?scenarios/giu, scenarioCount, 'scenarios');
  }

  add('interview-conforms-to-contract', failures.length === 0,
    failures.length ? failures : [`${offered.size} option IDs and ${named.size} field names offered by the interview are defined in the input contract, and ${invariantCount} invariants, ${gateCount} gates and ${scenarioCount} scenarios are quoted consistently.`]);
}

{
  // A version manifest that nobody updates is worse than none: it tells every user they are current
  // while the repository moves on. This gate is the only thing standing between that and a lie.
  const failures = [];
  const manifestPath = path.join('version.json');
  let manifest = null;
  try { manifest = JSON.parse(readText(manifestPath)); }
  catch { failures.push('version.json is missing or is not valid JSON'); }

  if (manifest) {
    // The coordinated line lives in SKILL.md, e.g. "knowledge-base line: **v2.1**".
    const line = skill.match(/knowledge-base line:\s*\*\*(v[0-9]+\.[0-9]+)\*\*/u);
    if (!line) failures.push('SKILL.md no longer states the coordinated knowledge-base line');
    else if (manifest.knowledgeBase !== line[1]) {
      failures.push(`version.json says knowledgeBase ${manifest.knowledgeBase}, SKILL.md says ${line[1]}`);
    }
    // `latest` must be the release built from this KB line, so v2.1 pairs with v2.1.x.
    if (!/^v[0-9]+\.[0-9]+\.[0-9]+$/u.test(manifest.latest || '')) {
      failures.push(`version.json latest '${manifest.latest}' is not a vMAJOR.MINOR.PATCH release tag`);
    } else if (manifest.knowledgeBase && !manifest.latest.startsWith(`${manifest.knowledgeBase}.`)) {
      failures.push(`version.json latest ${manifest.latest} does not belong to knowledge-base line ${manifest.knowledgeBase}`);
    }
    // The skill must actually read it, and from main: pinning it to a tag freezes the answer.
    if (!skill.includes('main/version.json')) {
      failures.push('SKILL.md does not read version.json from main, so the update check cannot see a newer release');
    }
    if (!/Update with: copilot plugin update/u.test(skill)) {
      failures.push('SKILL.md states no update command for the user to run');
    }
    // The weekly check bumps the knowledge base. If it does not also stamp the manifest and the
    // skill's coordinated line, the next automated bump leaves every installed copy believing it
    // is current, which is the one failure mode a version check must not have.
    const applyUpdate = readText(path.join('tools', 'weekly-check', 'apply-update.mjs'));
    if (!/version\.json/u.test(applyUpdate)) failures.push('apply-update.mjs does not stamp version.json, so an automated bump would leave installed copies believing they are current');
    if (!/knowledge-base line/u.test(applyUpdate)) failures.push('apply-update.mjs does not stamp the coordinated line in SKILL.md');

    // The plugin manifests carry the version Copilot CLI displays. They were left at 2.0.0 while
    // everything else moved to v2.1, so `plugin update` installed the new files and still reported
    // the old version -- the update looked broken when it had in fact worked.
    const expected = String(manifest.latest).replace(/^v/u, '');
    for (const file of [path.join('.claude-plugin', 'plugin.json'), path.join('.claude-plugin', 'marketplace.json')]) {
      let doc = null;
      try { doc = JSON.parse(readText(file)); }
      catch { failures.push(`${file} is missing or is not valid JSON`); continue; }
      const versions = [doc.version, doc.metadata?.version, ...(doc.plugins ?? []).map(p => p.version)].filter(Boolean);
      if (versions.length === 0) failures.push(`${file} declares no version`);
      for (const v of versions) {
        if (v !== expected) failures.push(`${file} declares version ${v}; version.json advertises ${manifest.latest}`);
      }
    }
  }

  add('version-manifest-current', failures.length === 0,
    failures.length ? failures : [`version.json advertises ${manifest.latest} on knowledge-base line ${manifest.knowledgeBase}, matching SKILL.md, and the skill reads it from main.`]);
}

{
  // v1.18 removed `high` and `validated`, and both survived in three documents until a docs pass
  // found them by hand. Nothing was watching the vocabulary, so this gate watches it.
  const files = [
    ['skills\\get-migration-assessment\\SKILL.md', skill],
    ['reference\\decision-rules.md', rules],
    ['reference\\output-contract.md', readText(path.join('reference', 'output-contract.md'))],
    ['reference\\input-contract.md', readText(path.join('reference', 'input-contract.md'))],
  ];
  const failures = [];
  // Only the recommendation vocabulary is in scope: `high IOPS`, `high bandwidth` and
  // `highest HA` are ordinary English and must stay allowed.
  const banned = [
    [/confidence\s*[:=]\s*`?high/iu, 'confidence: high'],
    [/\bhigh\s+confidence\b/iu, 'high confidence'],
    [/recommendationStatus\s*[:=]\s*`?validated/iu, 'recommendationStatus: validated'],
    [/\bvalidated\s+recommendation\b/iu, 'validated recommendation'],
    [/provisional\s*\|\s*validated/iu, 'a validated alternative in a value list'],
  ];

  for (const [name, text] of files) {
    text.split(/\r?\n/u).forEach((line, i) => {
      for (const [re, label] of banned) {
        if (re.test(line)) failures.push(`${name}:${i + 1} still offers ${label} — removed in v1.18: "${line.trim().slice(0, 80)}"`);
      }
    });
  }

  // The ceiling must be stated, not merely implied by the absence of `high`.
  if (!/medium[^.]{0,60}(ceiling|highest confidence)/iu.test(`${skill}\n${rules}`)) {
    failures.push('no policy document states that `medium` is the confidence ceiling');
  }

  add('confidence-vocabulary', failures.length === 0,
    failures.length ? failures : ['`high` and `validated` appear in no recommendation vocabulary across the 4 policy documents, and `medium` is stated as the ceiling.']);
}

{
  // The rule index is only useful if every entry consumes fields that exist, and if no gate
  // silently treats an unknown as a pass. An index nobody checks is decoration.
  const inputContract = readText(path.join('reference', 'input-contract.md'));
  const index = (rules.match(/## Rule index[\s\S]*$/u) || [''])[0];
  const failures = [];

  if (!index) failures.push('reference\\decision-rules.md has no Rule index section');

  const rows = [...index.matchAll(/^\| `([A-Z][A-Z0-9-]+)` \| ([^|]+) \| ([^|]+) \| ([^|]+) \|/gmu)];
  if (rows.length < 20) failures.push(`the rule index lists only ${rows.length} rules; the hard gates alone exceed that`);

  for (const [, id, , consumes, unknown] of rows) {
    // Every consumed field named in backticks must exist in the input contract.
    for (const field of [...consumes.matchAll(/`([a-z_][a-z0-9_]*)`/g)].map(m => m[1])) {
      if (!new RegExp(`\`${field}\``).test(inputContract)) failures.push(`${id} consumes '${field}', which the input contract does not define`);
    }
    // Every rule must say what it does when an input is unknown, and it must not be a pass.
    const u = unknown.trim();
    if (!u || u === '—') failures.push(`${id} does not define its unknown behaviour`);
    // A negated mention is the opposite of a pass, and reading it as one is the same substring
    // mistake that once made "no private link required" fire the Private Link blocker.
    const negated = /\b(cannot|never|not|refused|no)\b/i.test(u);
    if (!negated && (/\beligible\b(?!_)/i.test(u) || /\bpass(es|ed)?\b/i.test(u))) failures.push(`${id} treats an unknown as a pass: "${u}"`);
  }

  // The ordered ranking replaced an unordered criteria table. Ties must not invent a winner.
  if (!/Apply these steps in order/u.test(rules)) failures.push('B1 no longer states an explicit ranking order');
  if (!/Never invent a winner/u.test(rules)) failures.push('B1 does not forbid inventing a winner when candidates tie');

  add('rule-index-consistent', failures.length === 0,
    failures.length ? failures : [`${rows.length} rules are addressable, consume only documented fields, and each declares an unknown behaviour that is not a pass.`]);
}

{
  const retired = (rules.match(/## Retired — never recommend \(use the replacement\)[\s\S]*?(?:\n---|\n## Reverse path)/u) || [''])[0];
  const checks = [
    { name: 'retired table heading', re: /Retired — never recommend/u },
    { name: 'DMA replacement', re: /Data Migration Assistant \(DMA\)[^\n]*SSMS 22 \/ Arc \/ Azure Migrate/u },
    { name: 'Azure Data Studio replacement', re: /Azure Data Studio \+ SQL Migration extension[^\n]*VS Code \+ MSSQL; SSMS 22 \/ DMS/u },
    { name: 'DMS classic replacement', re: /Azure DMS \*classic\* — SQL scenarios[^\n]*\*\*modern\*\* DMS/u },
    { name: 'DEA replacement', re: /Database Experimentation Assistant \(DEA\)[^\n]*Extended Events capture \+ RML Utilities \/ OStress/u }
  ];
  const missing = checks.filter(c => !c.re.test(retired)).map(c => c.name);
  add('retired-tooling-guard', missing.length === 0, missing.length ? missing : ['Retired tooling table lists required retired tools and replacements.']);
}

{
  const expected = new Map([
    ['P0-1', 'mi-eligible-homogeneous-dtc'],
    ['P0-2', 'sql2022-publisher-to-azure-sql-db-replication'],
    ['P0-3', 'sql2008r2-to-mi-short-cutover-lrs-evaluated'],
    ['P0-4', 'fabric-driver-small-simple-schema'],
    ['P0-5', 'aws-rds-to-mi-near-zero-no-mi-link'],
    ['P0-6', 'unknown-feature-dependencies-provisional'],
    ['P0-7', 'kb-rules-readme-version-mismatch-blocks'],
    ['P0-8', 'change-detected-not-applied-no-version-bump']
  ]);
  const ids = new Set(scenarios.map(s => s.id));
  const missing = [...expected].filter(([, id]) => !ids.has(id)).map(([ref, id]) => `${ref} => ${id}`);
  add('audit-scenario-coverage', missing.length === 0, missing.length ? missing : [...expected].map(([ref, id]) => `${ref} => ${id}`));
}

const summary = { total: results.length, passed: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length };
if (jsonMode) {
  process.stdout.write(JSON.stringify({ summary, results }, null, 2) + '\n');
} else {
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.name}`);
    for (const d of r.details) console.log(`  - ${d}`);
  }
  console.log(`SUMMARY ${summary.passed}/${summary.total} passed, ${summary.failed} failed`);
}
process.exit(summary.failed ? 1 : 0);
