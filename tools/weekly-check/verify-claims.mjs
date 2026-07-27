// Verify source-section content hashes for high-risk claims. This detects silent
// Microsoft Learn/source drift and reports affected rules for human review.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const REGISTRY = path.join(ROOT, 'reference', 'claims-registry.json');
const UPDATE = process.argv.includes('--update-hashes');
const TODAY = new Date().toISOString().slice(0, 10);

const registry = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));
const drifted = [];
const unverified = [];
const verified = [];
const updated = [];

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<\/?(?:p|div|li|ul|ol|table|tr|td|th|br|section|article|main)[^>]*>/gi, '\n')
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, t) => `\n@@H${n} ${strip(t)}\n`)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
}
function strip(s) { return (s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
function normalize(s) { return (s || '').replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim(); }
function sectionFromText(text, heading) {
  const normalized = normalize(text);
  if (!heading) return normalized;
  const lines = normalized.split('\n');
  const target = heading.toLowerCase();
  let start = -1;
  let level = 7;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^@@H([1-6])\s+(.+)$/);
    if (m && m[2].toLowerCase().includes(target)) { start = i; level = Number(m[1]); break; }
  }
  if (start < 0) return normalized;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i].match(/^@@H([1-6])\s+/);
    if (m && Number(m[1]) <= level) { end = i; break; }
  }
  return normalize(lines.slice(start, end).join('\n').replace(/^@@H[1-6]\s+/gm, ''));
}
async function fetchSection(entry) {
  const res = await fetch(entry.source_url, {
    headers: { 'user-agent': 'sql-migration-advisor-claim-verifier/1.0', accept: 'text/html, text/markdown, */*' },
    signal: AbortSignal.timeout(30000)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.text();
  return sectionFromText(htmlToText(body), entry.source_section);
}
function hash(s) { return crypto.createHash('sha256').update(normalize(s), 'utf8').digest('hex'); }

for (const entry of registry) {
  try {
    const section = await fetchSection(entry);
    const currentHash = hash(section);
    if (!entry.verification_hash || UPDATE) {
      entry.verification_hash = currentHash;
      entry.last_verified = TODAY;
      updated.push({ claim_id: entry.claim_id, affected_rules: entry.affected_rules });
    } else if (entry.verification_hash !== currentHash) {
      drifted.push({ claim_id: entry.claim_id, source_url: entry.source_url, source_section: entry.source_section, affected_rules: entry.affected_rules, old_hash: entry.verification_hash, new_hash: currentHash });
    } else {
      entry.last_verified = TODAY;
      verified.push({ claim_id: entry.claim_id });
    }
  } catch (e) {
    unverified.push({ claim_id: entry.claim_id, source_url: entry.source_url, source_section: entry.source_section, affected_rules: entry.affected_rules, reason: e.message });
  }
}
if (UPDATE) fs.writeFileSync(REGISTRY, JSON.stringify(registry, null, 2) + '\n');

const result = { updated, verified, drifted, unverified, updateHashes: UPDATE };
fs.writeFileSync('claims-report.json', JSON.stringify(result, null, 2));
let md = '## Claims/source drift check\n\n';
md += `- Baseline/update mode: **${UPDATE ? 'yes' : 'no'}**\n`;
md += `- Verified unchanged: **${verified.length}**\n`;
md += `- Hashes updated/baselined: **${updated.length}**\n`;
md += `- Drifted claims needing human review: **${drifted.length}**\n`;
md += `- Unverified claims (fetch/source unavailable): **${unverified.length}**\n\n`;
function list(title, items, render) {
  md += `### ${title}\n\n`;
  if (!items.length) { md += '_None._\n\n'; return; }
  for (const it of items) md += render(it) + '\n';
  md += '\n';
}
list('Drifted claims', drifted, it => `- **${it.claim_id}** (${it.source_section}) — affected rules: ${it.affected_rules.join(', ')} — ${it.source_url}`);
list('Unverified claims', unverified, it => `- **${it.claim_id}** (${it.reason}) — affected rules: ${it.affected_rules.join(', ')} — ${it.source_url}`);
list('Updated/baselined hashes', updated, it => `- **${it.claim_id}** — affected rules: ${it.affected_rules.join(', ')}`);
fs.writeFileSync('claims-report.md', md);

console.log(`claims: verified=${verified.length} updated=${updated.length} drifted=${drifted.length} unverified=${unverified.length}`);
// Fetch failures are reported but do not crash. Drift exits non-zero only outside update mode.
if (!UPDATE && drifted.length > 0) process.exit(1);
