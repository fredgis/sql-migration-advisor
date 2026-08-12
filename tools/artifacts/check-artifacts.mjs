// Verify that every generated artifact is coherent with the source it derives from.
//
// Two kinds of check:
//   1. mirrored files — must be byte-identical (howto/*.svg -> blume/public/*.svg)
//   2. derived artifacts — must not be older, in git history, than their sources
//      (the knowledge base -> PDF + preview, the diagram sources -> PNGs)
//
// Git commit order is the source of truth here rather than file mtimes, which are
// meaningless after a fresh clone. An artifact is stale when its last commit is a
// strict ancestor of the last commit that touched one of its sources.
//
//   node tools/artifacts/check-artifacts.mjs [--json]
//
// Exit code 1 when anything is stale or mismatched, so CI can gate on it.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const jsonMode = process.argv.includes('--json');
const fixProse = process.argv.includes('--fix-prose');

const MIRRORS = [
  ['howto/skill-architecture.svg', 'blume/public/skill-architecture.svg'],
  ['howto/runtime-loop.svg', 'blume/public/runtime-loop.svg'],
  ['howto/weekly-update.svg', 'blume/public/weekly-update.svg'],
  ['howto/roadmap.svg', 'blume/public/roadmap.svg'],
  ['howto/decision-pipeline.svg', 'blume/public/decision-pipeline.svg'],
  ['howto/quality-gate.svg', 'blume/public/quality-gate.svg'],
];

const DERIVED = [
  {
    artifact: 'docs/sql-server-to-azure-migration.pdf',
    sources: ['docs/sql-server-to-azure-migration.md', 'tools/pdf/build.mjs', 'tools/pdf/header.tex'],
    rebuild: 'node tools/pdf/build.mjs',
  },
  {
    artifact: 'docs/preview/sql-migration-advisor-pdf-preview.png',
    sources: ['docs/sql-server-to-azure-migration.md', 'tools/pdf/patchwork.mjs'],
    rebuild: 'node tools/pdf/build.mjs && node tools/pdf/patchwork.mjs',
  },
  {
    artifact: 'docs/sql-migration-advisor-poster.png',
    sources: ['tools/diagram/poster.html', 'tools/diagram/build.mjs'],
    rebuild: 'node tools/diagram/build.mjs poster',
  },
  {
    artifact: 'images/sql-migration-advisor-radial.png',
    sources: ['tools/diagram/radial.html', 'tools/diagram/build.mjs'],
    rebuild: 'node tools/diagram/build.mjs radial',
  },
  {
    // hero embeds radial.html in an iframe, so a radial edit changes the hero too
    artifact: 'images/sql-migration-advisor-hero.png',
    sources: ['tools/diagram/hero.html', 'tools/diagram/radial.html', 'tools/diagram/build.mjs'],
    rebuild: 'node tools/diagram/build.mjs hero',
  },
  {
    artifact: 'images/sql-migration-advisor-linkedin.png',
    sources: ['tools/diagram/social.html', 'tools/diagram/build.mjs'],
    rebuild: 'node tools/diagram/build.mjs social',
  },
];

const lastCommit = (p) => {
  try {
    const o = execFileSync('git', ['log', '-1', '--format=%H', '--', p], { cwd: ROOT, encoding: 'utf8' }).trim();
    return o || null;
  } catch { return null; }
};
const isStrictAncestor = (a, b) => {
  if (!a || !b || a === b) return false;
  try { execFileSync('git', ['merge-base', '--is-ancestor', a, b], { cwd: ROOT }); return true; }
  catch { return false; }
};

// Prose that describes an artifact drifts too. The README quotes the PDF's page count
// and version; if the PDF is rebuilt and the sentence is not, the repo contradicts itself.
// Page count needs poppler (pdfinfo), which the PDF workflow already installs; when it is
// missing we report a note rather than failing, so a bare runner is not blocked.
function pdfPageCount(relPath) {
  try {
    const out = execFileSync('pdfinfo', [path.join(ROOT, relPath)], { encoding: 'utf8' });
    const m = out.match(/^Pages:\s+(\d+)/m);
    return m ? parseInt(m[1], 10) : null;
  } catch { return null; }
}

function currentKbVersion() {
  const m = fs.readFileSync(path.join(ROOT, 'docs', 'sql-server-to-azure-migration.md'), 'utf8')
    .match(/\*\*Version\.\*\*\s*(v\d+\.\d+)/);
  return m ? m[1] : null;
}

