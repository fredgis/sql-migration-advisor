// Prove the fork carries everything, rather than assuming it does.
//
// The fork is a mirror in a different layout. Its paths differ and nothing else may: for three review
// rounds the fixes landed upstream and a reviewer kept finding them unfixed in the fork, because the
// port script patched a file it never read the content of, and later because two sections of the
// advisor SKILL.md were kept from the fork and drifted from the text Microsoft publishes.
//
// So this checks what a partial copy actually breaks, in the fork's own terms:
//
//   presence   every file the port declares exists there
//   content    every file is this repository's text with the port's path rewrites, byte for byte
//   contract   the JSON a model copies, and the tool capability, match upstream
//   integrity  every rule ID cited resolves in the fork's own rule index
//   layout     nothing points at a path the fork does not have
//
// Run it any time:  node tools/check-fork-parity.mjs [path-to-fork]
// It exits non-zero on the first category that fails, and says what is missing rather than that
// something is.

import fs from 'node:fs';
import path from 'node:path';
import { COPIES, portText } from './fork-layout.mjs';

const SRC = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const DEST = process.argv[2] || 'C:/Users/frgisber/repo-sql-migration-agent';

const read = (p) => fs.readFileSync(p, 'utf8');
const normalise = (text) => text.replace(/\r\n/g, '\n').trimEnd();
const jsonBlocks = (text) => [...text.matchAll(/```json\r?\n([\s\S]*?)\r?\n```/g)].map((m) => m[1]);

const failures = [];
const notes = [];

if (!fs.existsSync(DEST)) {
  console.error(`No fork at ${DEST}. Pass its path as the first argument.`);
  process.exit(2);
}

// fork-layout.mjs owns the mapping, and the port writes exactly what it says, so the fork is compared
// with that and not with a second copy of the rules that could disagree with the first.
const mapping = COPIES;

// 1 and 2. Presence, then content. Every file, prose included: the fork differs from this repository
// by its paths and by nothing else.
let identical = 0;
for (const [from, to] of mapping) {
  const source = path.join(SRC, from);
  const target = path.join(DEST, to);
  if (!fs.existsSync(target)) { failures.push(`missing from the fork: ${to}`); continue; }
  if (normalise(portText(to, read(source))) !== normalise(read(target))) {
    failures.push(`${to} is not ${from} with the port's path rewrites; run node tools/port-to-fork.mjs`);
  } else identical += 1;
}

// 3. The contract a model copies. The content check above already covers it; this one says which
// part a model would copy wrong when it fails.
const upstreamSkill = read(path.join(SRC, 'skills/recommend-migration-path/SKILL.md'));
const forkSkillPath = path.join(DEST, 'skills/recommend-migration-path/SKILL.md');
if (!fs.existsSync(forkSkillPath)) failures.push('the fork has no advisor SKILL.md');
else {
  const forkSkill = read(forkSkillPath);
  const upstreamTools = (upstreamSkill.match(/^allowed-tools:.*$/m) || [''])[0];
  const forkTools = (forkSkill.match(/^allowed-tools:.*$/m) || [''])[0];
  if (upstreamTools !== forkTools) {
    failures.push(`the advisor declares "${forkTools}" in the fork and "${upstreamTools}" upstream; a skill that cannot open its policy has to answer from memory`);
  }

  const here = jsonBlocks(forkSkill);
  const there = jsonBlocks(upstreamSkill);

  // A normative list naming a field no schema declares produces invalid JSON or drops data at the
  // handoff. This is prose, so the port does not carry it, and it survived a rename in the fork
  // for a full review round.
  const declared = new Set();
  for (const file of ['skills/recommend-migration-path/references/output.schema.json', 'skills/generate-migration-prerequisite-plan/references/input.schema.json']) {
    const full = path.join(DEST, file);
    if (!fs.existsSync(full)) continue;
    const walkSchema = (node) => {
      if (!node || typeof node !== 'object') return;
      for (const key of Object.keys(node.properties || {})) declared.add(key);
      for (const value of Object.values(node)) walkSchema(value);
    };
    walkSchema(JSON.parse(read(full)));
  }
  if (declared.size) {
    forkSkill.split('\n').forEach((line, i) => {
      // Field names start lowercase. Option IDs in the same list shape are ALL_CAPS, and they
      // belong to the interview vocabulary rather than to any schema property.
      const named = line.match(/^\s*[-*]\s*`([a-z][a-zA-Z0-9_]*)(?:\[\])?`/);
      if (named && !declared.has(named[1])) {
        failures.push(`advisor SKILL.md:${i + 1} mandates \`${named[1]}\`, which no schema the fork ships declares`);
      }
    });
  }
  if (here.length !== there.length) failures.push(`the advisor SKILL.md carries ${here.length} JSON block(s) in the fork and ${there.length} upstream`);
  else {
    for (const [i, block] of here.entries()) {
      let mine;
      let theirs;
      try { mine = JSON.parse(block); theirs = JSON.parse(there[i]); }
      catch (error) { failures.push(`advisor SKILL.md block ${i + 1} does not parse: ${error.message}`); continue; }
      // Compare the decisions, not the paths: the fork legitimately rewrites those.
      for (const field of ['eligibilityTrace', 'methodCandidates', 'recommendation', 'normalizedProfile', 'methodGateTrace']) {
        if (JSON.stringify(mine[field]) !== JSON.stringify(theirs[field])) {
          failures.push(`advisor SKILL.md block ${i + 1}: \`${field}\` differs from upstream, so the two repositories teach a model two different objects`);
        }
      }
    }
  }
}

