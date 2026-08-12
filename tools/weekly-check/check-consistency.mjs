// Validate that the KB, README badge, and offline decision rules agree on
// version/date metadata and on critical version gates.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.env.WEEKLY_CHECK_ROOT || process.argv[2] || path.resolve(HERE, '..', '..'));
const DOC = path.join(ROOT, 'docs', 'sql-server-to-azure-migration.md');
const RULES = path.join(ROOT, 'reference', 'decision-rules.md');
const README = path.join(ROOT, 'README.md');
const SKILL = path.join(ROOT, 'skills', 'recommend-migration-path', 'SKILL.md');

const errors = [];
const warnings = [];
const read = file => fs.readFileSync(file, 'utf8');
const kb = read(DOC);
const rules = read(RULES);
const readme = read(README);
const skill = read(SKILL);

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
  return v.replace(/^(\d{4})\s*\(12\.x\)\s*\+$/, '$1+').replace(/^(\d{4})\s+all editions$/, '$1+').replace(/^(\d{4})\s*\+$/, '$1+');
}
function extractWithPatterns(text, patterns) {
  const variants = [String(text || ''), String(text || '').replace(/[*_`]/g, '')];
  for (const variant of variants) {
    for (const p of patterns) {
      const m = variant.match(p);
      if (m) return normalizeMinVersion(m[1] || m[0]);
    }
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

const consistencyDocs = [
  { name: 'KB', text: kb },
  { name: 'decision-rules', text: rules },
  { name: 'SKILL', text: skill }
];

function docLines(text, anyTerms = [], allTerms = []) {
  return String(text || '').split(/\r?\n/).filter(line => {
    const lower = line.toLowerCase();
    return (!anyTerms.length || anyTerms.some(term => lower.includes(term.toLowerCase())))
      && allTerms.every(term => lower.includes(term.toLowerCase()));
  });
}
function normalizePortToken(raw) {
  return raw.replace(/[–—]/g, '-').replace(/\s+/g, '').toLowerCase();
}
function extractPorts(text) {
  const ports = new Set();
  const lines = docLines(text, ['mi link', 'managed instance link'], []).filter(line => {
    const lower = line.toLowerCase();
    return /ports?|firewall|nsg|open|required/.test(lower) && /5022|11000\s*[–—-]\s*11999/.test(line);
  });
  for (const line of lines) {
    const normalized = normalizePortToken(line);
    if (/\b5022\b/.test(normalized)) ports.add('5022');
    if (/\b11000-11999\b/.test(normalized)) ports.add('11000-11999');
  }
  return ports.size ? [...ports].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join(', ') : null;
}
function extractMiLinkCapacity(text) {
  const limits = new Set();
  const lines = docLines(text, ['mi link', 'managed instance link'], [])
    .filter(line => /\b(links?|capacity|general purpose|business critical|next-gen|gp\/bc|service tier)\b/i.test(line));
  for (const line of lines) {
    const plain = line.replace(/[*_`]/g, '').split(/Azure Arc portal|Arc portal|portal wizard|wizard|batch-selection|extension/i)[0];
    for (const m of plain.matchAll(/(?:up to\s+)?(\d+)\s+links?\b/ig)) limits.add(m[1]);
    for (const m of plain.matchAll(/(\d+)\s+on\s+(?:GP\/BC|GP|BC|Next-gen|General Purpose|Business Critical)/ig)) limits.add(m[1]);
    for (const m of plain.matchAll(/maximum links?:[^\n|.]*(\d+)\s+on\s+(?:GP|General Purpose|Business Critical|BC|Next-gen)/ig)) limits.add(m[1]);
    for (const m of plain.matchAll(/(?:GP|General Purpose|Business Critical|BC|Next-gen)[^\n|.;]*?\b(\d+)\s+links?\b/ig)) limits.add(m[1]);
    for (const m of plain.matchAll(/up to\s+(\d+)\s+links?\s+on\s+(?:GP|General Purpose|Business Critical|BC|Next-gen)/ig)) limits.add(m[1]);
  }
  return limits.size ? [...limits].sort((a, b) => Number(a) - Number(b)).join(', ') : null;
}
function extractArcWizardBatchLimit(text) {
  const limits = new Set();
  const lines = docLines(text, ['arc portal', 'wizard', 'batch'], []).filter(line => /databases?|batch|select/i.test(line));
  for (const line of lines) {
    const plain = line.replace(/[*_`]/g, '');
    for (const m of plain.matchAll(/(?:up to|select(?: up to)?)\s+(\d+)\s+databases?\s+per\s+batch/ig)) limits.add(m[1]);
    for (const m of plain.matchAll(/(\d+)\s+databases?\s+per\s+batch/ig)) limits.add(m[1]);
    for (const m of plain.matchAll(/batch[^\n|.;]*?\b(\d+)\s+databases?/ig)) limits.add(m[1]);
  }
  return limits.size ? [...limits].sort((a, b) => Number(a) - Number(b)).join(', ') : null;
}
function extractFromLines(text, lines, patterns) {
  for (const line of lines) {
    const found = extractWithPatterns(line, patterns);
    if (found) return found;
  }
  return null;
}
function extractArcGate(text, gate) {
  if (gate.id === 'arc-overall-minimum-source-version') {
    return extractFromLines(text, docLines(text, ['arc'], ['overall']), [
      /overall[^\n;|.]*?(?:SQL\s*Server\s*)?(\d{4}\s*(?:\+|and later|or later|\(12\.x\)\+)?)/i,
      /Arc-enabled\s+SQL\s*Server\s*(\d{4}\s*(?:\+|and later|or later)?)\s+overall/i,
      /SQL Server migration in Azure Arc starts with SQL Server\s*(\d{4}\s*(?:\(12\.x\))?\+?)/i
    ]);
  }
  if (gate.id === 'arc-lrs-minimum-source-version') {
    const lines = docLines(text, ['arc'], ['lrs']).filter(line => !/^\s*(?:[-|]\s*)?(?:\*\*)?Standalone LRS/i.test(line));
    const annotated = lines.find(line => /conservative|apply|require Arc experience floor|overall Arc.*floor|inconsistency/i.test(line));
    if (annotated) {
      const conservative = extractWithPatterns(annotated, [
        /conservative[^\n;|.]*?(\d{4}\s*(?:\+|and later|or later)?)/i,
        /apply[^\n;|.]*?(\d{4}\s*(?:\+|and later|or later)?)/i,
        /require Arc experience floor\s*(\d{4}\s*(?:\+|and later|or later)?)/i,
        /overall Arc[^\n;|.]*?floor[^\n;|.]*?(\d{4}\s*(?:\+|and later|or later)?)/i,
        /use the conservative\s*(\d{4}\s*(?:\+|and later|or later)?)/i
      ]);
      if (conservative) return conservative;
    }
    return extractFromLines(text, lines, [
      /Arc\s*(?:→|->)\s*Azure SQL MI via LRS[^\n|.]*?(?:SQL\s*Server\s*)?(\d{4}\s*(?:\+|and later|or later)?)/i,
      /LRS(?:\s+method)?\s*(?:requires|needs|:)\s*(?:SQL\s*Server\s*)?(\d{4}\s*(?:\+|and later|or later)?)/i
    ]);
  }
  if (gate.id === 'arc-mi-link-minimum-source-version') {
    return extractFromLines(text, docLines(text, ['arc'], ['mi link']), [
      /Arc\s*(?:→|->)\s*Azure SQL MI via MI Link[^\n|.]*?(?:SQL\s*Server\s*)?(\d{4}\s*(?:\+|and later|or later)?)/i,
      /MI Link(?:\s+method)?\s*(?:requires|needs|:)\s*(?:SQL\s*Server\s*)?(\d{4}\s*(?:\+|and later|or later)?)/i,
      /MI Link[^\n;|.]*?requiring\s*(?:SQL\s*Server\s*)?(\d{4}\s*(?:\+|and later|or later)?)/i,
      /MI Link[^\n;|.]*?(?:SQL\s*Server|SQL)\s*(\d{4}\s*(?:\+|and later|or later)?)/i
    ]);
  }
  if (gate.id === 'arc-sql-vm-minimum-source-version') {
    const lines = [
      ...docLines(text, ['arc → sql server on azure vm', 'arc -> sql server on azure vm', 'arc → sql vm', 'arc -> sql vm', 'migrate-to-sql-server-on-azure-vms', 'sql migration in azure arc → sql vm'], []),
      ...docLines(text, ['sql vm', 'azure vm'], ['arc-enabled']),
      ...docLines(text, ['sql server on azure vm'], ['arc'])
    ];
    return extractFromLines(text, lines, [
      /Arc\s*(?:→|->)\s*SQL Server on Azure VM[^\n|.]*?(?:SQL\s*Server\s*)?(\d{4}\s*(?:\+|and later|or later)?)/i,
      /(?:SQL\s*Server|SQL)\s*(\d{4}\s*(?:\+|and later|or later)?)(?:\s*\(Arc-enabled\))?/i,
      /Arc-enabled[^\n|.]*?(?:SQL\s*Server|SQL)\s*(\d{4}\s*(?:\+|and later|or later)?)/i
    ]);
  }
  return null;
}
function compareAcrossDocs(label, values, { optional = false } = {}) {
  const found = values.filter(v => v.value);
  if (!found.length) {
    if (!optional) warnings.push(`${label}: could not find gate in KB, decision-rules, or SKILL.`);
    return;
  }
  const missing = values.filter(v => !v.value).map(v => v.name);
  if (missing.length && (!optional || found.length)) warnings.push(`${label}: could not find ${missing.join(', ')} gate.`);
  const unique = [...new Set(found.map(v => v.value))];
  if (unique.length > 1) {
    errors.push(`${label} disagree: ${values.map(v => `${v.name}="${v.value || 'not found'}"`).join('; ')}.`);
  }
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



const arcGates = [
  { id: 'arc-overall-minimum-source-version', label: 'Azure Arc migration overall minimum source version' },
  { id: 'arc-lrs-minimum-source-version', label: 'Azure Arc to Azure SQL MI via LRS minimum source version' },
  { id: 'arc-mi-link-minimum-source-version', label: 'Azure Arc to Azure SQL MI via MI Link minimum source version' },
  { id: 'arc-sql-vm-minimum-source-version', label: 'Azure Arc to SQL Server on Azure VM minimum source version', optional: true }
];
for (const gate of arcGates) {
  compareAcrossDocs(gate.label, consistencyDocs.map(doc => ({ name: doc.name, value: extractArcGate(doc.text, gate) })), { optional: gate.optional });
}
compareAcrossDocs('MI Link required network ports', consistencyDocs.map(doc => ({ name: doc.name, value: extractPorts(doc.text) })));
compareAcrossDocs('MI Link maximum links/databases capacity', consistencyDocs.map(doc => ({ name: doc.name, value: extractMiLinkCapacity(doc.text) })));
compareAcrossDocs('Azure Arc portal MI wizard database batch limit', consistencyDocs.map(doc => ({ name: doc.name, value: extractArcWizardBatchLimit(doc.text) })));

// Second knowledge base: connectivity. Added as an independent block on purpose. The checks above
// are tuned to the migration knowledge base and its rule set, and folding a second document into
// them would risk the first skill's guarantees for no benefit. This block reads its own files,
// pushes into the same error list, and skips cleanly when the files are absent -- which is the case
// in the Microsoft fork, where only the migration skill is ported.
{
  const CONN_DOC = path.join(ROOT, 'docs', 'sql-server-to-azure-migration-connectivity.md');
  const CONN_MATRIX = path.join(ROOT, 'skills', 'get-connection-details', 'reference', 'connectivity-matrix.json');
  const CONN_SKILL = path.join(ROOT, 'skills', 'get-connection-details', 'SKILL.md');

  if (fs.existsSync(CONN_DOC) && fs.existsSync(CONN_MATRIX)) {
    const connDoc = read(CONN_DOC);
    let matrix = null;
    try { matrix = JSON.parse(read(CONN_MATRIX)); }
    catch { errors.push('connectivity matrix is not valid JSON'); }

    if (matrix) {
      const docVersion = first(/\*\*Version\.\*\*\s*v(\d+\.\d+)/, connDoc);
      if (!docVersion) {
        errors.push('connectivity KB carries no version stamp');
      } else if (docVersion !== matrix.version) {
        errors.push(`connectivity KB is v${docVersion} while its matrix is v${matrix.version}; the prose is generated from the matrix, so they cannot ship apart`);
      }

      // The changelog must record the version being shipped, or a reader cannot tell what changed.
      if (docVersion && !new RegExp(`\\|\\s*v${docVersion.replace('.', '\\.')}\\s*\\|`).test(connDoc)) {
        errors.push(`connectivity KB v${docVersion} has no changelog row`);
      }

      // Values that have each been wrong once, in a draft or in an audit finding.
      const loadBearing = [
        ['3342', 'the Managed Instance public endpoint port'],
        ['1433 to 65535', 'the Azure SQL Database private-endpoint Redirect range']
      ];
      for (const [needle, what] of loadBearing) {
        if (!connDoc.includes(needle)) errors.push(`connectivity KB no longer states ${what} (${needle})`);
      }

      // Drift detection has to keep covering the volatile pages, or the facts stop expiring.
      const registryPath = path.join(ROOT, 'reference', 'claims-registry.json');
      if (fs.existsSync(registryPath)) {
        const registry = JSON.parse(read(registryPath));
        const claims = Array.isArray(registry) ? registry : registry.claims;
        const conn = claims.filter(c => String(c.claim_id).startsWith('conn-'));
        if (conn.length < 10) errors.push(`only ${conn.length} connectivity claims are registered; the volatile source pages are no longer all watched`);
        const unhashed = conn.filter(c => !c.verification_hash).map(c => c.claim_id);
        if (unhashed.length) errors.push(`connectivity claims without a baseline hash can never report drift: ${unhashed.join(', ')}`);
      }

      // While the knowledge base is under review, the status line is the only thing telling a user
      // which facts are provisional. It ships to every plugin installer.
      if (fs.existsSync(CONN_SKILL)) {
        const connSkill = read(CONN_SKILL);
        if (!/Status: draft/.test(connSkill)) {
          errors.push('get-connection-details no longer declares itself a draft while its knowledge base is under review');
        }
        if (!connSkill.includes(`v${matrix.version}`)) {
          errors.push(`get-connection-details does not quote connectivity KB v${matrix.version}`);
        }
      }
      if (!errors.length) console.log(`Connectivity KB checked: v${matrix.version}.`);
    }
  }
}

for (const w of warnings) console.warn(`WARNING: ${w}`);
if (errors.length) {
  console.error('KB consistency check failed:');
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}
console.log(`KB consistency check passed: ${kbVersion}; freshness ${kbMonth}; ${warnings.length} warning(s).`);



