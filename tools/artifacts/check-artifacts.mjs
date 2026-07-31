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
      console.error(`    rebuild with: ${p.fix}`);
    }
  }
}
process.exit(problems.length === 0 ? 0 : 1);
