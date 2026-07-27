import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { evaluate } from './engine/evaluate.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = (...p) => path.join(root, ...p);
const jsonMode = process.argv.includes('--json');
const results = [];

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

const rulesPath = rel('reference', 'decision-rules.md');
const skillPath = rel('SKILL.md');
const rules = readText(path.join('reference', 'decision-rules.md'));
const skill = readText('SKILL.md');
let scenarios = [];
try {
  scenarios = JSON.parse(readText(path.join('tests', 'golden-scenarios.json')));
  add('golden-scenarios-json', Array.isArray(scenarios) && scenarios.length >= 48, [`${Array.isArray(scenarios) ? scenarios.length : 0} scenarios loaded`]);
} catch (err) {
  add('golden-scenarios-json', false, [String(err)]);
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
  const targetCounts = {};
  const availabilityCounts = {};
  for (const s of scenarios) {
    const actual = evaluate(s.inputs || {});
    targetCounts[actual.primaryTarget] = (targetCounts[actual.primaryTarget] || 0) + 1;
    availabilityCounts[actual.targetAvailabilityDuringSync] = (availabilityCounts[actual.targetAvailabilityDuringSync] || 0) + 1;
  }
  const maxTarget = Math.max(0, ...Object.values(targetCounts));
  const maxAllowed = Math.floor(scenarios.length * 0.4);
  const availabilityDistinct = Object.keys(availabilityCounts).length;
  const failures = [];
  if (maxTarget > maxAllowed) failures.push(`primary_target distribution collapsed: max ${maxTarget}/${scenarios.length} > ${maxAllowed}; ${JSON.stringify(targetCounts)}`);
  if (availabilityDistinct < 4) failures.push(`targetAvailabilityDuringSync has only ${availabilityDistinct} distinct values; ${JSON.stringify(availabilityCounts)}`);
  add('decision-distribution-sanity', failures.length === 0, failures.length ? failures : [
    `primary_target distribution ${JSON.stringify(targetCounts)}`,
    `targetAvailabilityDuringSync distribution ${JSON.stringify(availabilityCounts)}`
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
  const files = [rel('SKILL.md'), rel('reference','decision-rules.md'), rel('docs','sql-server-to-azure-migration.md')]
    .concat(walk(rel('examples'), () => true))
    .concat(walk(rel('tools','diagram'), p => p.toLowerCase().endsWith('.html')));
  const failures = [];
  const forbidden = [
    { id: 'wrong replication range', re: /2016[–-]2019/u },
    { id: 'unsourced TDE statistic', re: /~80%|fails\s+~80/iu },
    { id: 'unsourced dependency statistic', re: /~60%/u },
    { id: 'unsourced landing-zone statistic', re: /~4x|4x\s+faster/iu },
    { id: 'undocumented sql_variant claim', re: /sql_variant/iu },
    { id: 'old MI Link 10 database capacity', re: /MI Link[^\n]*(?:up to\s*)?10\s+(?:simultaneous\s+)?(?:databases|dbs|links)|(?:up to\s*)?10\s+(?:simultaneous\s+)?(?:databases|dbs|links)[^\n]*MI Link/iu, allow: /wizard|portal|batch|selection limit|not MI Link capacity/iu }
  ];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split(/\r?\n/);
    lines.forEach((line, i) => {
      for (const f of forbidden) if (f.re.test(line) && !(f.allow && f.allow.test(line))) failures.push(`${fileLine(file, i + 1)} ${f.id}: ${line.trim()}`);
      const isAuthoritativeRuleFile = !file.includes(`${path.sep}tools${path.sep}`) && !file.includes(`${path.sep}examples${path.sep}`);
      if (isAuthoritativeRuleFile && /MI Link/i.test(line) && /\bports?\b|5022/i.test(line) && !/11000/.test(line) && !/managed DTC|DTC ports|Retired|ports below/i.test(line)) failures.push(`${fileLine(file, i + 1)} MI Link ports mention omits 11000-11999: ${line.trim()}`);
      const retiredContext = /retired|unavailable|deprecated|replaced|do not recommend|never recommend|use instead/i.test(line);
      const recommendsDea = /\b(run|use|recommend|capture)\s+(?:retired\s+)?DEA\b|\bDEA\s+capture\b/i.test(line);
      const recommendsReplay = /\b(run|use|recommend)\s+Distributed Replay\b|Distributed Replay\s+(?:capture|replay)/i.test(line);
      if ((recommendsDea || recommendsReplay) && !retiredContext) failures.push(`${fileLine(file, i + 1)} retired validation tool recommended: ${line.trim()}`);
    });
  }
  add('forbidden-patterns', failures.length === 0, failures.length ? failures : ['No forbidden anti-regression patterns found.']);
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
        kubernetes_model: ['kubernetes engine model', 'managed engine', 'full diy container']
      }[key] || [];
      if (!aliases.some(a => skillNorm.includes(norm(a)))) failures.push(`SKILL.md does not collect normalized input ${key}`);
    }
  }
  for (const s of scenarios) {
    for (const key of Object.keys(s.inputs || {})) {
      if (!declared.has(key)) failures.push(`${s.id}: input key '${key}' is not declared in reference\\decision-rules.md A0`);
      const aliases = key === 'downtime' ? ['downtime tolerance'] : key === 'network_ports' ? ['network path and ports','ports'] : key === 'size' ? ['largest db size'] : key === 'tenant_count' ? ['tenants','tenant variability'] : key === 'performance' ? ['tier drivers','iops','latency'] : key === 'compliance' ? ['compliance','sovereignty'] : key === 'fabric_constraints' ? ['fabric','private link','gateway'] : key === 'kubernetes_model' ? ['kubernetes engine model','managed engine','full diy container'] : [];
      if (!skillNorm.includes(norm(key)) && !aliases.some(a => skillNorm.includes(norm(a)))) failures.push(`${s.id}: SKILL.md cannot collect input '${key}'`);
    }
  }
  add('branch-reachability', failures.length === 0, failures.length ? [...new Set(failures)] : [`${declared.size} normalized inputs are declared and reachable from SKILL.md.`]);
}

{
  const required = [
    /unknown_requires_assessment/u,
    /do \*\*not\*\* silently pick the safer target/iu,
    /Unknown on a decision-driving dependency ⇒ `recommendationStatus: provisional`/u,
    /Never turn an unknown into a silent safe default/u,
    /If a tier-driving input is missing, emit `unknown_requires_assessment`/u
  ];
  const missing = required.filter(re => !re.test(rules)).map(re => String(re));
  add('no-silent-defaults', missing.length === 0, missing.length ? missing : ['Unknown decision-driving inputs produce assessment/provisional status, not defaults.']);
}

{
  const retired = (rules.match(/## Retired — never recommend \(use the replacement\)[\s\S]*?(?:\n---|\n## Reverse path)/u) || [''])[0];
  const checks = [
    { name: 'retired table heading', re: /Retired — never recommend/u },
    { name: 'DMA replacement', re: /Data Migration Assistant \(DMA\)[^\n]*SSMS 22 \/ Arc \/ Azure Migrate/u },
    { name: 'Azure Data Studio replacement', re: /Azure Data Studio \+ SQL Migration extension[^\n]*VS Code \+ MSSQL; SSMS 22 \/ DMS/u },
    { name: 'DMS classic replacement', re: /Azure DMS \*classic\* — SQL scenarios[^\n]*\*\*modern\*\* DMS/u },
    { name: 'DEA replacement', re: /Data Experimentation Assistant \(DEA\)[^\n]*Extended Events capture \+ RML Utilities \/ OStress/u }
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
