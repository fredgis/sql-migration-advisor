// Cross-platform PDF build for the SQL Server -> Azure migration knowledge base.
// Renders markdown tables and Mermaid diagrams to PNG, then builds a branded PDF
// with pandoc + xelatex. Runs on Windows (Edge) and Linux CI (Chrome/Chromium).
//
// Requirements on PATH: pandoc, xelatex (TeX), and ideally poppler (pdfinfo).
// A Chromium-based browser is located via PUPPETEER_EXECUTABLE_PATH, else Edge on
// Windows, else a system Chrome/Chromium.
//
//   node build.mjs
//
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const SRC = path.join(ROOT, 'docs', 'sql-server-to-azure-migration.md');
const OUT_PDF = path.join(ROOT, 'docs', 'sql-server-to-azure-migration.pdf');
const SKILL_IMG = path.join(ROOT, 'docs', 'preview', 'sql-migration-advisor-skill.png');
const HEADER = path.join(HERE, 'header.tex');
const WD = path.join(HERE, '.build');
fs.mkdirSync(WD, { recursive: true });

// ---------- environment ----------
function findChromium() {
  const env = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (env && fs.existsSync(env)) return env;
  const candidates = process.platform === 'win32'
    ? ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
       'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
       'C:/Program Files/Google/Chrome/Application/chrome.exe']
    : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
       '/usr/bin/chromium-browser', '/usr/bin/chromium'];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  throw new Error('No Chromium/Edge/Chrome found. Set PUPPETEER_EXECUTABLE_PATH.');
}
const CHROME = findChromium();

function buildPath() {
  const extra = [];
  if (process.platform === 'win32') {
    const la = process.env.LOCALAPPDATA || '';
    extra.push(path.join(la, 'Programs', 'MiKTeX', 'miktex', 'bin', 'x64'));
    extra.push(path.join(la, 'Pandoc'));
    extra.push(path.join(process.env.APPDATA || '', 'npm'));
  }
  extra.push(path.dirname(process.execPath));
  return [...extra.filter(Boolean), process.env.PATH].join(path.delimiter);
}
const ENV = { ...process.env, PATH: buildPath() };

function mmdcCli() {
  const rel = ['node_modules', '@mermaid-js', 'mermaid-cli', 'src', 'cli.js'];
  for (const base of [HERE, ROOT, process.cwd()]) {
    const p = path.join(base, ...rel);
    if (fs.existsSync(p)) return p;
  }
  try {                                   // walk up from the package entry point
    let dir = path.dirname(require.resolve('@mermaid-js/mermaid-cli'));
    for (let i = 0; i < 6; i++) {
      const cli = path.join(dir, 'src', 'cli.js');
      if (fs.existsSync(cli)) return cli;
      dir = path.dirname(dir);
    }
  } catch { /* ignore */ }
  throw new Error('mermaid-cli (mmdc) not found — run `npm install` in tools/pdf.');
}

// ---------- read source + version ----------
let raw = fs.readFileSync(SRC, 'utf8');
const verMatch = raw.match(/\*\*Version\.\*\*\s*v([0-9.]+)\s*[—-]\s*([A-Za-z]+ \d{4})/);
const VERSION = verMatch ? `v${verMatch[1]}` : 'v1.0';
const COVER_DATE = verMatch ? verMatch[2] : new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
console.log(`source version: ${VERSION} (${COVER_DATE}); browser: ${CHROME}`);

