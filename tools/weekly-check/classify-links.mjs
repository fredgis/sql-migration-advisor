// Classify lychee markdown output into ok / unreachable / unverified bot-blocked.
// 403 and 429 must not be accepted as healthy links.
import fs from 'node:fs';

const read = (p, f = '') => { try { return fs.readFileSync(p, 'utf8'); } catch { return f; } };
const exitCode = (process.env.LYCHEE_EXIT || '0').trim();
const report = read('lychee-report.md');
const lines = report.split(/\r?\n/);
const botBlocked = [];
const unreachable = [];

// The report of 2026-08-24 listed two unreachable links with statuses 559 and 558, and printed
// lychee's own summary rows as their evidence:
//
//   | 🔍 Total       | 559   |
//   | ✅ Successful  | 558   |
//
// `[45]\d\d` matched the totals, and with no URL on those lines the fallback printed the row itself.
// Both halves of that are bad: it invented two failures, and it hid the one real failure behind
// them, because 559 - 558 = 1 broken link that never appeared in the table. A link checker that
// reports noise instead of the broken link is worse than no link checker, since the noise is what
// gets skimmed past.
//
// Two rules fix the class rather than the symptom. An unreachable *link* must have a link, so a line
// with no URL is not a finding whatever numbers it contains. And a status is an HTTP status: 400-599
// and nothing else.
const summaryCounts = { total: null, successful: null };
for (const line of lines) {
  const total = line.match(/Total\s*\|\s*(\d+)/iu);
  if (total) summaryCounts.total = Number(total[1]);
  const ok = line.match(/Successful\s*\|\s*(\d+)/iu);
  if (ok) summaryCounts.successful = Number(ok[1]);
}

const isSummaryRow = line => /\b(Total|Successful|Errors?|Excluded|Timeouts?|Unsupported|Redirects?|Cached)\b\s*\|/iu.test(line);

for (const line of lines) {
  if (isSummaryRow(line)) continue;
  const url = (line.match(/https?:\/\/[^\s)\]>"']+/) || [''])[0].replace(/[),.;]+$/, '');
  if (!url) continue;
  const status = line.match(/\b(?:HTTP\s*)?([45]\d\d)\b/);
  if (!status) continue;
  const code = Number(status[1]);
  if (code < 400 || code > 599) continue;
  const item = { status: code, url, line: line.trim() };
  if (code === 403 || code === 429) botBlocked.push(item);
  else unreachable.push(item);
}

// Cross-check against lychee's own arithmetic. Silence here is what let one broken link stay
// invisible: if the classifier and the tool disagree about how many links failed, the report says so
// rather than quietly presenting its own count as the truth.
let reconciliation = null;
if (summaryCounts.total !== null && summaryCounts.successful !== null) {
  const reportedFailures = summaryCounts.total - summaryCounts.successful;
  const classified = unreachable.length + botBlocked.length;
  if (reportedFailures !== classified) {
    reconciliation = `lychee reports ${summaryCounts.total} links and ${summaryCounts.successful} successful, so ${reportedFailures} failed; this classifier resolved ${classified} to a URL. ${Math.abs(reportedFailures - classified)} failure(s) could not be attributed — read lychee-report.md directly.`;
  }
}

const summary = {
  ok: exitCode === '0' && botBlocked.length === 0 && unreachable.length === 0 && !reconciliation,
  exitCode,
  totals: summaryCounts,
  reconciliation,
  unreachable,
  unverifiedBotBlocked: botBlocked,
  note: '403/429 are classified as unverified bot-blocked, not healthy links.'
};
fs.writeFileSync('link-summary.json', JSON.stringify(summary, null, 2));

let md = '## Link check classification\n\n';
md += `- Healthy run: **${summary.ok ? 'yes' : 'no'}**\n`;
if (summaryCounts.total !== null) md += `- Links checked: **${summaryCounts.total}** · successful **${summaryCounts.successful}**\n`;
md += `- Unreachable links: **${unreachable.length}**\n`;
md += `- Unverified bot-blocked links (403/429): **${botBlocked.length}**\n`;
if (reconciliation) md += `\n> ⚠️ **Counts do not reconcile.** ${reconciliation}\n`;
md += '\n';
function table(title, items) {
  md += `### ${title}\n\n`;
  if (!items.length) { md += '_None._\n\n'; return; }
  md += '| Status | URL |\n|---:|---|\n';
  for (const it of items) md += `| ${it.status} | ${String(it.url).replace(/\|/g, '\\|')} |\n`;
  md += '\n';
}
table('Unreachable', unreachable);
table('Unverified (bot-blocked: 403/429)', botBlocked);
fs.writeFileSync('link-summary.md', md);
console.log(JSON.stringify({ unreachable: unreachable.length, unverifiedBotBlocked: botBlocked.length, ok: summary.ok, reconciliation }));
