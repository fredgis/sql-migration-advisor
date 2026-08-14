// Apply the metadata half of a knowledge-base update: freshness stamps, version numbers, changelog
// rows and every satellite file that republishes a version line.
//
//   node tools/weekly-check/apply-update.mjs --housekeeping [--iso YYYY-MM-DD] [--dry]
//   node tools/weekly-check/apply-update.mjs --substantive --changelog "text" [--bump minor|major] [--kbs a,b] [--dry]
//
// This never writes guidance. Content is edited by a human (or by a human applying a reviewed
// finding); this step records that it happened, consistently, across the files that would otherwise
// be left behind. A version bump is refused unless a real content diff exists, judged by
// substantive-diff.mjs — the same judgement the decision stage makes, so the two cannot disagree.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, TARGETS, byId, TARGET_IDS } from './kb-targets.mjs';
import { isSubstantive, baselineRef } from './substantive-diff.mjs';

function arg(name, def = '') {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def;
}
const DRY = process.argv.includes('--dry');
const SUBSTANTIVE = process.argv.includes('--substantive');
const HOUSEKEEPING = process.argv.includes('--housekeeping');
const BUMP = arg('bump', 'minor');
const changelog = arg('changelog', '').replace(/\s+/g, ' ').trim();
const ISO = arg('iso', new Date().toISOString().slice(0, 10));

if (SUBSTANTIVE === HOUSEKEEPING) {
  console.error('Choose exactly one mode: --substantive (requires a real content diff) or --housekeeping (stamps only).');
  process.exit(2);
}
if (!['minor', 'major'].includes(BUMP)) {
  console.error('--bump must be "minor" or "major".');
  process.exit(2);
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(ISO)) {
  console.error('--iso must be YYYY-MM-DD.');
  process.exit(2);
}

const requested = arg('kbs', '').split(',').map(s => s.trim()).filter(Boolean);
for (const id of requested) {
  if (!byId(id)) { console.error(`--kbs: unknown knowledge base "${id}"; known ids are ${TARGET_IDS.join(', ')}`); process.exit(2); }
}
const selected = requested.length ? requested.map(byId) : TARGETS;

// A buffered writer, so a target whose satellite files are half-updated when a regex fails to match
// leaves nothing on disk. Everything lands together or not at all.
const pending = new Map();
const io = {
  read(rel) {
    if (pending.has(rel)) return pending.get(rel);
    try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return null; }
  },
  edit(rel, fn) {
    const before = io.read(rel);
    if (before === null) { console.error(`  ! ${rel} is missing; skipped`); return false; }
    const after = fn(before);
    if (after === before) return false;
    pending.set(rel, after);
    return true;
  },
  editJson(rel, fn) {
    const before = io.read(rel);
    if (before === null) { console.error(`  ! ${rel} is missing; skipped`); return false; }
    const next = `${JSON.stringify(fn(JSON.parse(before)), null, 2)}\n`;
    if (next === before) return false;
    pending.set(rel, next);
    return true;
  }
};

const results = [];

if (HOUSEKEEPING) {
  for (const target of selected) {
    const before = new Set(pending.keys());
    target.stamp(io, ISO);
    const touched = [...pending.keys()].filter(k => !before.has(k));
    results.push({ id: target.id, version: target.readVersion(io), touched });
  }
} else {
  if (!changelog) {
    console.error('Refusing version bump: --substantive requires truthful --changelog text describing the applied content changes.');
    process.exit(1);
  }
  // A changelog claiming links were repaired, on a run that only ever reads links, would be a lie
  // recorded permanently in the document's own history.
  if (/fixed\/verified broken link/i.test(changelog) || /fixed .*link/i.test(changelog)) {
    console.error('Refusing misleading changelog: do not claim links were fixed unless link URLs were actually rewritten.');
    process.exit(1);
  }

  const base = baselineRef();
  const changed = selected.filter(t => isSubstantive(t, base));
  if (!changed.length) {
    console.error(
      `Refusing version bump: no substantive content diff exists in ${selected.map(t => t.id).join(', ')} `
      + `versus ${base || 'an unknown baseline'} (version, date and changelog changes are ignored). `
      + 'Use --housekeeping for stamp-only updates.');
    process.exit(1);
  }
  for (const target of changed) {
    const before = new Set(pending.keys());
    const version = target.bump(io, { bump: BUMP, changelog, iso: ISO });
    const touched = [...pending.keys()].filter(k => !before.has(k));
    results.push({ id: target.id, version, touched });
  }
  // Every base is stamped, including those that did not change: a run that verified a document
  // against this week's evidence and found nothing to correct did verify it.
  for (const target of selected.filter(t => !changed.includes(t))) {
    const before = new Set(pending.keys());
    target.stamp(io, ISO);
    results.push({ id: target.id, version: target.readVersion(io), touched: [...pending.keys()].filter(k => !before.has(k)) });
  }
}

if (!DRY) for (const [rel, text] of pending) fs.writeFileSync(path.join(ROOT, rel), text);

const prefix = DRY ? '[dry] ' : '';
console.log(`${prefix}mode=${HOUSEKEEPING ? 'housekeeping' : 'substantive'} date=${ISO}`);
for (const r of results) {
  console.log(`${prefix}  ${r.id}: ${r.version || 'unknown version'}${r.touched.length ? ` — ${r.touched.join(', ')}` : ' — nothing to change'}`);
}
const files = [...pending.keys()].sort();
console.log(`${prefix}files written: ${files.length ? files.join(' ') : 'none'}`);
if (SUBSTANTIVE && pending.has('version.json')) {
  const v = JSON.parse(pending.get('version.json'));
  console.log(`version.json now advertises ${v.latest} — cut that release, or installed copies will point at a tag that does not exist.`);
}

if (process.env.GITHUB_OUTPUT) {
  const bumped = results.filter(r => r.touched.length).map(r => `${r.id}:${r.version}`).join(',');
  const delimiter = `EOF_${Date.now().toString(36)}`;
  fs.appendFileSync(process.env.GITHUB_OUTPUT,
    `mode=${HOUSEKEEPING ? 'housekeeping' : 'substantive'}\n`
    + `versions=${bumped}\n`
    + `files=${files.join(' ')}\n`
    // The pull-request step commits exactly this list. Emitted from what was actually written rather
    // than maintained by hand in the workflow, because a hand-maintained copy fell behind the moment
    // a new file joined the set and quietly shipped an incomplete synchronisation.
    + `files_multiline<<${delimiter}\n${files.join('\n')}\n${delimiter}\n`);
}