// ---------- markdown -> body (tables & callouts pre-processed) ----------
function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function inlineMd(s) {
  s = esc(s);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, '<span class="lnk">$1</span>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  s = s.replace(/(^|[^*])\*([^*]+)\*([^*]|$)/g, '$1<i>$2</i>$3');
  return s;
}
function statusCell(raw) {
  let t = raw, glyph = null;
  if (/\u2705/.test(t)) glyph = 'ok';
  else if (/\u274C/.test(t)) glyph = 'no';
  else if (/\u2796/.test(t)) glyph = 'meh';
  else if (/\uD83D\uDD34/.test(t)) glyph = 'no';
  else if (/\u26A0/.test(t)) glyph = 'no';
  t = t.replace(/\u2705/g, '\u2713').replace(/\u274C/g, '\u2717').replace(/\u2796/g, '\u2013');
  t = t.replace(/\uD83D\uDD34\s*/g, '').replace(/\u26A0\uFE0F?\s*/g, '').replace(/[\uD83D\uDCE6\u21A9\uD83D\uDD11\uFE0F]/g, '');
  t = t.trim();
  let cls = '';
  if (glyph) { const bare = t.replace(/[\u2713\u2717\u2013]/g, '').trim(); if (bare.length <= 32) cls = glyph; }
  return { cls, text: t };
}
const CSS = `
*{box-sizing:border-box;}
body{margin:0;padding:0;background:#fff;font-family:'Segoe UI','DejaVu Sans',Arial,sans-serif;color:#1f2328;}
table{border-collapse:collapse;font-size:14.5px;line-height:1.35;}
thead th{background:#0F6CBD;color:#fff;font-weight:600;text-align:left;padding:9px 11px;border:1px solid #0c5aa0;vertical-align:middle;}
tbody td{padding:7px 11px;border:1px solid #d2d8e0;vertical-align:top;}
tbody tr:nth-child(even) td{background:#f5f8fc;}
td.ok{background:#cdeccd !important;text-align:center;font-weight:600;color:#1c6b1c;}
td.no{background:#f3cccc !important;text-align:center;font-weight:600;color:#9c2b2b;}
td.meh{background:#e4e7eb !important;text-align:center;color:#666;}
code{font-family:'DejaVu Sans Mono',Consolas,monospace;font-size:13px;background:#eef1f4;padding:1px 4px;border-radius:3px;}
.lnk{color:#0F6CBD;}
b{font-weight:600;}
`;