// The month a document quotes alongside the version drifts independently of the version itself.
// A v1.9 released in August was still described as "v1.9, July 2026" until this was checked.
function currentKbMonth() {
  const m = fs.readFileSync(path.join(ROOT, 'docs', 'sql-server-to-azure-migration.md'), 'utf8')
    .match(/\*\*Version\.\*\*\s*v\d+\.\d+\s*[—-]\s*\d{1,2}\s+(\w+)\s+(\d{4})/);
  return m ? `${m[1]} ${m[2]}` : null;
}

const problems = [];
const notes = [];

for (const [src, copy] of MIRRORS) {
  const s = path.join(ROOT, src);
  const c = path.join(ROOT, copy);
  if (!fs.existsSync(s)) { notes.push(`skipped mirror, missing source: ${src}`); continue; }
  if (!fs.existsSync(c)) { problems.push({ kind: 'missing-mirror', artifact: copy, source: src, fix: `copy ${src} to ${copy}` }); continue; }
  if (!fs.readFileSync(s).equals(fs.readFileSync(c))) {
    problems.push({ kind: 'mirror-out-of-date', artifact: copy, source: src, fix: `copy ${src} to ${copy}` });
  }
}

for (const { artifact, sources, rebuild } of DERIVED) {
  if (!fs.existsSync(path.join(ROOT, artifact))) { problems.push({ kind: 'missing-artifact', artifact, fix: rebuild }); continue; }
  const aCommit = lastCommit(artifact);
  if (!aCommit) { notes.push(`skipped, artifact not committed yet: ${artifact}`); continue; }
  for (const src of sources) {
    if (!fs.existsSync(path.join(ROOT, src))) continue;
    const sCommit = lastCommit(src);
    if (isStrictAncestor(aCommit, sCommit)) {
      problems.push({
        kind: 'stale-artifact', artifact, source: src,
        artifactCommit: aCommit.slice(0, 7), sourceCommit: sCommit.slice(0, 7), fix: rebuild,
      });
      break;
    }
  }
}

// --- prose that quotes an artifact must match the artifact ---
{
  const readmePath = path.join(ROOT, 'README.md');
  let readme = fs.readFileSync(readmePath, 'utf8');
  const version = currentKbVersion();
  const pdfRel = 'docs/sql-server-to-azure-migration.pdf';
  const actual = pdfPageCount(pdfRel);

  // e.g. "(22 pages,\nv1.7, July 2026)"
  const shape = /(sql-server-to-azure-migration\.pdf\)\s*\()~?(\d+)(\s*pages,\s*)(v\d+\.\d+)(,\s*)(\w+ \d{4})/;
  const claim = readme.match(shape);
  const month = currentKbMonth();
  if (!claim) {
    notes.push('README does not quote the PDF page count and version in the expected shape; skipped');
  } else if (fixProse && version && actual != null) {
    const fixed = readme.replace(shape, `$1${actual}$3${version}$5${month || '$6'}`);
    if (fixed !== readme) {
      fs.writeFileSync(readmePath, fixed);
      readme = fixed;
      notes.push(`README PDF sentence rewritten to ${actual} pages, ${version}, ${month || 'unchanged month'}`);
    }
  } else {
    const [, , claimedPages, , claimedVersion, , claimedMonth] = claim;
    if (version && claimedVersion !== version) {
      problems.push({
        kind: 'prose-version-mismatch', artifact: 'README.md', source: pdfRel,
        fix: `node tools/artifacts/check-artifacts.mjs --fix-prose`,
        detail: `README says ${claimedVersion}, knowledge base is ${version}`,
      });
    }
    if (month && claimedMonth !== month) {
      problems.push({
        kind: 'prose-month-mismatch', artifact: 'README.md', source: pdfRel,
        fix: `node tools/artifacts/check-artifacts.mjs --fix-prose`,
        detail: `README says ${claimedMonth}, knowledge base is dated ${month}`,
      });
    }
    if (actual == null) {
      notes.push('pdfinfo not available, skipped the README page-count check');
    } else if (parseInt(claimedPages, 10) !== actual) {
      problems.push({
        kind: 'prose-pagecount-mismatch', artifact: 'README.md', source: pdfRel,
        fix: `node tools/artifacts/check-artifacts.mjs --fix-prose`,
        detail: `README says ${claimedPages} pages, the PDF has ${actual}`,
      });
    }
  }
}

