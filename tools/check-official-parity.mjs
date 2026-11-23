// Prove that the two skills Microsoft publishes from this repository are the official text, rather
// than assuming it.
//
// microsoft/microsoft-sql ships recommend-migration-path and generate-migration-prerequisite-plan,
// with everything they read flattened into references/. This repository keeps its own layout, and
// fork-layout.mjs states the mapping between the two. Being iso means one thing here: put every
// file of this repository through that mapping and the result is the official package, byte for
// byte. Any other difference is text one side has and the other has not, and a change made on top
// of it would be reviewed against a document Microsoft does not publish.
//
//   node tools/check-official-parity.mjs [ref]      ref defaults to main
//
// It reads GitHub (set GITHUB_TOKEN or GH_TOKEN to lift the anonymous API limit) and exits non-zero
// when a file differs, when the package carries a file nothing here maps to, or when a mapped file
// is missing from the package.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { COPIES, portText } from './fork-layout.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const REPO = 'microsoft/microsoft-sql';
const PACKAGE = 'plugins/microsoft-sql-migration/skills';
const SKILLS = [...new Set(COPIES.map(([, to]) => to.split('/')[1]))];
const ref = process.argv[2] || 'main';

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const api = async (route) => {
  const res = await fetch(`https://api.github.com/repos/${REPO}/${route}`, {
    headers: { Accept: 'application/vnd.github+json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  });
  if (!res.ok) throw new Error(`GitHub API ${route}: ${res.status} ${res.statusText}`);
  return res.json();
};
const lf = (text) => text.replace(/\r\n/g, '\n');

const commit = await api(`commits/${encodeURIComponent(ref)}`);
const sha = commit.sha;
const tree = await api(`git/trees/${sha}?recursive=1`);
if (tree.truncated) throw new Error(`the tree of ${REPO}@${sha.slice(0, 7)} is truncated, so files could be missed`);
const published = new Set(tree.tree
  .filter((entry) => entry.type === 'blob' && SKILLS.some((skill) => entry.path.startsWith(`${PACKAGE}/${skill}/`)))
  .map((entry) => entry.path.slice(PACKAGE.length + 1)));

const failures = [];
let identical = 0;
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'official-parity-'));
const mapped = new Set();
for (const [from, to] of COPIES) {
  const rel = to.slice('skills/'.length);
  mapped.add(rel);
  if (!published.has(rel)) { failures.push(`${rel} is mapped from ${from} but ${REPO} does not publish it`); continue; }
  const res = await fetch(`https://raw.githubusercontent.com/${REPO}/${sha}/${PACKAGE}/${rel}`);
  if (!res.ok) { failures.push(`${rel}: could not be read from ${REPO} (${res.status})`); continue; }
  const official = lf(await res.text());
  const ours = lf(portText(to, fs.readFileSync(path.join(ROOT, from), 'utf8')));
  if (official === ours) { identical++; continue; }
  const a = path.join(scratch, 'official');
  const b = path.join(scratch, 'this-repository');
  fs.writeFileSync(a, official);
  fs.writeFileSync(b, ours);
  const diff = spawnSync('git', ['diff', '--no-index', '--no-color', '-U0', '--', a, b], { encoding: 'utf8' }).stdout
    .split('\n').filter((line) => /^[-+@]/.test(line) && !/^(?:---|\+\+\+) /.test(line));
  failures.push(`${rel} differs from ${from} (- official, + this repository):\n${diff.slice(0, 24).map((line) => `      ${line.slice(0, 180)}`).join('\n')}${diff.length > 24 ? `\n      ... ${diff.length - 24} more line(s)` : ''}`);
}
fs.rmSync(scratch, { recursive: true, force: true });
for (const rel of published) {
  if (!mapped.has(rel)) failures.push(`${rel} is published by ${REPO} and nothing in this repository maps to it`);
}

const where = `${REPO}@${sha.slice(0, 7)} (${String(commit.commit?.committer?.date || '').slice(0, 10)})`;
if (failures.length) {
  console.error(`Official parity failed against ${where}: ${failures.length} problem(s).`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
console.log(`Official parity passed against ${where}.`);
console.log(`  ${identical} of the ${published.size} files published for ${SKILLS.join(' and ')} are this repository's text with the port's path rewrites, byte for byte.`);
