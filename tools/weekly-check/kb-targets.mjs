// The three knowledge bases this repository maintains, described once so that every stage of the
// weekly check agrees on the set.
//
// Before this registry existed each stage carried its own private idea of what "the knowledge base"
// meant: the review prompt knew one document, the link check knew two, the claims registry watched a
// third, and the apply step stamped only the first. A fact could therefore be checked for consistency
// and never reviewed, or reviewed and never stamped. Adding a fourth knowledge base meant finding
// every one of those places. Now a target is declared here and every stage picks it up.
//
// Each target owns the metadata shape of its own document, because the three genuinely differ:
// the Advisor knowledge base carries a changelog table and a README badge, the prerequisite base
// carries a version echoed by five skill files, and the connectivity base is generated from a
// matrix that must ship with it. Those differences are expressed as functions here rather than as
// branches inside apply-update.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const readFile = (rel, fallback = null) => {
  try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return fallback; }
};

const monthYearOf = iso => new Date(`${iso}T00:00:00Z`)
  .toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const dayMonthYearOf = iso => {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${d.getUTCDate()} ${d.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })} ${d.getUTCFullYear()}`;
};

// A changelog row must survive being read back as a table cell.
const cell = text => String(text || '').replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

function bumpVersion(version, bump) {
  const m = String(version).match(/^v?(\d+)\.(\d+)$/);
  if (!m) return null;
  let [maj, min] = [Number(m[1]), Number(m[2])];
  if (bump === 'major') { maj += 1; min = 0; } else { min += 1; }
  return `v${maj}.${min}`;
}

/**
 * @typedef {Object} KbTarget
 * @property {string} id                 stable short id used on the command line and in file names
 * @property {string} title              human name used in prompts and reports
 * @property {string} doc                the knowledge base itself, relative to the repository root
 * @property {string[]} companions       files a finding may name besides the document
 * @property {string[]} context          files reproduced in the review prompt besides the document
 * @property {string[]} claimPrefixes    claim_id prefixes belonging to this base; [] means "the rest"
 * @property {string[]} newsTopics       regular expressions routing a news item to this base
 * @property {string} scope              what this base answers, stated to the model
 * @property {(io: Io) => string|null} readVersion
 * @property {(io: Io, iso: string) => void} stamp        refresh the freshness marker only
 * @property {(io: Io, o: BumpOptions) => string} bump    raise the version and record the change
 */

export const TARGETS = [
  {
    id: 'migration',
    title: 'Migration Advisor knowledge base',
    doc: 'docs/sql-server-to-azure-migration.md',
    companions: ['reference/decision-rules.md'],
    context: ['reference/decision-rules.md'],
    policyDocs: ['skills/recommend-migration-path/SKILL.md', 'reference/decision-rules.md'],
    claimPrefixes: [],
    newsTopics: [
      'migrat', 'assessment', 'azure migrate', 'database migration service', '\\bdms\\b',
      'managed instance link', 'mi link', 'log replay', 'backup', 'restore', 'replication',
      'retirement', 'retire', 'deprecat', 'end of support', 'lifecycle', '\\besu\\b',
      'extended security updates', 'azure hybrid benefit', 'pricing', 'licens',
      'downtime', 'cutover', 'data box', 'striim', 'fabric mirroring', 'arc-enabled sql'
    ],
    scope:
      'Which Azure target and which migration method to choose for a SQL Server estate, and the '
      + 'version floors, downtime characteristics, retirement dates and licensing rules that drive '
      + 'that choice. reference/decision-rules.md is an offline mirror of this document and must '
      + 'agree with it.',
    readVersion: io => (io.read('docs/sql-server-to-azure-migration.md') || '')
      .match(/\*\*Version\.\*\*\s*(v\d+\.\d+)/)?.[1] || null,

    stamp(io, iso) {
      const monthYear = monthYearOf(iso);
      io.edit('docs/sql-server-to-azure-migration.md', t => t
        .replace(/current as of (?:\d{1,2}\s+)?[A-Za-z]+\s+\d{4}/gi, `current as of ${monthYear}`)
        // Backed by check-doc-links.mjs, which re-resolves every source and re-proves every anchor
        // in this document each week. The line would otherwise claim a verification date older than
        // the verification that actually happened.
        .replace(/(Links last verified:\s*)(?:\d{1,2}\s+)?[A-Za-z]+\s+\d{4}/gi, `$1${dayMonthYearOf(iso)}`));
      io.edit('reference/decision-rules.md', t =>
        t.replace(/(\(sql-migration-advisor\),\s*\*\*v\d+\.\d+\*\*,\s*verified\s*)(?:\d{1,2}\s+)?[A-Za-z]+\s+\d{4}/,
          `$1${monthYear}`));
    },

    bump(io, { bump, changelog, iso }) {
      const doc = 'docs/sql-server-to-azure-migration.md';
      const current = this.readVersion(io);
      const next = bumpVersion(current, bump);
      if (!next) throw new Error(`could not read a version from ${doc}`);
      const monthYear = monthYearOf(iso);
      const row = cell(changelog);

      io.edit(doc, md => {
        let out = md
          .replace(/(\*\*Version\.\*\*\s*)v\d+\.\d+(\s*[—-]\s*)(?:\d{1,2}\s+)?[A-Za-z]+\s+\d{4}/, `$1${next}$2${monthYear}`)
          .replace(/current as of (?:\d{1,2}\s+)?[A-Za-z]+\s+\d{4}/gi, `current as of ${monthYear}`)
          .replace(/(Current version:\s*\*\*)v\d+\.\d+(\*\*\s*\()\d{4}-\d{2}-\d{2}(\))/, `$1${next}$2${iso}$3`)
          .replace(/current:\s*v\d+\.\d+/g, `current: ${next}`);
        const header = /(\|\s*Version\s*\|\s*Date\s*\|\s*Changes\s*\|\r?\n\|[-\s|]+\|\r?\n)/;
        if (!header.test(out)) throw new Error(`could not find the changelog table header in ${doc}`);
        out = out.replace(header, `$1| ${next} | ${iso} | ${row} |\n`);
        return out.replace(/(Links last verified:\s*)(?:\d{1,2}\s+)?[A-Za-z]+\s+\d{4}/gi, `$1${dayMonthYearOf(iso)}`);
      });

      // The README badge, the skill and version.json all republish this line. A bump that moves the
      // document alone leaves installed copies believing they are current.
      io.edit('README.md', rd => {
        let out = rd
          .replace(/(alt="Knowledge base )v\d+\.\d+(")/g, `$1${next}$2`)
          .replace(/(knowledge%20base-)v\d+\.\d+(-)/g, `$1${next}$2`)
          .replace(/v\d+\.\d+, (?:\d{1,2}\s+)?[A-Za-z]+ \d{4}/g, `${next}, ${monthYear}`)
          .replace(/(current:\s*<b>)v\d+\.\d+(<\/b>\s*\()(?:\d{1,2}\s+)?[A-Za-z]+ \d{4}(\))/, `$1${next}$2${monthYear}$3`);
        const clRe = /(<!-- CHANGELOG:START -->[\s\S]*?\|\s*Version\s*\|\s*Date\s*\|\s*Summary\s*\|\r?\n\|[-\s|]+\|\r?\n)/;
        if (clRe.test(out)) out = out.replace(clRe, `$1| ${next} | ${iso} | ${row} |\n`);
        return out;
      });
      io.edit('reference/decision-rules.md', t => t
        .replace(/(\(sql-migration-advisor\),\s*\*\*)v\d+\.\d+(\*\*,\s*verified\s*)(?:\d{1,2}\s+)?[A-Za-z]+\s+\d{4}/,
          `$1${next}$2${monthYear}`));
      io.edit('skills/recommend-migration-path/SKILL.md', t =>
        t.replace(/(knowledge-base line:\s*\*\*)v\d+\.\d+(\*\*)/, `$1${next}$2`));
      io.editJson('version.json', manifest => {
        manifest.knowledgeBase = next;
        manifest.latest = `${next}.0`;
        manifest.released = iso;
        return manifest;
      });
      return next;
    }
  },

  {
    id: 'prerequisite',
    title: 'Migration prerequisite knowledge base',
    doc: 'docs/sql-server-to-azure-migration-prerequisite.md',
    companions: ['skills/generate-migration-prerequisite-plan/reference/path-catalog.json'],
    context: [],
    policyDocs: ['skills/generate-migration-prerequisite-plan/SKILL.md'],
    claimPrefixes: ['p'],
    newsTopics: [
      'prerequisite', 'requirement', 'supported version', 'minimum version', 'compatibility',
      'assessment', 'readiness', 'quota', 'limit', 'permission', 'role', 'rbac',
      'service principal', 'managed identity', 'storage account', 'blob', 'data box',
      'sqlpackage', 'bacpac', 'bcp', 'smart bulk copy', 'data factory', 'striim',
      'fabric migration assistant', 'azure migrate', 'log replay', 'managed instance link'
    ],
    scope:
      'What must be true before a chosen migration path can start: source and target version '
      + 'floors, networking, identity and permission requirements, tooling, capacity and licensing '
      + 'preconditions for each of the 28 catalogued paths. It selects nothing; it converts an '
      + 'already-made choice into a sourced readiness plan.',
    readVersion: io => (io.read('docs/sql-server-to-azure-migration-prerequisite.md') || '')
      .match(/\*\*Version:\*\*\s*(v\d+\.\d+)/)?.[1] || null,

    stamp(io, iso) {
      io.edit('docs/sql-server-to-azure-migration-prerequisite.md', t =>
        t.replace(/(\*\*Last verified:\*\*\s*)\d{4}-\d{2}-\d{2}/, `$1${iso}`));
    },

    bump(io, { bump, iso }) {
      const doc = 'docs/sql-server-to-azure-migration-prerequisite.md';
      const next = bumpVersion(this.readVersion(io), bump);
      if (!next) throw new Error(`could not read a version from ${doc}`);
      io.edit(doc, t => t
        .replace(/(\*\*Version:\*\*\s*)v\d+\.\d+/, `$1${next}`)
        .replace(/(\*\*Last verified:\*\*\s*)\d{4}-\d{2}-\d{2}/, `$1${iso}`));
      // Five files in the companion skill restate this line, and the consistency gate fails the run
      // if any of them disagrees. They move together or not at all.
      const dir = 'skills/generate-migration-prerequisite-plan';
      io.editJson(`${dir}/reference/path-catalog.json`, c => ({ ...c, knowledgeBaseVersion: next }));
      io.edit(`${dir}/schemas/output.schema.json`, t =>
        t.replace(/("prerequisiteKnowledgeBaseVersion":\s*\{\s*"const":\s*")v\d+\.\d+(")/, `$1${next}$2`));
      for (const rel of ['reference/input-contract.md', 'reference/output-contract.md']) {
        io.edit(`${dir}/${rel}`, t =>
          t.replace(/(Prerequisite knowledge-base line:\*\*\s*`)v\d+\.\d+(`)/, `$1${next}$2`));
      }
      io.edit(`${dir}/SKILL.md`, t =>
        t.replace(/(schema\/KB line `[\d.]+`\/`)v\d+\.\d+(`)/, `$1${next}$2`));
      return next;
    }
  },

  {
    id: 'connectivity',
    title: 'Connectivity knowledge base',
    doc: 'docs/sql-server-to-azure-migration-connectivity.md',
    companions: ['skills/get-connection-details/reference/connectivity-matrix.json'],
    context: [],
    policyDocs: ['skills/get-connection-details/SKILL.md'],
    claimPrefixes: ['conn-'],
    newsTopics: [
      'connect', 'connection string', 'private link', 'private endpoint', 'public endpoint',
      'firewall', '\\bnsg\\b', 'network security group', '\\bdns\\b', 'private dns',
      '\\bport\\b', 'redirect', 'proxy', 'endpoint', '\\btls\\b', '\\bssl\\b', 'encrypt',
      'certificate', 'authentication', 'entra', 'active directory', 'driver', 'odbc', 'jdbc',
      'sqlclient', 'go-mssqldb', 'connection policy', 'outbound', 'inbound'
    ],
    scope:
      'How an application connects to an Azure SQL family target and why a connection fails: '
      + 'connection policies, ports, private and public endpoints, DNS, TLS and encryption '
      + 'defaults, driver behaviour and authentication modes. It excludes migration methods, '
      + 'tuning, pricing and licensing.',
    readVersion: io => (io.read('docs/sql-server-to-azure-migration-connectivity.md') || '')
      .match(/\*\*Version\.\*\*\s*(v\d+\.\d+)/)?.[1] || null,

    stamp(io, iso) {
      io.edit('docs/sql-server-to-azure-migration-connectivity.md', t =>
        t.replace(/(\*\*Last verified\.\*\*\s*)\d{4}-\d{2}-\d{2}/, `$1${iso}`));
    },

    bump(io, { bump, changelog, iso }) {
      const doc = 'docs/sql-server-to-azure-migration-connectivity.md';
      const next = bumpVersion(this.readVersion(io), bump);
      if (!next) throw new Error(`could not read a version from ${doc}`);
      const row = cell(changelog);
      io.edit(doc, md => {
        let out = md
          .replace(/(\*\*Version\.\*\*\s*)v\d+\.\d+(\s*[—-]\s*)(?:\d{1,2}\s+)?[A-Za-z]+\s+\d{4}/,
            `$1${next}$2${dayMonthYearOf(iso)}`)
          .replace(/(\*\*Last verified\.\*\*\s*)\d{4}-\d{2}-\d{2}/, `$1${iso}`);
        const header = /(\|\s*Version\s*\|\s*Date\s*\|\s*Changes\s*\|\r?\n\|[-\s|]+\|\r?\n)/;
        if (!header.test(out)) throw new Error(`could not find the changelog table header in ${doc}`);
        return out.replace(header, `$1| ${next} | ${iso} | ${row} |\n`);
      });
      // The prose is generated from the matrix, so the consistency gate refuses to let them ship apart.
      // The matrix records the number bare, without the leading "v" the prose uses.
      io.editJson('skills/get-connection-details/reference/connectivity-matrix.json',
        m => ({ ...m, version: next.replace(/^v/, '') }));
      // The skill quotes the line it answered from, in its header and in every example answer card,
      // so a reader can tell which facts produced the answer they are holding.
      io.edit('skills/get-connection-details/SKILL.md', t => t
        .replace(/(sql-server-to-azure-migration-connectivity\.md\)\s*)v\d+\.\d+/g, `$1${next}`)
        .replace(/(KB\s*\*\*)v\d+\.\d+(\*\*)/g, `$1${next}$2`));
      return next;
    }
  }
];

export const byId = id => TARGETS.find(t => t.id === id) || null;
export const TARGET_IDS = TARGETS.map(t => t.id);

/** Every file whose content a finding may be raised against. */
export const reviewableFiles = target => [target.doc, ...target.companions];

/**
 * Markdown whose links are resolved live. The knowledge base plus the policy documents that cite
 * sources of their own: a dead pin in a SKILL.md is read by every session, so leaving it out of the
 * sweep would protect the document nobody reads directly and not the one the model actually loads.
 */
export const linkScanFiles = target => [...new Set([target.doc, ...(target.policyDocs || [])])];

/**
 * Files whose content decides whether a change is substantive. Deliberately the documents and their
 * offline mirrors only: a matrix or catalogue that merely restates the prose is synchronised by the
 * bump itself, so counting it would make every bump look like a second substantive change.
 */
export const substantiveFiles = target => [target.doc, ...target.context];

/**
 * Claims belonging to a target.
 *
 * An explicit `knowledge_base` field wins, because a claim that names its document cannot be
 * misfiled by a naming convention. The id prefix is the fallback for older entries, and a target
 * declaring no prefix owns whatever no other target claims.
 */
export function claimsFor(target, claims) {
  const owned = TARGETS.filter(t => t.claimPrefixes.length).flatMap(t => t.claimPrefixes);
  const matches = (id, prefixes) => prefixes.some(p => String(id).toLowerCase().startsWith(p));
  return claims.filter(c => {
    if (c.knowledge_base) return c.knowledge_base === target.doc;
    if (target.claimPrefixes.length) return matches(c.claim_id, target.claimPrefixes);
    return !matches(c.claim_id, owned);
  });
}
