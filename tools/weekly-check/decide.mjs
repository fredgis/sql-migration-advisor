// Decide whether governance automation should open a PR/issue and prepare body text.
// A model "needsUpdate" verdict is report-only unless substantive edits already exist.
import fs from 'node:fs';

const read = (p, f = '') => { try { return fs.readFileSync(p, 'utf8'); } catch { return f; } };
const json = (p, f = {}) => { try { return JSON.parse(read(p, '')); } catch { return f; } };
const NEWS_COUNT = parseInt(process.env.NEWS_COUNT || '0', 10) || 0;
const linkSummary = json('link-summary.json', { ok: true, unreachable: [], unverifiedBotBlocked: [] });
const claims = json('claims-report.json', { drifted: [], unverified: [] });

let ai = {};
const resp = read('response.txt').trim();
if (resp) {
  const m = resp.match(/\{[\s\S]*\}/);
  if (m) { try { ai = JSON.parse(m[0]); } catch { /* malformed AI output is report-only */ } }
}
const needsUpdate = ai.needsUpdate === true;
const bump = ai.bump === 'major' ? 'major' : 'minor';
const aiSuggestions = (ai.suggestions && String(ai.suggestions).trim()) || '';
const claimDrift = (claims.drifted || []).length > 0;
const claimUnverified = (claims.unverified || []).length > 0;
const hasUnreachable = (linkSummary.unreachable || []).length > 0;
const hasBotBlocked = (linkSummary.unverifiedBotBlocked || []).length > 0;

// This workflow does not apply AI-generated substantive patches. Therefore no version bump
// is allowed here; it can only report needed human work or run housekeeping.
const substantiveApplied = false;
const changed = substantiveApplied;
const reportOnly = needsUpdate || claimDrift || claimUnverified || hasUnreachable || hasBotBlocked;
const housekeeping = !substantiveApplied && !reportOnly && NEWS_COUNT > 0;
const prRequired = changed || housekeeping;
const issueRequired = reportOnly && !changed;

let changelog;
if (substantiveApplied) {
  changelog = (ai.changelog && String(ai.changelog).trim()) || 'Applied substantive SQL migration guidance updates.';
} else if (hasUnreachable || hasBotBlocked) {
  const n = (linkSummary.unreachable || []).length;
  const b = (linkSummary.unverifiedBotBlocked || []).length;
  changelog = `Link check reported ${n} unreachable and ${b} bot-blocked/unverified link(s) — flagged for human review.`;
} else if (needsUpdate) {
  changelog = 'Automated review reported possible substantive SQL migration guidance updates — flagged for human review.';
} else if (housekeeping) {
  changelog = `Weekly housekeeping: reviewed ${NEWS_COUNT} Azure/SQL update(s); no substantive content changes applied.`;
} else {
  changelog = 'Weekly freshness check: no substantive content changes applied.';
}
changelog = changelog.replace(/\s+/g, ' ').slice(0, 300);
fs.writeFileSync('changelog.txt', changelog);

const applied = substantiveApplied
  ? `- Substantive KB/rules edits were already present in the branch. A ${bump} version bump is allowed after consistency checks pass.`
  : housekeeping
    ? '- Housekeeping only: freshness stamps may be updated; the version will not be bumped and no changelog row will be added.'
    : '- Nothing was applied automatically to the knowledge-base content.';
const reported = [
  hasUnreachable ? `- Link check reported ${(linkSummary.unreachable || []).length} unreachable link(s). These are reported for human review; the workflow did not rewrite links.` : '- No unreachable links reported.',
  hasBotBlocked ? `- ${(linkSummary.unverifiedBotBlocked || []).length} link(s) returned 403/429 and are classified as unverified bot-blocked, not healthy.` : '- No 403/429 bot-blocked links reported.',
  claimDrift ? `- Claims registry detected ${(claims.drifted || []).length} source-section hash drift(s); affected rules require human review.` : '- No claim hash drift reported.',
  claimUnverified ? `- Claims registry could not verify ${(claims.unverified || []).length} claim source(s); review manually.` : '- All fetched claim sources verified or were baselined.',
  needsUpdate ? '- GitHub Models flagged possible substantive edits. This is report-only until a patch is actually applied.' : `- GitHub Models did not require a substantive update; ${NEWS_COUNT} candidate news item(s) reviewed.`
].join('\n');
const versionStatement = substantiveApplied
  ? `Version bump: **yes** (${bump}), because substantive content diffs were applied before metadata changes.`
  : 'Version bump: **no**. A model verdict, broken links, or claim drift alone cannot increment the version; substantive content must first be edited and consistency tests must pass.';

const body = `## 🔄 Weekly knowledge-base freshness check

This was prepared automatically by the weekly check workflow.

### Version decision
${versionStatement}

### Applied automatically
${applied}

### Reported for human review
${reported}

### Suggested substantive edits (not applied automatically)
${aiSuggestions || '_None proposed by the automated review. Confirm the news and reports below do not require content changes._'}

### 🧾 Claims/source drift report
${read('claims-report.md', '_No claims report produced._')}

### 📰 Watched news
${read('news.md', '_No news file._')}

> News feeds surface announcements; the claims registry separately detects silent Microsoft Learn/source-section edits by content hash.

### 🔗 Link classification
${read('link-summary.md', '_No link classification produced._')}

<details><summary>Raw lychee report</summary>

${read('lychee-report.md', '_No link report produced._')}

</details>

---
_Automated by `.github/workflows/weekly-kb-check.yml`. Human review is required for any reported substantive KB/rules change._
`;
fs.writeFileSync('pr-body.md', body);
fs.writeFileSync('issue-body.md', body);

const out = process.env.GITHUB_OUTPUT;
if (out) fs.appendFileSync(out, `changed=${changed}\nbump=${bump}\npr_required=${prRequired}\nissue_required=${issueRequired}\napply_mode=${housekeeping ? 'housekeeping' : (substantiveApplied ? 'substantive' : 'none')}\n`);
console.log(`changed=${changed} pr_required=${prRequired} issue_required=${issueRequired} apply_mode=${housekeeping ? 'housekeeping' : (substantiveApplied ? 'substantive' : 'none')} bump=${bump} needsUpdate=${needsUpdate} news=${NEWS_COUNT} unreachable=${(linkSummary.unreachable || []).length} botBlocked=${(linkSummary.unverifiedBotBlocked || []).length} claimDrift=${(claims.drifted || []).length}`);
console.log(`changelog: ${changelog}`);
