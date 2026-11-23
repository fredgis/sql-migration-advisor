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
//   2. A fork that says something this repository does not. The advisor SKILL.md used to be
//      patched, then rebuilt with two sections kept from the fork, and both times the fork drifted
//      from the text Microsoft publishes. The port now changes paths and nothing else, so the
//      fork carries this repository's text, which is the official text.
//
// Run it after every release:  node tools/port-to-fork.mjs [path-to-fork]

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ADVISOR, COPIES, PREREQ, portText } from './fork-layout.mjs';

const SRC = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const DEST = process.argv[2] || 'C:/Users/frgisber/repo-sql-migration-agent';

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
    fs.writeFileSync(target, portText(to, read(source)), 'utf8');
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

// Each skill also has a skill-contract.yml that exists only in the fork. Its pull-request validation
// replays it, and the mock outputs and expected answers name the knowledge-base line the skill
// reports. Nothing ported it, so the first release that moved the line left the advisor's contract
// expecting v3.14 from a skill bundling v3.15.
const CONTRACT_LINES = [
  [ADVISOR, kbLine],
  [PREREQ, JSON.parse(read(path.join(SRC, `${PREREQ}/reference/path-catalog.json`))).knowledgeBaseVersion]
];
for (const [skill, line] of CONTRACT_LINES) {
  const contract = path.join(DEST, `${skill}/skill-contract.yml`);
  if (!fs.existsSync(contract)) continue;
  const text = read(contract);
  const stamped = text.replace(/v\d+\.\d+(?!\.?\d)/g, line);
  if (stamped !== text) fs.writeFileSync(contract, stamped, 'utf8');
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
