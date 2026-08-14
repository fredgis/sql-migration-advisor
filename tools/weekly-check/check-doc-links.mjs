// Verify that every source a knowledge base cites still resolves, and that every heading it points
// at still exists.
//
//   node tools/weekly-check/check-doc-links.mjs [--kb migration] [--concurrency 8]
//
// Two failures this catches that a plain link check does not:
//
//   A URL of the form page#section returns HTTP 200 when the page exists and the section is gone.
//   The citation is then broken while every link checker calls it healthy, and a reader follows it
//   to a page that does not say what was attributed to it.
//
//   An in-document reference such as [§16 Sources](#16-sources-microsoft-learn) breaks whenever a
//   heading is retitled. Nothing external is involved, so no network check would ever see it.
//
// Persistent 403 and 429 are reported as unverified rather than broken: a bot filter is not
// evidence that a page is gone, and reporting it as one trains a reader to ignore the report.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, TARGETS, byId, TARGET_IDS, linkScanFiles } from './kb-targets.mjs';

const arg = (name, def = null) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def;
};
const only = arg('kb');
if (only && !byId(only)) { console.error(`--kb must be one of: ${TARGET_IDS.join(', ')}`); process.exit(2); }
const CONCURRENCY = Math.max(1, parseInt(arg('concurrency', '8'), 10) || 8);
const TIMEOUT = 30000;
const targets = only ? [byId(only)] : TARGETS;

const UA = 'sql-migration-advisor-source-check/1.0';

// GitHub's heading slug: lowercase, drop anything that is not a word character, space or hyphen,
// then spaces to hyphens. Repeats gain a numeric suffix.
function slugsOf(markdown) {
  const seen = new Map();
  const slugs = new Set();
  let inFence = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s*```/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const m = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!m) continue;
    const base = m[2]
      .replace(/`([^`]*)`/g, '$1')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[*_~]/g, '')
      .trim()
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      // One hyphen per space, not one per run of spaces. Removing "&" from "context & ai" leaves two
      // spaces and therefore two hyphens, which is what GitHub links to; collapsing them reported
      // every such heading as a broken anchor.
      .replace(/\s/g, '-');
    const n = seen.get(base) || 0;
    seen.set(base, n + 1);
    slugs.add(n ? `${base}-${n}` : base);
  }
  // Explicit anchors authored as HTML are legitimate targets too.
  for (const m of markdown.matchAll(/<a\s+[^>]*(?:id|name)\s*=\s*["']([^"']+)["']/gi)) slugs.add(m[1].toLowerCase());
  return slugs;
}

// `bare` additionally collects URLs written outside link syntax, typically in backticks. Policy
// documents instruct the model to fetch a literal address, and the release pin is written that way:
// scanning only `](…)` would leave the single most fragile URL in the repository unchecked.
function linksOf(markdown, { bare = false } = {}) {
  const out = [];
  let inFence = false;
  const lines = markdown.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*```/.test(lines[i])) { inFence = !inFence; continue; }
    if (inFence) continue;
    const taken = new Set();
    for (const m of lines[i].matchAll(/\]\(\s*(<[^>]+>|[^()\s]+(?:\([^()]*\)[^()\s]*)*)\s*(?:"[^"]*")?\)/g)) {
      const url = m[1].replace(/^<|>$/g, '');
      if (/^(mailto:|tel:)/i.test(url)) continue;
      taken.add(url);
      out.push({ url, line: i + 1 });
    }
    if (!bare) continue;
    for (const m of lines[i].matchAll(/https?:\/\/[^\s`)<>\]"'|]+/g)) {
      const url = m[0].replace(/[.,;:]+$/, '');
      if (taken.has(url)) continue;
      taken.add(url);
      out.push({ url, line: i + 1 });
    }
  }
  return out;
}

function anchorPresent(html, fragment) {
  const want = decodeURIComponent(fragment).toLowerCase();
  const escaped = want.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`\\b(?:id|name)\\s*=\\s*["']${escaped}["']`, 'i').test(html)) return true;
  // Microsoft Learn renders some in-page targets as data attributes rather than ids.
  return new RegExp(`data-(?:heading-id|bi-name)\\s*=\\s*["']${escaped}["']`, 'i').test(html);
}

