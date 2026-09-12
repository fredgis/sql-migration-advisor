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
import { spawnSync } from 'node:child_process';

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
  // Repository-root paths written in code spans. These resolve upstream and nowhere here once the
  // folders move, and they are invisible to a check that reads Markdown links only: that is how
  // two of them reached a reviewer, and how two more survived the commit meant to fix them.
  [/(skills\/[a-z-]+\/)templates\/prerequisite-plan\.md/g, '$1references/prerequisite-plan-template.md'],
  [/(skills\/[a-z-]+\/)(?:reference|schemas)\//g, '$1references/'],
  [/\((?:\.\.\/)*(?:reference|references|schemas)\/([a-z0-9.-]+)\)/g, `(${prefix}$1)`],
  [/`(?:\.\.\/)*(?:reference|references|schemas)\/([a-z0-9.-]+)`/g, `\`${prefix}$1\``],
  // Repository tooling is not part of a skill bundle and does not ship here. Left as a link it
  // would point at a tools/ folder this repository has no reason to carry, so the reference names
  // where the file lives instead of pretending it is next door.
  [/\[`tools\/validate-plan\.mjs`\]\((?:\.\.\/)*tools\/validate-plan\.mjs\)/g, '`validate-plan.mjs` in the upstream repository'],
  [/`tools\/validate-plan\.mjs`(?! in the upstream)/g, '`validate-plan.mjs` in the upstream repository']
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

// The advisor SKILL.md in the fork is derived from upstream, not maintained beside it.
//
// It used to be patched: version stamps, then the capability line and the JSON blocks as well. Both
// times the reasoning was that a human had deliberately rewritten the fork and the script should
// respect that. Both times the same thing happened instead. Content fixed upstream stayed upstream,
// a reviewer spent a round reporting defects that had been fixed the day before, and the second
// round was worse than the first because the patch covered the contract-shaped parts and left the
// prose, which is where the instructions live. A file a model reads every run cannot be the one
// nobody is comparing.
//
// So the whole document is taken from upstream, and the two sections that genuinely differ are
// declared here by heading. Anything not on this list is upstream's, transformed. If the fork needs
// to say something new, it gets a heading and a line in FORK_OWNED rather than a quiet edit.
const FORK_OWNED = new Map([
  ['## When to Use', 'Carries the repository convention section on what the source version and edition change, which upstream has no equivalent for.'],
  ['## API Details', 'Upstream describes fetching the live knowledge base. Nothing is fetched here, and the update check is `apm outdated` rather than the plugin command.']
]);
const sectionsOf = (text) => {
  const parts = [];
  for (const line of text.split('\n')) {
    if (/^## /.test(line)) parts.push({ heading: line.trim(), lines: [line] });
    else if (parts.length) parts[parts.length - 1].lines.push(line);
    else (parts.preamble ??= []).push(line), parts.preamble;
  }
  return parts;
};
const advisorSkill = path.join(DEST, `${ADVISOR}/SKILL.md`);
if (fs.existsSync(advisorSkill)) {
  const upstream = read(path.join(SRC, `${ADVISOR}/SKILL.md`));
  const current = read(advisorSkill);
  const preambleOf = (text) => text.split('\n').slice(0, text.split('\n').findIndex((l) => /^## /.test(l))).join('\n');
  const owned = new Map(sectionsOf(current).map((s) => [s.heading, s.lines.join('\n')]));

  for (const heading of FORK_OWNED.keys()) {
    if (!owned.has(heading)) {
      console.error(`FORK_OWNED names ${heading}, which the fork's SKILL.md does not contain, so nothing would be preserved for it.`);
      process.exitCode = 1;
    }
  }
  const rebuilt = [preambleOf(upstream)];
  for (const section of sectionsOf(upstream)) {
    rebuilt.push(FORK_OWNED.has(section.heading) ? owned.get(section.heading) : section.lines.join('\n'));
  }
  let text = rebuilt.join('\n');

  const keep = (line) => /^\|\s*v[0-9]/.test(line.trim()) || /\b(until|since|before|from)\s+v[0-9]/i.test(line);
  for (const [pattern, replacement] of rewritesFor('references/')) text = text.replace(pattern, replacement);
  text = text.split('\n')
    .map((line) => (keep(line) ? line : line.replace(/v\d+\.\d+\.\d+/g, release).replace(/v\d+\.\d+(?!\.)/g, kbLine)))
    .join('\n');
  fs.writeFileSync(advisorSkill, text, 'utf8');
}

console.log(`Ported ${copied} file(s) at ${release} on knowledge-base line ${kbLine}.`);

// Every reference in the ported skills must resolve to a file that exists, whether it is written
// as a Markdown link or as a path in a code span. Reading only one of the two forms is how the
// stale paths survived the rename, twice.
const problems = [];
const resolves = (from, target) => fs.existsSync(path.resolve(path.dirname(from), target)) || fs.existsSync(path.resolve(DEST, target));
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name !== '.git' && entry.name !== 'node_modules') walk(full); continue; }
    if (!entry.name.endsWith('.md')) continue;
    const text = read(full);
    const where = path.relative(DEST, full);
    if (/(?:\.\.\/)+docs\//.test(text)) problems.push(`${where}: an upstream docs/ path survived`);
    for (const link of text.matchAll(/\]\(([^)#:\s]+\.(?:md|json|mjs))\)/g)) {
      if (!resolves(full, link[1])) problems.push(`${where}: link to ${link[1]} resolves to nothing`);
    }
    for (const span of text.matchAll(/`((?:skills|docs|reference|references|schemas|templates|examples|tools)\/[A-Za-z0-9._/-]+\.(?:md|json|mjs))`/g)) {
      if (!resolves(full, span[1])) problems.push(`${where}: code span ${span[1]} resolves to nothing`);
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

// Porting and proving the port are two different things, and doing only the first is what let
// three rounds of fixes stay upstream. The parity check runs here so it cannot be skipped.
const parity = spawnSync(process.execPath, [path.join(SRC, 'tools', 'check-fork-parity.mjs'), DEST], { encoding: 'utf8' });
process.stdout.write(parity.stdout || '');
process.stderr.write(parity.stderr || '');
if (parity.status !== 0) process.exitCode = 1;
