// Deterministically apply metadata updates after a human/applied patch has changed KB content.
// A version bump is refused unless --substantive is set AND the KB has a real
// content diff versus HEAD, excluding version/date/changelog-only changes.
//
//   node tools/weekly-check/apply-update.mjs --substantive --changelog "text" [--bump minor|major] [--date "Month Year"] [--iso YYYY-MM-DD] [--dry]
//   node tools/weekly-check/apply-update.mjs --housekeeping [--date "Month Year"] [--iso YYYY-MM-DD] [--dry]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const DOC = path.join(ROOT, 'docs', 'sql-server-to-azure-migration.md');
const RULES = path.join(ROOT, 'reference', 'decision-rules.md');
const README = path.join(ROOT, 'README.md');
const REL_DOC = 'docs/sql-server-to-azure-migration.md';

function arg(name, def = '') {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && ['dry', 'substantive', 'housekeeping'].includes(name)) return true;
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const DRY = process.argv.includes('--dry');
const SUBSTANTIVE = process.argv.includes('--substantive');
const HOUSEKEEPING = process.argv.includes('--housekeeping');
const BUMP = arg('bump', 'minor');
let changelog = (arg('changelog', '') || '').replace(/\s+/g, ' ').trim();

if (SUBSTANTIVE === HOUSEKEEPING) {
  console.error('Choose exactly one mode: --substantive (requires real KB content diff) or --housekeeping (date stamps only, no version/changelog).');
  process.exit(2);
}
if (!['minor', 'major'].includes(BUMP)) {
  console.error('--bump must be "minor" or "major".');
  process.exit(2);
}

const now = new Date();
const MONTH_YEAR = arg('date', now.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }));
const ISO = arg('iso', now.toISOString().slice(0, 10));

