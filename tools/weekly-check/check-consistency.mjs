// Validate that the KB, README badge, and offline decision rules agree on
// version/date metadata and on critical version gates.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const DOC = path.join(ROOT, 'docs', 'sql-server-to-azure-migration.md');
const RULES = path.join(ROOT, 'reference', 'decision-rules.md');
const README = path.join(ROOT, 'README.md');

const errors = [];
const warnings = [];
const read = file => fs.readFileSync(file, 'utf8');
const kb = read(DOC);
const rules = read(RULES);
const readme = read(README);

function pushIf(label, values) {
  const unique = [...new Set(values.filter(Boolean))];
  if (unique.length > 1) errors.push(`${label} disagree: ${unique.join(', ')}`);
  return unique[0] || null;
}
function first(re, text) { const m = text.match(re); return m ? m[1] : null; }
function all(re, text) { return [...text.matchAll(re)].map(m => m[1]); }

const kbVersions = [
  first(/\*\*Version\.\*\*\s*(v\d+\.\d+)/, kb),
  first(/Current version:\s*\*\*(v\d+\.\d+)\*\*/, kb),
  first(/current:\s*(v\d+\.\d+)/, kb)
];
const kbVersion = pushIf('KB version declarations', kbVersions);
const rulesVersion = first(/\(sql-migration-advisor\),\s*\*\*(v\d+\.\d+)\*\*,\s*verified/i, rules) || first(/\*\*(v\d+\.\d+)\*\*/i, rules);
const readmeBadgeVersion = first(/knowledge%20base-(v\d+\.\d+)-/i, readme) || first(/Knowledge base (v\d+\.\d+)/i, readme);
pushIf('KB, decision-rules, and README badge versions', [kbVersion, rulesVersion, readmeBadgeVersion]);

const rowVersion = first(/\|\s*(v\d+\.\d+)\s*\|\s*\d{4}-\d{2}-\d{2}\s*\|/, kb);
if (!rowVersion) errors.push('Could not find a changelog row in the KB.');
else if (kbVersion && rowVersion !== kbVersion) errors.push(`Latest KB changelog row ${rowVersion} does not match declared current version ${kbVersion}.`);

const kbMonth = first(/current as of\s+(?:\d{1,2}\s+)?([A-Za-z]+\s+\d{4})/i, kb);
const rulesMonth = first(/verified\s+([A-Za-z]+\s+\d{4})/i, rules);
const monthIndex = m => {
  if (!m) return NaN;
  const d = Date.parse(`1 ${m} UTC`);
  return Number.isNaN(d) ? NaN : new Date(d).getUTCFullYear() * 12 + new Date(d).getUTCMonth();
};
if (!kbMonth) errors.push('Could not find KB "current as of <Month Year>" stamp.');
if (!rulesMonth) errors.push('Could not find decision-rules "verified <Month Year>" stamp.');
if (kbMonth && rulesMonth && monthIndex(kbMonth) !== monthIndex(rulesMonth)) {
  errors.push(`Freshness stamps disagree: KB current as of ${kbMonth}; decision-rules verified ${rulesMonth}.`);
}

function normalizeGate(raw) {
  return (raw || '')
    .replace(/SQL\s*Server\s*/gi, 'sql ')
    .replace(/\band later\b/gi, '+')
    .replace(/\bor later\b/gi, '+')
    .replace(/\+/g, '+')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}
function normalizeMinVersion(raw) {
  const v = normalizeGate(raw).replace(/sql /g, '').replace(/\s*only$/g, ' only');
  if (/^\d{4}$/.test(v)) return `${v}+`;
  return v.replace(/^(\d{4})\s+all editions$/, '$1+').replace(/^(\d{4})\s*\+$/, '$1+');
}
function extractWithPatterns(text, patterns) {
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return normalizeMinVersion(m[1] || m[0]);
  }
  return null;
}
function extractGate(text, terms, patterns) {
  const candidates = text.split(/\r?\n/).filter(line => terms.every(term => line.toLowerCase().includes(term.toLowerCase())));
  for (const line of candidates) {
    const found = extractWithPatterns(line, patterns);
    if (found) return found;
  }
  return extractWithPatterns(text, patterns);
}
const gates = [
  {
    id: 'mi-link-minimum-source-version',
    kbTerms: ['Managed Instance link'],
    rulesTerms: ['MI Link'],
    kbPatterns: [/SQL\s*(?:Server\s*)?(2016\s*(?:and later|\+)?)/i],
    rulesPatterns: [/(?:source\s*)?\*\*(2016\+)\*\*/i, /source\s*(2016\+)/i, /SQL\s*(?:Server\s*)?(2016\s*(?:and later|\+)?)/i]
  },
  {
    id: 'lrs-minimum-source-version',
    kbTerms: ['Log Replay Service'],
    rulesTerms: ['Log Replay Service'],
    kbPatterns: [/SQL\s*(?:Server\s*)?(2008[–—-]2022|2012\s*(?:all editions|\+)?)/i],
    rulesPatterns: [/SQL\s*(?:Server\s*)?(2008[–—-]2022|2012\+)/i, /(?:source\s*)?\*\*(2012\+)\*\*/i, /source\s*(2012\+)/i]
  },
  {
    id: 'native-restore-to-mi-minimum',
    kbTerms: ['Native backup & restore'],
    rulesTerms: ['Native backup/restore'],
    kbPatterns: [/SQL\s*(?:Server\s*)?(2008\+?)/i],
    rulesPatterns: [/SQL\s*(?:Server\s*)?(2008\+?)/i, /(?:source\s*)?\*\*(2008\+)\*\*/i, /source\s*(2008\+)/i]
  },
  {
    id: 'transactional-replication-to-sql-db-publisher-versions',
    kbTerms: ['Transactional replication'],
    rulesTerms: ['Transactional replication'],
    kbPatterns: [/SQL\s*(?:Server\s*)?(2016(?:\+|\s+and later)|2016[–—-]2019\s*only)/i, /SQL DB transactional replication:[^\n]*SQL\s*(?:Server\s*)?(2016(?:\+|\s+and later)|2016[–—-]2019\s*only)/i],
    rulesPatterns: [/publisher\s+SQL\s*(?:Server\s*)?(2016(?:\+|\s+and later))/i, /SQL\s*(?:Server\s*)?(2016(?:\+|\s+and later)|2016[–—-]2019\s*only)/i, /source\s*\*\*(2016[–—-]2019\s*only)\*\*/i]
  }
];
for (const gate of gates) {
  const kbVal = extractGate(kb, gate.kbTerms, gate.kbPatterns);
  const rulesVal = extractGate(rules, gate.rulesTerms, gate.rulesPatterns);
  if (!kbVal || !rulesVal) {
    warnings.push(`${gate.id}: could not find ${!kbVal ? 'KB' : ''}${!kbVal && !rulesVal ? ' and ' : ''}${!rulesVal ? 'decision-rules' : ''} gate.`);
  } else if (kbVal !== rulesVal) {
    errors.push(`${gate.id} contradicts: KB="${kbVal}"; decision-rules="${rulesVal}".`);
  }
}

for (const w of warnings) console.warn(`WARNING: ${w}`);
if (errors.length) {
  console.error('KB consistency check failed:');
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}
console.log(`KB consistency check passed: ${kbVersion}; freshness ${kbMonth}; ${warnings.length} warning(s).`);