async function request(url, method) {
  return fetch(url, {
    method,
    redirect: 'follow',
    headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,*/*' },
    signal: AbortSignal.timeout(TIMEOUT)
  });
}

async function checkUrl(url, needsAnchor) {
  try {
    // HEAD first: cheap, and enough whenever no anchor has to be proven. Several Microsoft hosts
    // answer HEAD with 400 or 405 while serving GET normally, so a HEAD refusal is retried rather
    // than reported — otherwise the report fills with pages that are perfectly reachable.
    let res = needsAnchor ? null : await request(url, 'HEAD');
    if (!res || [400, 403, 405, 406, 429, 501].includes(res.status)) res = await request(url, 'GET');
    if (res.status === 403 || res.status === 429) return { state: 'unverified', status: res.status, reason: 'bot-blocked' };
    if (!res.ok) return { state: 'broken', status: res.status, reason: `HTTP ${res.status}` };
    if (!needsAnchor) return { state: 'ok', status: res.status };
    const html = await res.text();
    return anchorPresent(html, needsAnchor)
      ? { state: 'ok', status: res.status }
      : { state: 'broken', status: res.status, reason: `page resolves but the "#${needsAnchor}" anchor is gone` };
  } catch (e) {
    return { state: 'broken', status: 0, reason: e.name === 'TimeoutError' ? `no response within ${TIMEOUT / 1000}s` : e.message };
  }
}

// ---- collect ---------------------------------------------------------------------------------
const work = new Map();   // url -> { anchor, sites: [{kb, doc, line}] }
const localFailures = [];
const docs = [];
const seenFiles = new Set();

for (const target of targets) {
  for (const file of linkScanFiles(target)) {
    if (seenFiles.has(file)) continue;
    seenFiles.add(file);
    const md = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const slugs = slugsOf(md);
    const links = linksOf(md, { bare: file !== target.doc });
    docs.push({ id: target.id, doc: file, links: links.length, headings: slugs.size });
    for (const { url, line } of links) {
      if (url.startsWith('#')) {
        const frag = decodeURIComponent(url.slice(1)).toLowerCase();
        if (frag && !slugs.has(frag)) {
          localFailures.push({ kb: target.id, doc: file, line, url, reason: 'no heading in this document produces that anchor' });
        }
        continue;
      }
      if (!/^https?:\/\//i.test(url)) {
        // A relative path, resolved against the directory of the file that wrote it.
        const rel = url.split('#')[0];
        if (rel && !fs.existsSync(path.resolve(path.dirname(path.join(ROOT, file)), rel))) {
          localFailures.push({ kb: target.id, doc: file, line, url, reason: 'the referenced file does not exist' });
        }
        continue;
      }
      const [bare, frag] = url.split('#');
      const entry = work.get(bare) || { anchors: new Set(), sites: [] };
      if (frag) entry.anchors.add(frag);
      entry.sites.push({ kb: target.id, doc: file, line, url });
      work.set(bare, entry);
    }
  }
}

// ---- check -----------------------------------------------------------------------------------
const jobs = [];
for (const [bare, entry] of work) {
  if (entry.anchors.size) for (const a of entry.anchors) jobs.push({ bare, anchor: a, sites: entry.sites.filter(s => s.url.endsWith(`#${a}`)) });
  else jobs.push({ bare, anchor: null, sites: entry.sites });
}

const broken = [];
const unverified = [];
let okCount = 0;
let cursor = 0;
async function worker() {
  while (cursor < jobs.length) {
    const job = jobs[cursor++];
    const result = await checkUrl(job.bare, job.anchor);
    const record = {
      url: job.anchor ? `${job.bare}#${job.anchor}` : job.bare,
      status: result.status,
      reason: result.reason,
      kbs: [...new Set(job.sites.map(s => s.kb))],
      sites: job.sites.map(s => `${s.doc}:${s.line}`)
    };
    if (result.state === 'ok') okCount++;
    else if (result.state === 'unverified') unverified.push(record);
    else broken.push(record);
  }
}
console.error(`checking ${jobs.length} unique source URL(s) across ${targets.length} knowledge base(s)…`);
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));

// ---- report ----------------------------------------------------------------------------------
const failures = [...localFailures.map(f => ({ ...f, status: 0, kbs: [f.kb], sites: [`${f.doc}:${f.line}`] })), ...broken];
const ok = failures.length === 0;
const perKb = Object.fromEntries(targets.map(t => [t.id, {
  checked: jobs.filter(j => j.sites.some(s => s.kb === t.id)).length,
  broken: failures.filter(f => f.kbs.includes(t.id)).length,
  unverified: unverified.filter(u => u.kbs.includes(t.id)).length
}]));

const perFile = Object.fromEntries(docs.map(d => {
  const mine = s => String(s).startsWith(`${d.doc}:`);
  return [d.doc, {
    checked: jobs.filter(j => j.sites.some(s => s.doc === d.doc)).length,
    broken: failures.filter(f => f.sites.some(mine)).length,
    unverified: unverified.filter(u => u.sites.some(mine)).length
  }];
}));

fs.writeFileSync('doc-links.json', JSON.stringify({ ok, checked: jobs.length, okCount, docs, perKb, perFile, failures, unverified }, null, 2));

let md = '## Knowledge-base source and anchor verification\n\n';
md += `- Healthy: **${ok ? 'yes' : 'no'}**\n`;
md += `- Unique source URLs checked: **${jobs.length}** (resolved: ${okCount})\n`;
md += `- Broken sources or anchors: **${failures.length}**\n`;
md += `- Unverified (bot-blocked 403/429): **${unverified.length}**\n\n`;
md += '| Document | Knowledge base | Links | Headings | Checked | Broken | Unverified |\n|---|---|---:|---:|---:|---:|---:|\n';
for (const d of docs) {
  const p = perFile[d.doc];
  md += `| \`${d.doc}\` | ${d.id} | ${d.links} | ${d.headings} | ${p.checked} | ${p.broken} | ${p.unverified} |\n`;
}
md += '\n';
function table(title, rows) {
  md += `### ${title}\n\n`;
  if (!rows.length) { md += '_None._\n\n'; return; }
  md += '| Where | URL | Why |\n|---|---|---|\n';
  for (const r of rows) md += `| ${r.sites.join(', ')} | ${String(r.url).replace(/\|/g, '\\|')} | ${String(r.reason || '').replace(/\|/g, '\\|')} |\n`;
  md += '\n';
}
table('Broken sources and anchors', failures);
table('Unverified (bot-blocked)', unverified);
fs.writeFileSync('doc-links.md', md);

console.log(`sources: checked=${jobs.length} ok=${okCount} broken=${failures.length} unverified=${unverified.length}`);
for (const f of failures) console.error(`  ✗ ${f.url} — ${f.reason} (${f.sites.join(', ')})`);
if (!ok) process.exit(1);