// 4. A citation a reader cannot look up is worse in the fork, which ships the rules beside it.
const forkRules = path.join(DEST, 'skills/recommend-migration-path/references/decision-rules.md');
if (!fs.existsSync(forkRules)) failures.push('the fork ships no decision-rules.md for the advisor');
else {
  const rules = read(forkRules);
  const indexed = new Set();
  for (const m of rules.matchAll(/\*\*`([A-Z][A-Z0-9-]+)`\*\*/g)) indexed.add(m[1]);
  for (const m of rules.matchAll(/^\|\s*`?([A-Z][A-Z0-9-]{3,})`?\s*\|/gm)) indexed.add(m[1]);
  const cited = new Set();
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith('.md')) continue;
      for (const m of read(full).matchAll(/"ruleId":\s*"([^"]+)"/g)) cited.add(m[1]);
    }
  };
  walk(path.join(DEST, 'skills'));
  for (const id of cited) {
    if (!indexed.has(id)) failures.push(`the fork cites rule \`${id}\`, which its own decision-rules.md does not define`);
  }
  if (cited.size) notes.push(`${cited.size} rule ID(s) cited in the fork, all defined by the rules it ships.`);
}

// 5. Layout: a reference the fork cannot resolve stops a skill that is told to load its policy.
let links = 0;
const resolves = (from, target) => fs.existsSync(path.resolve(path.dirname(from), target)) || fs.existsSync(path.resolve(DEST, target));
const walkLinks = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walkLinks(full); continue; }
    if (!entry.name.endsWith('.md')) continue;
    const text = read(full);
    const where = path.relative(DEST, full);
    for (const link of text.matchAll(/\]\(([^)#:\s]+\.(?:md|json))\)/g)) {
      links += 1;
      if (!resolves(full, link[1])) failures.push(`${where}: link to ${link[1]} resolves to nothing`);
    }
    for (const span of text.matchAll(/`((?:skills|docs|reference|references|schemas|templates|examples)\/[A-Za-z0-9._/-]+\.(?:md|json))`/g)) {
      links += 1;
      if (!resolves(full, span[1])) failures.push(`${where}: code span ${span[1]} resolves to nothing`);
    }
  }
};
walkLinks(path.join(DEST, 'skills'));


if (failures.length) {
  console.error(`Fork parity failed: ${failures.length} problem(s).`);
  for (const failure of [...new Set(failures)]) console.error(`  ${failure}`);
  process.exit(1);
}

console.log('Fork parity passed.');
console.log(`  ${mapping.length} ported file(s) present, ${identical} identical to this repository's text with the port's path rewrites.`);
console.log('  The advisor declares the same tools and teaches the same JSON object as upstream.');
for (const note of notes) console.log(`  ${note}`);
console.log(`  ${links} reference(s) resolve in the fork's own layout.`);