// The poster prints the knowledge-base version it was built from; that claim must
// track the knowledge base too, or a rebuilt PNG silently advertises an old version.
{
  const posterPath = path.join(ROOT, 'tools', 'diagram', 'poster.html');
  const version = currentKbVersion();
  let poster = fs.readFileSync(posterPath, 'utf8');
  const shape = /(sql-server-to-azure-migration\.md \()(v\d+\.\d+)/;
  const claim = poster.match(shape);
  if (!claim) {
    notes.push('poster.html does not quote the knowledge-base version in the expected shape; skipped');
  } else if (fixProse && version) {
    const fixed = poster.replace(shape, `$1${version}`);
    if (fixed !== poster) {
      fs.writeFileSync(posterPath, fixed);
      notes.push(`poster.html version claim rewritten to ${version}`);
    }
  } else if (version && claim[2] !== version) {
    problems.push({
      kind: 'prose-version-mismatch', artifact: 'tools/diagram/poster.html', source: 'docs/sql-server-to-azure-migration.md',
      fix: 'node tools/artifacts/check-artifacts.mjs --fix-prose && node tools/diagram/build.mjs poster',
      detail: `poster says ${claim[2]}, knowledge base is ${version}`,
    });
  }
}

// The README carries a table of every surface that quotes a version. A table that claims
// "everything is in sync" and is maintained by hand is the drift it exists to prevent, so the
// versions inside it are checked against the knowledge base and the release manifest, and
// rewritten under --fix-prose. The markers delimit the block so the rest of the README, which
// legitimately quotes old versions in its changelog, is left alone.
{
  const readmePath = path.join(ROOT, 'README.md');
  const readme = fs.readFileSync(readmePath, 'utf8');
  const kb = currentKbVersion();
  const release = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8')).latest;
  const block = readme.match(/<!-- surfaces:start -->[\s\S]*?<!-- surfaces:end -->/u);
  if (!block) {
    notes.push('README carries no surfaces table between its markers; skipped');
  } else if (!kb || !release) {
    notes.push('could not read the knowledge-base or release version; skipped the surfaces table');
  } else {
    // Release versions are three-part and knowledge-base versions two-part, so the three-part
    // form is rewritten first and its result excluded from the two-part pass.
    const retagged = block[0]
      .replace(/\bv\d+\.\d+\.\d+\b/gu, release)
      .replace(/\bv\d+\.\d+\b(?!\.\d)/gu, kb);
    if (retagged !== block[0]) {
      if (fixProse) {
        fs.writeFileSync(readmePath, readme.replace(block[0], retagged));
        notes.push(`README surfaces table rewritten to knowledge base ${kb} and release ${release}`);
      } else {
        const stale = [...new Set([...block[0].matchAll(/\bv\d+\.\d+(?:\.\d+)?\b/gu)].map(m => m[0]))]
          .filter(v => v !== kb && v !== release);
        problems.push({
          kind: 'prose-version-mismatch', artifact: 'README.md', source: 'docs/sql-server-to-azure-migration.md',
          fix: 'node tools/artifacts/check-artifacts.mjs --fix-prose',
          detail: `the surfaces table quotes ${stale.join(', ')}; knowledge base is ${kb} and release ${release}`,
        });
      }
    }
  }
}

if (jsonMode) {
  console.log(JSON.stringify({ ok: problems.length === 0, problems, notes }, null, 2));
} else {
  for (const n of notes) console.log(`note: ${n}`);
  if (problems.length === 0) {
    console.log(`Artifacts check passed: ${MIRRORS.length} mirrored file(s) and ${DERIVED.length} derived artifact(s) are up to date.`);
  } else {
    console.error('Artifacts check failed:');
    for (const p of problems) {
      const where = p.source ? ` (source ${p.source}${p.sourceCommit ? `, source at ${p.sourceCommit} vs artifact at ${p.artifactCommit}` : ''})` : '';
      console.error(`- ${p.kind}: ${p.artifact}${where}`);
      if (p.detail) console.error(`    ${p.detail}`);
      console.error(`    rebuild with: ${p.fix}`);
    }
  }
}
process.exit(problems.length === 0 ? 0 : 1);