async function renderBody() {
  let md = raw.replace(/^# [^\r\n]*\r?\n/, '');   // drop H1 (YAML title takes over)
  let lines = md.split('\n');

  // pass 1: strip <details>/<summary>, un-number headings, normalise callouts & glyphs
  let inf = false;
  for (let i = 0; i < lines.length; i++) {
    let ln = lines[i]; const t = ln.replace(/^\s+/, '');
    if (t.startsWith('```')) { inf = !inf; continue; }
    if (inf) continue;
    if (/^\s*<\/?details\b[^>]*>\s*$/i.test(ln)) { lines[i] = ''; continue; }
    const sm = ln.match(/^\s*<summary>(.*?)<\/summary>\s*$/i);
    if (sm) { lines[i] = '**' + sm[1].replace(/<[^>]+>/g, '').trim() + '**'; continue; }
    if (/^#{1,6}\s/.test(ln)) { lines[i] = ln.replace(/^(#{1,6})\s+\d+(\.\d+)*\.?\s+/, '$1 '); continue; }
    ln = ln.replace('> [!IMPORTANT]', '> **IMPORTANT**').replace('> [!NOTE]', '> **NOTE**')
           .replace('> [!WARNING]', '> **WARNING**').replace('> [!TIP]', '> **TIP**')
           .replace('> [!CAUTION]', '> **CAUTION**');
    ln = ln.replace(/\[([^\]]+)\]\(#[^)]*\)/g, '$1');   // drop internal anchor links
    if (!t.startsWith('|')) {
      ln = ln.replace(/\u2705/g, '\u2713').replace(/\u274C/g, '\u2717').replace(/\u2796/g, '\u2013')
             .replace(/\uD83D\uDD34/g, '').replace(/\u26A0\uFE0F?/g, '').replace(/[\uD83D\uDCE6\u21A9\uD83D\uDD11\uFE0F]/g, '');
    }
    lines[i] = ln;
  }

  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1700, height: 1200, deviceScaleFactor: 2 });

  const isSep = s => /^\s*\|?[\s:|]*-{2,}[\s:|-]*\|?\s*$/.test(s) && s.includes('-');
  const cells = row => { let c = row.trim(); if (c.startsWith('|')) c = c.slice(1); if (c.endsWith('|')) c = c.slice(0, -1); return c.split('|').map(x => x.trim()); };

  const out = []; let k = 0; inf = false;
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i]; const t = ln.replace(/^\s+/, '');
    if (t.startsWith('```')) { inf = !inf; out.push(ln); continue; }
    if (inf) { out.push(ln); continue; }
    if (t.startsWith('|') && i + 1 < lines.length && isSep(lines[i + 1])) {
      const header = cells(lines[i]); const ncol = header.length;
      let j = i + 2; const rows = [];
      while (j < lines.length && lines[j].replace(/^\s+/, '').startsWith('|')) { rows.push(cells(lines[j])); j++; }
      const thtml = '<tr>' + header.map(h => `<th>${inlineMd(h)}</th>`).join('') + '</tr>';
      let bhtml = '';
      const colLen = new Array(ncol).fill(0);
      for (const r of rows) for (let c = 0; c < ncol; c++) { const v = (r[c] || ''); if (v.length > colLen[c]) colLen[c] = v.length; }
      const wideText = colLen.some(l => l > 40);
      for (const r of rows) {
        let tr = '<tr>';
        for (let c = 0; c < ncol; c++) {
          const sc = statusCell(r[c] || '');
          tr += sc.cls ? `<td class="${sc.cls}">${inlineMd(sc.text)}</td>` : `<td>${inlineMd(sc.text)}</td>`;
        }
        bhtml += tr + '</tr>';
      }
      const tableWidth = (wideText || ncol >= 6) ? 1180 : 0;
      const wstyle = tableWidth ? `width:${tableWidth}px;` : '';
      const html = `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body><table style="${wstyle}"><thead>${thtml}</thead><tbody>${bhtml}</tbody></table></body></html>`;
      await page.setContent(html, { waitUntil: 'domcontentloaded' });
      await new Promise(r => setTimeout(r, 150));
      const el = await page.$('table'); const box = await el.boundingBox();
      k++; const file = `table-${k}.png`;
      await el.screenshot({ path: path.join(WD, file) });
      const wcm = Math.min(16.0, box.width / 73.75);
      out.push('', '```{=latex}', `\\begin{center}\\includegraphics[width=${wcm.toFixed(1)}cm]{${file}}\\end{center}`, '```', '');
      i = j - 1; continue;
    }
    out.push(ln);
  }
  await browser.close();
  console.log('tables rendered: ' + k);
  return out.join('\n');
}

// ---------- mermaid fences -> PNG ----------
function renderMermaid(body) {
  const pup = path.join(WD, 'pup.json');
  fs.writeFileSync(pup, JSON.stringify({ executablePath: CHROME, args: ['--no-sandbox', '--disable-setuid-sandbox'] }));
  const CLI = mmdcCli();
  const rx = /```mermaid\r?\n([\s\S]*?)```/g;
  const blocks = []; let m;
  while ((m = rx.exec(body)) !== null) blocks.push({ full: m[0], code: m[1] });
  let n = 0, ok = 0;
  for (const b of blocks) {
    n++;
    const inF = path.join(WD, `mmd-${n}.mmd`); const outF = path.join(WD, `mermaid-${n}.png`);
    if (fs.existsSync(outF)) fs.unlinkSync(outF);
    fs.writeFileSync(inF, b.code);
    try {
      execFileSync(process.execPath, [CLI, '-i', inF, '-o', outF, '-p', pup, '-b', 'white', '-w', '1200', '-s', '2'], { env: ENV, stdio: 'pipe' });
    } catch (e) { console.log(`mermaid err #${n}: ${(e.stderr ? e.stderr.toString().slice(-300) : e.message)}`); }
    if (fs.existsSync(outF)) { body = body.replace(b.full, `![](mermaid-${n}.png)`); ok++; }
  }
  console.log(`mermaid rendered ok: ${ok}/${n}`);
  if (n > 0 && ok < n) throw new Error('Not all Mermaid diagrams rendered — aborting to avoid raw code blocks.');
  return body;
}

