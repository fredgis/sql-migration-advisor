// Gather fresh web news about SQL Server -> Azure migration from public RSS feeds,
// filtered by keyword over a rolling window (default 7 days). No dependencies:
// uses global fetch + a small regex RSS/Atom parser.
//
//   node gather-news.mjs [--days 7] [--out news]
//
// Writes <out>.md (human report) and <out>.json (for the AI review step), and
// prints a one-line summary. Never throws on a single feed failure.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TARGETS } from './kb-targets.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(fs.readFileSync(path.join(HERE, 'keywords.json'), 'utf8'));

// Which knowledge bases an item might affect. Each base declares its own topics in kb-targets.mjs,
// so a new base routes news to itself without this file changing.
//
// An item matching no topic is routed to all three rather than to none. It has already passed the
// repository-wide relevance filter above, so the only question left is which base it lands in, and
// guessing wrong in the direction of silence is the failure that matters: the item disappears from
// every review and nobody learns it existed. Routed to all three, the worst case is that two
// reviewers read a headline that was not for them.
const ROUTES = TARGETS.map(t => ({ id: t.id, tests: t.newsTopics.map(s => new RegExp(s, 'i')) }));
function routeOf(item) {
  const hay = `${item.title} ${item.snippet}`;
  const hit = ROUTES.filter(r => r.tests.some(re => re.test(hay))).map(r => r.id);
  return hit.length ? hit : ROUTES.map(r => r.id);
}

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const DAYS = parseInt(arg('days', String(cfg.days || 7)), 10);
const OUT = arg('out', 'news');
const since = Date.now() - DAYS * 86400_000;

const include = cfg.include.map(s => new RegExp(s, 'i'));
const exclude = (cfg.exclude || []).map(s => new RegExp(s, 'i'));
const strip = s => (s || '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').trim();
const tag = (block, name) => {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? strip(m[1]) : '';
};

function parseItems(xml, source) {
  const items = [];
  const chunks = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) || [];
  for (const b of chunks) {
    const title = tag(b, 'title');
    let link = tag(b, 'link');
    if (!link) { const lm = b.match(/<link[^>]*href="([^"]+)"/i); if (lm) link = lm[1]; }
    const dateStr = tag(b, 'pubDate') || tag(b, 'updated') || tag(b, 'published') || tag(b, 'dc:date');
    const desc = tag(b, 'description') || tag(b, 'summary') || tag(b, 'content');
    const ts = dateStr ? Date.parse(dateStr) : NaN;
    items.push({ title, link, date: dateStr, ts, snippet: desc.slice(0, 400), source });
  }
  return items;
}

async function fetchFeed(feed) {
  try {
    const res = await fetch(feed.url, {
      headers: { 'user-agent': 'sql-migration-advisor-weekly-check/1.0', accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' },
      signal: AbortSignal.timeout(25000)
    });
    if (!res.ok) { console.error(`  ! ${feed.name}: HTTP ${res.status}`); return []; }
    return parseItems(await res.text(), feed.name);
  } catch (e) { console.error(`  ! ${feed.name}: ${e.message}`); return []; }
}

const all = [];
for (const feed of cfg.feeds) {
  const items = await fetchFeed(feed);
  console.error(`  ${feed.name}: ${items.length} items`);
  all.push(...items);
}

const seen = new Set();
const hits = all.filter(it => {
  if (!it.title || !it.link) return false;
  if (!Number.isNaN(it.ts) && it.ts < since) return false;   // keep undated items (rare) as candidates
  const hay = `${it.title} ${it.snippet}`;
  if (!include.some(r => r.test(hay))) return false;
  if (exclude.some(r => r.test(hay))) return false;
  const key = it.link.split('#')[0];
  if (seen.has(key)) return false; seen.add(key);
  return true;
}).sort((a, b) => (b.ts || 0) - (a.ts || 0));

// ---- write outputs ----
const fmtDate = it => (Number.isNaN(it.ts) ? (it.date || '') : new Date(it.ts).toISOString().slice(0, 10));
for (const it of hits) it.targets = routeOf(it);
const perTarget = Object.fromEntries(ROUTES.map(r => [r.id, hits.filter(h => h.targets.includes(r.id)).length]));

let md = `## Web news — SQL Server → Azure migration (last ${DAYS} days)\n\n`;
if (hits.length === 0) {
  md += `_No relevant Azure / SQL Server migration updates found in the last ${DAYS} days._\n`;
} else {
  md += `Routed to: ${ROUTES.map(r => `**${r.id}** ${perTarget[r.id]}`).join(' · ')}\n\n`;
  for (const it of hits) {
    md += `- **[${it.title}](${it.link})** — ${it.source}, ${fmtDate(it)} · routed to \`${it.targets.join('\`, \`')}\`\n`;
    if (it.snippet) md += `  \n  ${it.snippet}\n`;
  }
}
fs.writeFileSync(`${OUT}.md`, md);
fs.writeFileSync(`${OUT}.json`, JSON.stringify(hits.map(h => ({ title: h.title, link: h.link, date: fmtDate(h), source: h.source, snippet: h.snippet, targets: h.targets })), null, 2));
fs.writeFileSync(`${OUT}-routing.json`, JSON.stringify({ total: hits.length, days: DAYS, perTarget }, null, 2));

console.error(`\nrelevant items: ${hits.length} (window ${DAYS}d) -> ${OUT}.md / ${OUT}.json`);
console.error(`routing: ${ROUTES.map(r => `${r.id}=${perTarget[r.id]}`).join(' ')}`);
console.log(String(hits.length));
