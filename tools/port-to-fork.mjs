// Port the two skills from this repository into the Microsoft fork.
//
// The fork has no docs/ directory: the knowledge bases are vendored under each skill's reference/
// folder. A straight copy therefore carries upstream paths that resolve here and resolve nowhere
// there, which is how the prerequisite skill shipped two links to
// ../../docs/sql-server-to-azure-migration-prerequisite.md and pointed its readers at a file the
// fork does not contain. That link had already been rewritten once, in output-contract.md, and the
// second copy in SKILL.md was missed because the rewrite was done by hand.
//
// So the rewrites live here, and the script fails if any upstream path survives. Run it after every
// release:  node tools/port-to-fork.mjs [path-to-fork]
//
// The advisor SKILL.md in the fork is a transformed copy, not a mirror: paths are localised, the
// live-fetch apparatus is removed and the update command differs. It is patched, never overwritten.

import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const DEST = process.argv[2] || 'C:/Users/frgisber/repo-sql-migration-agent';

const COPIES = [
  ['skills/generate-migration-prerequisite-plan/SKILL.md', 'skills/generate-migration-prerequisite-plan/SKILL.md'],
  ['skills/generate-migration-prerequisite-plan/reference/input-contract.md', 'skills/generate-migration-prerequisite-plan/reference/input-contract.md'],
  ['skills/generate-migration-prerequisite-plan/reference/output-contract.md', 'skills/generate-migration-prerequisite-plan/reference/output-contract.md'],
  ['skills/generate-migration-prerequisite-plan/reference/path-catalog.json', 'skills/generate-migration-prerequisite-plan/reference/path-catalog.json'],
  ['skills/generate-migration-prerequisite-plan/reference/questions.json', 'skills/generate-migration-prerequisite-plan/reference/questions.json'],
  ['skills/generate-migration-prerequisite-plan/reference/advisor-coverage.json', 'skills/generate-migration-prerequisite-plan/reference/advisor-coverage.json'],
  ['skills/generate-migration-prerequisite-plan/reference/advisor-fact-mappings.json', 'skills/generate-migration-prerequisite-plan/reference/advisor-fact-mappings.json'],
  ['skills/generate-migration-prerequisite-plan/schemas/input.schema.json', 'skills/generate-migration-prerequisite-plan/schemas/input.schema.json'],
  ['skills/generate-migration-prerequisite-plan/schemas/output.schema.json', 'skills/generate-migration-prerequisite-plan/schemas/output.schema.json'],
  ['skills/generate-migration-prerequisite-plan/templates/prerequisite-plan.md', 'skills/generate-migration-prerequisite-plan/templates/prerequisite-plan.md'],
  ['docs/sql-server-to-azure-migration-prerequisite.md', 'skills/generate-migration-prerequisite-plan/reference/knowledge-base.md'],
  ['skills/recommend-migration-path/schemas/input.schema.json', 'skills/recommend-migration-path/schemas/input.schema.json'],
  ['skills/recommend-migration-path/schemas/output.schema.json', 'skills/recommend-migration-path/schemas/output.schema.json'],
  ['reference/input-contract.md', 'skills/recommend-migration-path/reference/input-contract.md'],
  ['reference/output-contract.md', 'skills/recommend-migration-path/reference/output-contract.md'],
  ['reference/decision-rules.md', 'skills/recommend-migration-path/reference/decision-rules.md'],
  ['docs/sql-server-to-azure-migration.md', 'skills/recommend-migration-path/reference/knowledge-base.md'],
  ['examples/sample-recommendation.md', 'skills/recommend-migration-path/examples/sample-recommendation.md']
];

