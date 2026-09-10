// Port the skills from this repository into the Microsoft fork.
//
// The fork has a different layout, and the difference is not cosmetic. On main every skill is
// SKILL.md plus a references/ folder, and apm pack picks up nothing else: a skill shipping its
// policy under reference/, schemas/ or templates/ is packaged without its policy. So this script
// flattens everything a skill needs into references/ and rewrites the links to match.
//
// Two failures it exists to prevent, both shipped by hand before it existed:
//
//   1. A link rewritten to a target that does not exist. The prerequisite skill pointed at
//      ../../docs/sql-server-to-azure-migration-prerequisite.md, which resolves upstream and
//      nowhere here; the hand fix rewrote it to knowledge-base.md, which resolves to the skill
//      root, where there is no such file. Checking that no upstream path survives is not the same
//      as checking that the new path resolves, so the second check is here now.
//
//   2. A version stamp rewritten inside a sentence that names a version on purpose. A blanket
//      rewrite turns "Until v2.4 the question offered" into "Until v3.6" and inverts it. Prose
//      recalling when a rule changed is excluded. Anything that reports the loaded version to the
//      user belongs in a placeholder rather than in an exclusion list, because an exclusion freezes
//      whatever value happened to be there.
//
// Run it after every release:  node tools/port-to-fork.mjs [path-to-fork]

import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const DEST = process.argv[2] || 'C:/Users/frgisber/repo-sql-migration-agent';

const PREREQ = 'skills/generate-migration-prerequisite-plan';
const ADVISOR = 'skills/recommend-migration-path';

const COPIES = [
  [`${PREREQ}/SKILL.md`, `${PREREQ}/SKILL.md`],
  [`${PREREQ}/reference/input-contract.md`, `${PREREQ}/references/input-contract.md`],
  [`${PREREQ}/reference/output-contract.md`, `${PREREQ}/references/output-contract.md`],
  [`${PREREQ}/reference/path-catalog.json`, `${PREREQ}/references/path-catalog.json`],
  [`${PREREQ}/reference/questions.json`, `${PREREQ}/references/questions.json`],
  [`${PREREQ}/reference/advisor-coverage.json`, `${PREREQ}/references/advisor-coverage.json`],
  [`${PREREQ}/reference/advisor-fact-mappings.json`, `${PREREQ}/references/advisor-fact-mappings.json`],
  [`${PREREQ}/schemas/input.schema.json`, `${PREREQ}/references/input.schema.json`],
  [`${PREREQ}/schemas/output.schema.json`, `${PREREQ}/references/output.schema.json`],
  [`${PREREQ}/templates/prerequisite-plan.md`, `${PREREQ}/references/prerequisite-plan-template.md`],
  ['docs/sql-server-to-azure-migration-prerequisite.md', `${PREREQ}/references/knowledge-base.md`],

  [`${ADVISOR}/schemas/input.schema.json`, `${ADVISOR}/references/input.schema.json`],
  [`${ADVISOR}/schemas/output.schema.json`, `${ADVISOR}/references/output.schema.json`],
  ['reference/input-contract.md', `${ADVISOR}/references/input-contract.md`],
  ['reference/output-contract.md', `${ADVISOR}/references/output-contract.md`],
  ['reference/decision-rules.md', `${ADVISOR}/references/decision-rules.md`],
  ['docs/sql-server-to-azure-migration.md', `${ADVISOR}/references/knowledge-base.md`],
  ['examples/sample-recommendation.md', `${ADVISOR}/references/sample-recommendation.md`],
  // role is defined by advisor-coverage.json and required by the advisor's own output schema, so
  // the file belongs in both skills: they are meant to be independently runnable.
  [`${PREREQ}/reference/advisor-coverage.json`, `${ADVISOR}/references/advisor-coverage.json`]
];