// ---------- assemble + pandoc ----------
function buildPdf(body) {
  const yaml = `---\ntitle: "Migrating SQL Server to Azure"\nsubtitle: "Exhaustive inventory of targets, methods & tools  |  ${VERSION}"\ndate: "${COVER_DATE}"\n---\n\n`;
  const appendix = [
    '', '\\newpage', '',
    '## Appendix — Using the `sql-migration-advisor` Copilot CLI skill', '',
    'This knowledge base also powers `sql-migration-advisor`, a GitHub Copilot CLI skill that turns the inventory above into a guided recommendation. Ask Copilot *"migrate a SQL Server environment to Azure"*: it runs a short ~10-question interview (scope, source location & version, primary driver, instance-level feature dependencies, largest DB size, downtime tolerance, network & ports, compliance, ancillary services), then returns a grounded recommendation card — target, method, downtime class, blockers + remediations, cost levers, and the right Microsoft program — and never recommends retired tooling (DMA, Azure Data Studio extension, DMS classic).', '',
    '### Install (once)', '',
    'macOS / Linux:', '', '```bash',
    'git clone https://github.com/fredgis/sql-migration-advisor.git ~/.copilot/skills/sql-migration-advisor',
    '```', '',
    'Windows (PowerShell):', '', '```powershell',
    'git clone https://github.com/fredgis/sql-migration-advisor.git "$env:USERPROFILE\\.copilot\\skills\\sql-migration-advisor"',
    '```', '',
    'Restart Copilot CLI, run `/skills` to confirm `sql-migration-advisor` is listed, then ask your question in natural language (English or French).', '',
    '### Example output', '',
    'The card below is a real recommendation for an estate of ~100 on-premises SQL Server 2012 databases (limited WAN, exiting out-of-support):', '',
    '![](sql-migration-advisor-skill.png)', ''
  ].join('\n');

  fs.writeFileSync(path.join(WD, 'RESOLVED.md'), yaml + body + appendix, 'utf8');
  if (fs.existsSync(SKILL_IMG)) fs.copyFileSync(SKILL_IMG, path.join(WD, 'sql-migration-advisor-skill.png'));

  const args = [
    'RESOLVED.md', '-o', 'OUTPUT.pdf',
    '--pdf-engine=xelatex', `--include-in-header=${HEADER}`, '--shift-heading-level-by=-1',
    '--toc', '--toc-depth=3', '--number-sections', '--highlight-style=tango',
    '-V', 'geometry:margin=2.5cm', '-V', 'fontsize:11pt',
    '-V', 'mainfont:DejaVu Sans', '-V', 'monofont:DejaVu Sans Mono',
    '-V', 'colorlinks:true', '-V', 'linkcolor:blue', '-V', 'urlcolor:blue', '-V', 'toccolor:black'
  ];
  execFileSync('pandoc', args, { env: ENV, cwd: WD, stdio: 'inherit', maxBuffer: 1 << 26 });

  const outPdf = path.join(WD, 'OUTPUT.pdf');
  if (!fs.existsSync(outPdf)) throw new Error('pandoc did not produce OUTPUT.pdf');
  let pages = '?';
  try { pages = (execFileSync('pdfinfo', [outPdf], { env: ENV }).toString().match(/Pages:\s*(\d+)/) || [])[1] || '?'; } catch {}
  fs.copyFileSync(outPdf, OUT_PDF);
  console.log(`PDF built: ${pages} pages -> ${path.relative(ROOT, OUT_PDF)}`);
}

(async () => {
  const body = await renderBody();
  const withDiagrams = renderMermaid(body);
  buildPdf(withDiagrams);
})().catch(e => { console.error(e.message || e); process.exit(1); });
