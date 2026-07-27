import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

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

const rulesPath = rel('reference', 'decision-rules.md');
const skillPath = rel('SKILL.md');
const rules = readText(path.join('reference', 'decision-rules.md'));
const skill = readText('SKILL.md');
let scenarios = [];
try {
  scenarios = JSON.parse(readText(path.join('tests', 'golden-scenarios.json')));
  add('golden-scenarios-json', Array.isArray(scenarios) && scenarios.length >= 35, [`${Array.isArray(scenarios) ? scenarios.length : 0} scenarios loaded`]);
} catch (err) {
  add('golden-scenarios-json', false, [String(err)]);
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
    { id: 'undocumented sql_variant claim', re: /sql_variant/iu }
  ];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split(/\r?\n/);
    lines.forEach((line, i) => {
      for (const f of forbidden) if (f.re.test(line)) failures.push(`${fileLine(file, i + 1)} ${f.id}: ${line.trim()}`);
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
      // Allow keys that are collected by their human label rather than exact snake_case.
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

