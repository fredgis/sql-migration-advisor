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

if (DRY) {
  console.log(`[dry] ${oldVer} -> ${newVer} (${MONTH_YEAR}, ${ISO})`);
  console.log(`[dry] changelog: ${changelog}`);
} else {
  fs.writeFileSync(DOC, md);
  console.log(`${oldVer} -> ${newVer} (${MONTH_YEAR}); changelog row added (${ISO}).`);
}
// expose the new version for the workflow (GITHUB_OUTPUT)
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `new_version=${newVer}\n`);
