// Deterministically bump the knowledge-base version and prepend a changelog row.
// Keeps the intro "**Version.**" line, the "current as of" note, and the §17
// changelog table in sync. Used by the weekly workflow once it decides an update
// is warranted; also runnable by hand.
//
//   node apply-update.mjs --changelog "text" [--bump minor|major] [--date "Month Year"] [--iso 2026-08-01] [--dry]
//
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DOC = path.resolve(HERE, '..', '..', 'docs', 'sql-server-to-azure-migration.md');

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && (name === 'dry')) return true;
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const DRY = process.argv.includes('--dry');
const BUMP = arg('bump', 'minor');
let changelog = (arg('changelog', '') || '').replace(/\s+/g, ' ').trim();

const now = new Date();
const MONTH_YEAR = arg('date', now.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }));
const ISO = arg('iso', now.toISOString().slice(0, 10));

let md = fs.readFileSync(DOC, 'utf8');

const vm = md.match(/\*\*Version\.\*\*\s*v(\d+)\.(\d+)/);
if (!vm) { console.error('Could not find "**Version.** vX.Y" line in the doc.'); process.exit(1); }
let [maj, min] = [parseInt(vm[1], 10), parseInt(vm[2], 10)];
const oldVer = `v${maj}.${min}`;
if (BUMP === 'major') { maj += 1; min = 0; } else { min += 1; }
const newVer = `v${maj}.${min}`;

if (!changelog) changelog = `Automated weekly freshness check (${ISO}): links re-verified; no substantive changes required.`;
const cell = changelog.replace(/\|/g, '\\|');

// 1) intro version line
md = md.replace(/(\*\*Version\.\*\*\s*)v\d+\.\d+(\s*[—-]\s*)[A-Za-z]+ \d{4}/, `$1${newVer}$2${MONTH_YEAR}`);
// 2) "current as of <Month Year>" verification note(s)
md = md.replace(/current as of [A-Za-z]+ \d{4}/g, `current as of ${MONTH_YEAR}`);
// 3) §17 "Current version: **vX.Y** (YYYY-MM-DD)."
md = md.replace(/(Current version:\s*\*\*)v\d+\.\d+(\*\*\s*\()\d{4}-\d{2}-\d{2}(\))/, `$1${newVer}$2${ISO}$3`);
// 4) collapsible <summary> "current: vX.Y"
md = md.replace(/current:\s*v\d+\.\d+/g, `current: ${newVer}`);

// 5) prepend a changelog row after the table separator
const rowsRe = /(\|\s*Version\s*\|\s*Date\s*\|\s*Changes\s*\|\r?\n\|[-\s|]+\|\r?\n)/;
if (!rowsRe.test(md)) { console.error('Could not find the changelog table header.'); process.exit(1); }
md = md.replace(rowsRe, `$1| ${newVer} | ${ISO} | ${cell} |\n`);

// ---- keep README.md in sync (badge, PDF-section version, collapsible changelog) ----
const README = path.resolve(HERE, '..', '..', 'README.md');
let readmeSynced = false;
try {
  let rd = fs.readFileSync(README, 'utf8');
  rd = rd.replace(/(alt="Knowledge base )v\d+\.\d+(")/g, `$1${newVer}$2`);
  rd = rd.replace(/(knowledge%20base-)v\d+\.\d+(-)/g, `$1${newVer}$2`);
  rd = rd.replace(/v\d+\.\d+, [A-Za-z]+ \d{4}/g, `${newVer}, ${MONTH_YEAR}`);
  rd = rd.replace(/(current:\s*<b>)v\d+\.\d+(<\/b>\s*\()[A-Za-z]+ \d{4}(\))/, `$1${newVer}$2${MONTH_YEAR}$3`);
  const clRe = /(<!-- CHANGELOG:START -->[\s\S]*?\|\s*Version\s*\|\s*Date\s*\|\s*Summary\s*\|\r?\n\|[-\s|]+\|\r?\n)/;
  if (clRe.test(rd)) { rd = rd.replace(clRe, `$1| ${newVer} | ${ISO} | ${cell} |\n`); readmeSynced = true; }
  if (!DRY) fs.writeFileSync(README, rd);
} catch (e) { console.error('README sync skipped:', e.message); }

if (DRY) {
  console.log(`[dry] ${oldVer} -> ${newVer} (${MONTH_YEAR}, ${ISO})`);
  console.log(`[dry] changelog: ${changelog}`);
  console.log(`[dry] README changelog row insert: ${readmeSynced}`);
} else {
  fs.writeFileSync(DOC, md);
  console.log(`${oldVer} -> ${newVer} (${MONTH_YEAR}); changelog row added (${ISO}); README synced=${readmeSynced}.`);
}
// expose the new version for the workflow (GITHUB_OUTPUT)
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `new_version=${newVer}\n`);
