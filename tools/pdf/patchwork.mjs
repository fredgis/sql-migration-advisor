// Build the black-background "patchwork" PDF preview used in the README.
// Renders 3 representative pages of the built PDF to PNG (poppler pdftoppm),
// then composites them as rotated, bordered, soft-shadowed cards (sharp).
//
// Requires poppler on PATH (pdfinfo, pdftotext, pdftoppm). Run after build.mjs.
//
//   node patchwork.mjs
//
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const PDF = path.join(ROOT, 'docs', 'sql-server-to-azure-migration.pdf');
const OUT = path.join(ROOT, 'docs', 'preview', 'sql-migration-advisor-pdf-preview.png');
const WD = path.join(HERE, '.build');
fs.mkdirSync(WD, { recursive: true });

function buildPath() {
  const extra = [];
  if (process.platform === 'win32') {
    const la = process.env.LOCALAPPDATA || '';
    extra.push(path.join(la, 'Programs', 'MiKTeX', 'miktex', 'bin', 'x64'));
  }
  return [...extra.filter(Boolean), process.env.PATH].join(path.delimiter);
}
const ENV = { ...process.env, PATH: buildPath() };
const cap = (cmd, args) => execFileSync(cmd, args, { env: ENV, maxBuffer: 1 << 25 }).toString();

(async () => {
  if (!fs.existsSync(PDF)) throw new Error(`PDF not found: ${PDF} (run build.mjs first)`);
  const pages = parseInt(cap('pdfinfo', [PDF]).match(/Pages:\s*(\d+)/)[1], 10);

  // locate the "Summary matrix" page so we always feature a decision matrix
  let mp = 0;
  for (let p = 3; p <= pages; p++) {
    if (/Summary matrix/.test(cap('pdftotext', ['-f', `${p}`, '-l', `${p}`, PDF, '-']))) { mp = p; break; }
  }
  const mtx = mp > 0 ? mp + 1 : Math.min(9, pages);

  fs.readdirSync(WD).filter(f => /^patch-[abc]-/.test(f)).forEach(f => fs.unlinkSync(path.join(WD, f)));
  const ppm = (page, pre) => execFileSync('pdftoppm', ['-png', '-r', '150', '-f', `${page}`, '-l', `${page}`, PDF, path.join(WD, pre)], { env: ENV });
  ppm(1, 'patch-a'); ppm(5, 'patch-b'); ppm(mtx, 'patch-c');
  const pick = pre => path.join(WD, fs.readdirSync(WD).find(f => f.startsWith(pre + '-')));
  const files = [pick('patch-a'), pick('patch-b'), pick('patch-c')];

  const H = 820;
  const angles = [-4, -3, 2.5];
  const xs = [40, 1330, 470];
  const ys = [120, 130, 60];

  async function rotatedCard(file, angle) {
    const bordered = await sharp(file).resize({ height: H })
      .extend({ top: 8, bottom: 8, left: 8, right: 8, background: '#c8ccd0' }).png().toBuffer();
    return await sharp(bordered).rotate(angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  }
  async function shadowOf(rotBuf) {
    const meta = await sharp(rotBuf).metadata();
    const alpha = await sharp(rotBuf).ensureAlpha().extractChannel(3).linear(0.38, 0).toBuffer();
    return await sharp({ create: { width: meta.width, height: meta.height, channels: 3, background: { r: 0, g: 0, b: 0 } } })
      .joinChannel(alpha).blur(9).png().toBuffer();
  }

  const layers = [];
  for (let i = 0; i < 3; i++) {
    const rot = await rotatedCard(files[i], angles[i]);
    layers.push({ input: await shadowOf(rot), left: xs[i] + 14, top: ys[i] + 18 });
    layers.push({ input: rot, left: xs[i], top: ys[i] });
  }

  await sharp({ create: { width: 2000, height: 1090, channels: 4, background: { r: 13, g: 13, b: 15, alpha: 1 } } })
    .composite(layers).png().toFile(OUT);
  console.log(`patchwork saved: ${Math.round(fs.statSync(OUT).size / 1024)} KB (matrix page ${mtx}, ${pages} pages total)`);
})().catch(e => { console.error(e.message || e); process.exit(1); });
