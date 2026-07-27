// Classify lychee markdown output into ok / unreachable / unverified bot-blocked.
// 403 and 429 must not be accepted as healthy links.
import fs from 'node:fs';

const read = (p, f = '') => { try { return fs.readFileSync(p, 'utf8'); } catch { return f; } };
const exitCode = (process.env.LYCHEE_EXIT || '0').trim();
const report = read('lychee-report.md');
const lines = report.split(/\r?\n/);
const botBlocked = [];
const unreachable = [];

for (const line of lines) {
  const status = line.match(/\b(?:HTTP\s*)?(403|429|[45]\d\d)\b/);
  if (!status) continue;
  const url = (line.match(/https?:\/\/[^\s)\]>"']+/) || [''])[0].replace(/[),.;]+$/, '');
  const item = { status: Number(status[1]), url: url || line.trim().slice(0, 240), line: line.trim() };
  if (item.status === 403 || item.status === 429) botBlocked.push(item);
  else unreachable.push(item);
}

const summary = {
  ok: exitCode === '0' && botBlocked.length === 0 && unreachable.length === 0,
  exitCode,
  unreachable,
  unverifiedBotBlocked: botBlocked,
  note: '403/429 are classified as unverified bot-blocked, not healthy links.'
};
fs.writeFileSync('link-summary.json', JSON.stringify(summary, null, 2));

let md = '## Link check classification\n\n';
md += `- Healthy run: **${summary.ok ? 'yes' : 'no'}**\n`;
md += `- Unreachable links: **${unreachable.length}**\n`;
md += `- Unverified bot-blocked links (403/429): **${botBlocked.length}**\n\n`;
function table(title, items) {
  md += `### ${title}\n\n`;
  if (!items.length) { md += '_None._\n\n'; return; }
  md += '| Status | URL / evidence |\n|---:|---|\n';
  for (const it of items) md += `| ${it.status} | ${String(it.url || it.line).replace(/\|/g, '\\|')} |\n`;
  md += '\n';
}
table('Unreachable', unreachable);
table('Unverified (bot-blocked: 403/429)', botBlocked);
fs.writeFileSync('link-summary.md', md);
console.log(JSON.stringify({ unreachable: unreachable.length, unverifiedBotBlocked: botBlocked.length, ok: summary.ok }));