// Upstream layout on the left, fork layout on the right. Applied to every ported Markdown file.
const REWRITES = [
  [/\[`(?:\.\.\/)*docs\/sql-server-to-azure-migration-prerequisite\.md`\]\((?:\.\.\/)*docs\/sql-server-to-azure-migration-prerequisite\.md\)/g, '[`reference/knowledge-base.md`](knowledge-base.md)'],
  [/\[`(?:\.\.\/)*docs\/sql-server-to-azure-migration\.md`\]\((?:\.\.\/)*docs\/sql-server-to-azure-migration\.md\)/g, '[`reference/knowledge-base.md`](knowledge-base.md)'],
  [/\((?:\.\.\/)+docs\/sql-server-to-azure-migration-prerequisite\.md\)/g, '(knowledge-base.md)'],
  [/\((?:\.\.\/)+docs\/sql-server-to-azure-migration\.md\)/g, '(knowledge-base.md)'],
  [/`(?:\.\.\/)+docs\/sql-server-to-azure-migration-prerequisite\.md`/g, '`reference/knowledge-base.md`'],
  [/`(?:\.\.\/)+docs\/sql-server-to-azure-migration\.md`/g, '`reference/knowledge-base.md`'],
  [/`docs\/sql-server-to-azure-migration-prerequisite\.md`/g, '`reference/knowledge-base.md`'],
  [/\((?:\.\.\/)+reference\/([a-z-]+\.md)\)/g, '(reference/$1)'],
  [/`(?:\.\.\/)+reference\/([a-z-]+\.md)`/g, '`reference/$1`']
];

const read = (p) => fs.readFileSync(p, 'utf8');
const version = JSON.parse(read(path.join(SRC, 'version.json')));
const release = version.latest;
const line_ = version.knowledgeBase;

let copied = 0;
for (const [from, to] of COPIES) {
  const source = path.join(SRC, from);
  const target = path.join(DEST, to);
  if (!fs.existsSync(source)) { console.error(`MISSING SOURCE ${from}`); process.exitCode = 1; continue; }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (to.endsWith('.md')) {
    let text = read(source);
    for (const [pattern, replacement] of REWRITES) text = text.replace(pattern, replacement);
    fs.writeFileSync(target, text, 'utf8');
  } else {
    fs.copyFileSync(source, target);
  }
  copied++;
}

// The advisor SKILL.md is transformed, so only its version stamps move. Historical references are
// not stamps: prose recalling when a rule changed ("Until v2.4 the question offered...") and the
// worked example of the update notice both name a version on purpose, and a blanket rewrite turns
// "Until v2.4" into "Until v3.5", which says the opposite of what the sentence means. These are the
// same exclusions the skill-versions-agree-with-the-manifest gate applies upstream.
const advisorSkill = path.join(DEST, 'skills/recommend-migration-path/SKILL.md');
if (fs.existsSync(advisorSkill)) {
  const keep = (line) => /^\|\s*v[0-9]/.test(line.trim())
    || /\b(until|since|before|from)\s+v[0-9]/i.test(line)
    || /A newer version is available/i.test(line)
    || /assessment used knowledge base v[0-9]/i.test(line);
  const text = read(advisorSkill).split('\n')
    .map((line) => (keep(line) ? line : line.replace(/v\d+\.\d+\.\d+/g, release).replace(/v\d+\.\d+(?!\.)/g, line_)))
    .join('\n');
  fs.writeFileSync(advisorSkill, text, 'utf8');
}

// Nothing may reference a layout the fork does not have. This is the check that was missing.
const offenders = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name !== '.git' && entry.name !== 'node_modules') walk(full); continue; }
    if (!/\.(md|json)$/.test(entry.name)) continue;
    const text = read(full);
    if (/(?:\.\.\/)+docs\//.test(text)) offenders.push(path.relative(DEST, full));
  }
};
walk(path.join(DEST, 'skills'));

console.log(`Ported ${copied} file(s) at ${release} on knowledge-base line ${line_}.`);
if (offenders.length) {
  console.error('Upstream docs/ paths survive in the fork, and they resolve to nothing there:');
  for (const file of offenders) console.error(`  ${file}`);
  process.exitCode = 1;
} else {
  console.log('No upstream docs/ path survives in the ported skills.');
}