// Upstream layout on the left, fork layout on the right. Link text is rewritten alongside the
// target, because a label naming a path that does not exist misleads a reader even when the link
// itself works. The prefix depends on where the file lands: SKILL.md sits at the skill root and
// reaches its policy through references/, while a file already inside references/ reaches its
// siblings by name. Getting that wrong is how the knowledge-base link ended up pointing at the
// skill root, where no such file exists.
const rewritesFor = (prefix) => [
  [/\[`(?:\.\.\/)*docs\/sql-server-to-azure-migration(?:-prerequisite)?\.md`\]\((?:\.\.\/)*docs\/sql-server-to-azure-migration(?:-prerequisite)?\.md\)/g, `[\`${prefix}knowledge-base.md\`](${prefix}knowledge-base.md)`],
  [/\((?:\.\.\/)*docs\/sql-server-to-azure-migration(?:-prerequisite)?\.md\)/g, `(${prefix}knowledge-base.md)`],
  [/`(?:\.\.\/)*docs\/sql-server-to-azure-migration(?:-prerequisite)?\.md`/g, `\`${prefix}knowledge-base.md\``],
  [/\((?:\.\.\/)*templates\/prerequisite-plan\.md\)/g, `(${prefix}prerequisite-plan-template.md)`],
  [/`(?:\.\.\/)*templates\/prerequisite-plan\.md`/g, `\`${prefix}prerequisite-plan-template.md\``],
  [/\((?:\.\.\/)*(?:reference|references|schemas)\/([a-z0-9.-]+)\)/g, `(${prefix}$1)`],
  [/`(?:\.\.\/)*(?:reference|references|schemas)\/([a-z0-9.-]+)`/g, `\`${prefix}$1\``]
];

const read = (p) => fs.readFileSync(p, 'utf8');
const version = JSON.parse(read(path.join(SRC, 'version.json')));
const release = version.latest;
const kbLine = version.knowledgeBase;

let copied = 0;
for (const [from, to] of COPIES) {
  const source = path.join(SRC, from);
  const target = path.join(DEST, to);
  if (!fs.existsSync(source)) { console.error(`MISSING SOURCE ${from}`); process.exitCode = 1; continue; }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (to.endsWith('.md')) {
    const prefix = to.includes('/references/') ? '' : 'references/';
    let text = read(source);
    for (const [pattern, replacement] of rewritesFor(prefix)) text = text.replace(pattern, replacement);
    fs.writeFileSync(target, text, 'utf8');
  } else {
    fs.copyFileSync(source, target);
  }
  copied++;
}

// Drop the layout the fork no longer uses, so apm pack cannot pick up a stale second copy.
for (const skill of ['recommend-migration-path', 'generate-migration-prerequisite-plan']) {
  for (const old of ['reference', 'schemas', 'templates', 'examples']) {
    const dir = path.join(DEST, 'skills', skill, old);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  }
}

// The advisor SKILL.md in the fork is a transformed copy, not a mirror, so it is patched rather
// than overwritten: only its layout links and its version stamps move.
const advisorSkill = path.join(DEST, `${ADVISOR}/SKILL.md`);
if (fs.existsSync(advisorSkill)) {
  const keep = (line) => /^\|\s*v[0-9]/.test(line.trim()) || /\b(until|since|before|from)\s+v[0-9]/i.test(line);
  let text = read(advisorSkill);
  for (const [pattern, replacement] of rewritesFor('references/')) text = text.replace(pattern, replacement);
  text = text.split('\n')
    .map((line) => (keep(line) ? line : line.replace(/v\d+\.\d+\.\d+/g, release).replace(/v\d+\.\d+(?!\.)/g, kbLine)))
    .join('\n');
  fs.writeFileSync(advisorSkill, text, 'utf8');
}

console.log(`Ported ${copied} file(s) at ${release} on knowledge-base line ${kbLine}.`);

// Every relative link in the ported skills must resolve to a file that exists.
const problems = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name !== '.git' && entry.name !== 'node_modules') walk(full); continue; }
    if (!entry.name.endsWith('.md')) continue;
    const text = read(full);
    if (/(?:\.\.\/)+docs\//.test(text)) problems.push(`${path.relative(DEST, full)}: an upstream docs/ path survived`);
    for (const link of text.matchAll(/\]\(([^)#:\s]+\.(?:md|json))\)/g)) {
      if (!fs.existsSync(path.resolve(path.dirname(full), link[1]))) {
        problems.push(`${path.relative(DEST, full)}: link to ${link[1]} resolves to nothing`);
      }
    }
  }
};
walk(path.join(DEST, 'skills'));

if (problems.length) {
  console.error('Broken references in the ported skills:');
  for (const problem of [...new Set(problems)]) console.error(`  ${problem}`);
  process.exitCode = 1;
} else {
  console.log('Every relative link in the ported skills resolves to a file that exists.');
}
