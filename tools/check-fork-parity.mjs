// Prove the fork carries everything, rather than assuming it does.
//
// The fork is not a mirror. Its layout differs, one file is a deliberately transformed copy, and
// the rest is vendored. That mix is exactly where things go missing: for three review rounds the
// fixes landed upstream and a reviewer kept finding them unfixed in the fork, because the port
// script patched a file it never read the content of.
//
// So this checks what a partial copy actually breaks, in the fork's own terms:
//
//   presence   every file the port declares exists there
//   content    every vendored file is byte-identical to its source
//   contract   the JSON a model copies, and the tool capability, match upstream
//   integrity  every rule ID cited resolves in the fork's own rule index
//   layout     nothing points at a path the fork does not have
//
// Run it any time:  node tools/check-fork-parity.mjs [path-to-fork]
// It exits non-zero on the first category that fails, and says what is missing rather than that
// something is.

import fs from 'node:fs';
import path from 'node:path';

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

// The port script owns the mapping, so read it from there instead of keeping a second copy that
// can disagree with the first.
const portSource = read(path.join(SRC, 'tools', 'port-to-fork.mjs'));
const copiesBlock = portSource.slice(portSource.indexOf('const COPIES = ['), portSource.indexOf('];', portSource.indexOf('const COPIES = [')));
const expand = (value) => value
  .replace(/\$\{PREREQ\}/g, 'skills/generate-migration-prerequisite-plan')
  .replace(/\$\{ADVISOR\}/g, 'skills/recommend-migration-path');
const mapping = [...copiesBlock.matchAll(/\[\s*[`'"]([^`'"]+)[`'"]\s*,\s*[`'"]([^`'"]+)[`'"]\s*\]/g)]
  .map(([, from, to]) => [expand(from), expand(to)]);

if (mapping.length < 15) {
  failures.push(`only ${mapping.length} ported file(s) could be read out of the port script, so this check would pass by checking almost nothing`);
}

// 1 and 2. Presence, then content for everything vendored rather than transformed.
const TRANSFORMED = ['skills/recommend-migration-path/SKILL.md'];
let identical = 0;
for (const [from, to] of mapping) {
  const source = path.join(SRC, from);
  const target = path.join(DEST, to);
  if (!fs.existsSync(target)) { failures.push(`missing from the fork: ${to}`); continue; }
  if (TRANSFORMED.includes(to)) continue;
  if (to.endsWith('.md')) continue; // links are rewritten for the fork's layout; checked below
  if (normalise(read(source)) !== normalise(read(target))) {
    failures.push(`${to} differs from its source ${from}, and nothing about the fork's layout should change a JSON file`);
  } else identical += 1;
}

// 3. The contract a model copies. Prose may be rewritten for the fork; these may not.
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

// The advisor SKILL.md is derived from upstream, and the sections that genuinely differ are
// declared in port-to-fork.mjs. Proving that here is the point: the file is read on every run of
// the skill, and it was twice the one document nobody compared. A section that drifts is a set of
// instructions only one of the two repositories has ever reviewed.
{
  const owned = new Set([...portSource.matchAll(/\['(## [^']+)',\s*'/g)].map((m) => m[1]));
  if (!owned.size) failures.push('no fork-owned section could be read out of port-to-fork.mjs, so this check would compare nothing');
  const sectionsOf = (text) => {
    const map = new Map();
    let heading = null;
    for (const line of normalise(text).split('\n')) {
      if (/^## /.test(line)) { heading = line.trim(); map.set(heading, []); }
      else if (heading) map.get(heading).push(line);
    }
    return map;
  };
  const upstreamSections = sectionsOf(upstreamSkill);
  const forkSections = sectionsOf(read(forkSkillPath));
  // Compared after the transformations the port applies, since paths and version stamps are
  // expected to differ and nothing else is.
  const comparable = (lines) => lines.join('\n')
    .replace(/(?:\.\.\/)*docs\/sql-server-to-azure-migration(?:-prerequisite)?\.md/g, 'KB')
    .replace(/(?:\.\.\/)*(?:reference|references|schemas)\/knowledge-base\.md/g, 'KB')
    .replace(/(?:\.\.\/)*templates\/prerequisite-plan\.md/g, 'TEMPLATE')
    .replace(/(?:\.\.\/)*references\/prerequisite-plan-template\.md/g, 'TEMPLATE')
    .replace(/(?:\.\.\/)*(?:reference|references|schemas)\//g, 'references/')
    .replace(/v\d+\.\d+(?:\.\d+)?/g, 'vX')
    .replace(/\s+/g, ' ')
    .trim();
  let compared = 0;
  for (const [heading, lines] of upstreamSections) {
    if (owned.has(heading)) continue;
    if (!forkSections.has(heading)) { failures.push(`the fork's SKILL.md has no ${heading} section, which upstream carries and which is not declared fork-owned`); continue; }
    compared++;
    if (comparable(lines) !== comparable(forkSections.get(heading))) {
      failures.push(`${heading} differs between upstream and the fork and is not declared fork-owned, so one of the two carries instructions the other has never seen`);
    }
  }
  for (const heading of forkSections.keys()) {
    if (!upstreamSections.has(heading) && !owned.has(heading)) failures.push(`the fork's SKILL.md carries ${heading}, which upstream does not and which is not declared fork-owned`);
  }
  notes.push(`${compared} SKILL.md section(s) derived from upstream and identical after the port's transformations; ${owned.size} declared fork-owned.`);
}

if (failures.length) {
  console.error(`Fork parity failed: ${failures.length} problem(s).`);
  for (const failure of [...new Set(failures)]) console.error(`  ${failure}`);
  process.exit(1);
}

console.log('Fork parity passed.');
console.log(`  ${mapping.length} ported file(s) present, ${identical} byte-identical to their source.`);
console.log('  The advisor declares the same tools and teaches the same JSON object as upstream.');
for (const note of notes) console.log(`  ${note}`);
console.log(`  ${links} reference(s) resolve in the fork's own layout.`);