function read(file) { return fs.readFileSync(file, 'utf8'); }
function currentHead(file) {
  try { return execFileSync('git', ['show', `HEAD:${file}`], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch { return null; }
}
function stripChangelog(md) {
  const start = md.search(/\|\s*Version\s*\|\s*Date\s*\|\s*Changes\s*\|/i);
  if (start < 0) return md;
  const nextHeading = md.slice(start).search(/\n#{1,3}\s+(?!.*changelog)/i);
  return nextHeading < 0 ? md.slice(0, start) : md.slice(0, start) + md.slice(start + nextHeading);
}
function normalizedSubstantive(md) {
  return stripChangelog(md)
    .replace(/\*\*Version\.\*\*\s*v\d+\.\d+\s*[—-]\s*(?:\d{1,2}\s+)?[A-Za-z]+\s+\d{4}/g, '**Version.** vX.Y — Month YYYY')
    .replace(/Current version:\s*\*\*v\d+\.\d+\*\*\s*\(\d{4}-\d{2}-\d{2}\)/g, 'Current version: **vX.Y** (YYYY-MM-DD)')
    .replace(/current:\s*v\d+\.\d+/g, 'current: vX.Y')
    .replace(/current as of (?:\d{1,2}\s+)?[A-Za-z]+\s+\d{4}/gi, 'current as of Month YYYY')
    .replace(/verified (?:\d{1,2}\s+)?[A-Za-z]+\s+\d{4}/gi, 'verified Month YYYY')
    .replace(/\r\n/g, '\n')
    .trim();
}
function hasSubstantiveDocDiff() {
  const base = currentHead(REL_DOC);
  if (base === null) return false;
  return normalizedSubstantive(base) !== normalizedSubstantive(read(DOC));
}

let md = read(DOC);
const vm = md.match(/\*\*Version\.\*\*\s*v(\d+)\.(\d+)/);
if (!vm) { console.error('Could not find "**Version.** vX.Y" line in the doc.'); process.exit(1); }
let [maj, min] = [parseInt(vm[1], 10), parseInt(vm[2], 10)];
const oldVer = `v${maj}.${min}`;

function updateFreshnessStamps(text) {
  return text.replace(/current as of (?:\d{1,2}\s+)?[A-Za-z]+\s+\d{4}/gi, `current as of ${MONTH_YEAR}`);
}
function updateRulesStamp(text, version = null) {
  let next = text;
  if (version) next = next.replace(/(\(sql-migration-advisor\),\s*\*\*)v\d+\.\d+(\*\*,\s*verified\s*)(?:\d{1,2}\s+)?[A-Za-z]+\s+\d{4}/, `$1${version}$2${MONTH_YEAR}`);
  else next = next.replace(/(\(sql-migration-advisor\),\s*\*\*v\d+\.\d+\*\*,\s*verified\s*)(?:\d{1,2}\s+)?[A-Za-z]+\s+\d{4}/, `$1${MONTH_YEAR}`);
  return next.replace(/verified\s+(?:\d{1,2}\s+)?[A-Za-z]+\s+\d{4}/, `verified ${MONTH_YEAR}`);
}

let newVer = oldVer;
let rulesSynced = false;
let readmeSynced = false;

if (HOUSEKEEPING) {
  const before = md;
  md = updateFreshnessStamps(md);
  if (!DRY && md !== before) fs.writeFileSync(DOC, md);
  try {
    const rl = read(RULES);
    const next = updateRulesStamp(rl, null);
    rulesSynced = next !== rl;
    if (!DRY && rulesSynced) fs.writeFileSync(RULES, next);
  } catch (e) { console.error(`decision-rules housekeeping skipped: ${e.message}`); }
  console.log(`${DRY ? '[dry] ' : ''}housekeeping only: ${oldVer} not bumped; freshness stamps set to ${MONTH_YEAR}; changelog unchanged; decision-rules stamp synced=${rulesSynced}.`);
} else {
  if (!hasSubstantiveDocDiff()) {
    console.error('Refusing version bump: --substantive was set, but no substantive KB content diff exists versus HEAD (metadata-only changes are ignored). Use --housekeeping for stamp-only updates.');
    process.exit(1);
  }
  if (!changelog) {
    console.error('Refusing version bump: --substantive requires truthful --changelog text describing applied content changes.');
    process.exit(1);
  }
  if (/fixed\/verified broken link/i.test(changelog) || /fixed .*link/i.test(changelog)) {
    console.error('Refusing misleading changelog: do not claim links were fixed unless link URLs were actually rewritten.');
    process.exit(1);
  }
  if (BUMP === 'major') { maj += 1; min = 0; } else { min += 1; }
  newVer = `v${maj}.${min}`;
  const cell = changelog.replace(/\|/g, '\\|');
  md = md.replace(/(\*\*Version\.\*\*\s*)v\d+\.\d+(\s*[—-]\s*)(?:\d{1,2}\s+)?[A-Za-z]+\s+\d{4}/, `$1${newVer}$2${MONTH_YEAR}`);
  md = updateFreshnessStamps(md);
  md = md.replace(/(Current version:\s*\*\*)v\d+\.\d+(\*\*\s*\()\d{4}-\d{2}-\d{2}(\))/, `$1${newVer}$2${ISO}$3`);
  md = md.replace(/current:\s*v\d+\.\d+/g, `current: ${newVer}`);
  const rowsRe = /(\|\s*Version\s*\|\s*Date\s*\|\s*Changes\s*\|\r?\n\|[-\s|]+\|\r?\n)/;
  if (!rowsRe.test(md)) { console.error('Could not find the changelog table header.'); process.exit(1); }
  md = md.replace(rowsRe, `$1| ${newVer} | ${ISO} | ${cell} |\n`);

  try {
    let rd = read(README);
    const before = rd;
    rd = rd.replace(/(alt="Knowledge base )v\d+\.\d+(")/g, `$1${newVer}$2`);
    rd = rd.replace(/(knowledge%20base-)v\d+\.\d+(-)/g, `$1${newVer}$2`);
    rd = rd.replace(/v\d+\.\d+, (?:\d{1,2}\s+)?[A-Za-z]+ \d{4}/g, `${newVer}, ${MONTH_YEAR}`);
    rd = rd.replace(/(current:\s*<b>)v\d+\.\d+(<\/b>\s*\()(?:\d{1,2}\s+)?[A-Za-z]+ \d{4}(\))/, `$1${newVer}$2${MONTH_YEAR}$3`);
    const clRe = /(<!-- CHANGELOG:START -->[\s\S]*?\|\s*Version\s*\|\s*Date\s*\|\s*Summary\s*\|\r?\n\|[-\s|]+\|\r?\n)/;
    if (clRe.test(rd)) rd = rd.replace(clRe, `$1| ${newVer} | ${ISO} | ${cell} |\n`);
    readmeSynced = rd !== before;
    if (!DRY && readmeSynced) fs.writeFileSync(README, rd);
  } catch (e) { console.error(`README sync skipped: ${e.message}`); }
  try {
    const rl = read(RULES);
    const next = updateRulesStamp(rl, newVer);
    rulesSynced = next !== rl;
    if (!DRY && rulesSynced) fs.writeFileSync(RULES, next);
  } catch (e) { console.error(`decision-rules sync skipped: ${e.message}`); }
  if (!DRY) fs.writeFileSync(DOC, md);
  console.log(`${DRY ? '[dry] ' : ''}${oldVer} -> ${newVer} (${MONTH_YEAR}); substantive content diff verified; changelog row added (${ISO}); README synced=${readmeSynced}; decision-rules stamp synced=${rulesSynced}.`);
}

if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `new_version=${newVer}\nmode=${HOUSEKEEPING ? 'housekeeping' : 'substantive'}\n`);

