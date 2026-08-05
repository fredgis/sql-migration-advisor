// Decide whether governance automation should open a PR/issue and prepare body text.
// A model "needsUpdate" verdict is report-only unless substantive edits already exist.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

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

// The model returns structured findings; render them as review-ready markdown.
// A plain "suggestions" string is still accepted so an older response shape keeps working.
//
// Each finding renders as a checklist item rather than a paragraph. Two findings from the
// v1.8 issue were believed applied, were not, and reappeared a cycle later; prose gives a
// reader nothing to tick, so nothing records what was actually done. The sub-boxes name the
// two places a correction has to land, because correcting only the knowledge base and
// leaving the decision tree alone is exactly how those two findings came back.
function renderFindings(a) {
  if (Array.isArray(a.findings) && a.findings.length) {
    return a.findings.map((f, i) => {
      const head = `- [ ] **${i + 1}. ${f.file || 'unknown file'}**${f.locator ? ` — ${f.locator}` : ''}`;
      const rows = [
        f.current ? `      - current: ${String(f.current).trim()}` : null,
        f.correction ? `      - correction: ${String(f.correction).trim()}` : null,
        f.why ? `      - why: ${String(f.why).trim()}` : null,
        f.source ? `      - source: ${String(f.source).trim()}` : '      - source: _none given — treat as unverified_',
        f.claim_id ? `      - affected claim/rule: \`${String(f.claim_id).trim()}\`` : null,
        f.confidence ? `      - confidence: ${String(f.confidence).trim()}` : null,
        '      - [ ] knowledge base updated',
        '      - [ ] decision rules updated, or explicitly not applicable',
        '      - [ ] scenario or gate added so this cannot regress',
      ].filter(Boolean);
      return [head, ...rows].join('\n');
    }).join('\n\n');
  }
  return (a.suggestions && String(a.suggestions).trim()) || '';
}
const aiSuggestions = renderFindings(ai);
const findingsCount = Array.isArray(ai.findings) ? ai.findings.length : null;
const unsourcedFindings = Array.isArray(ai.findings) ? ai.findings.filter(f => !f || !f.source).length : 0;
const claimDrift = (claims.drifted || []).length > 0;
const claimUnverified = (claims.unverified || []).length > 0;
const hasUnreachable = (linkSummary.unreachable || []).length > 0;
const hasBotBlocked = (linkSummary.unverifiedBotBlocked || []).length > 0;

const substantiveFiles = [
  'docs/sql-server-to-azure-migration.md',
  'reference/decision-rules.md'
];

function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

function gitFile(ref, file) {
  try {
    return execFileSync('git', ['show', `${ref}:${file}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

function baselineRef() {
  if (git(['rev-parse', '--verify', 'origin/main'])) {
    return git(['merge-base', 'HEAD', 'origin/main']) || 'origin/main';
  }
  return git(['rev-parse', '--verify', 'HEAD']) || null;
}

function normalizeForSubstantiveDiff(file, text) {
  const out = [];
  let inChangelog = false;
  for (const raw of String(text || '').replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim();
    if (/^#{1,6}\s+.*(?:change\s*log|changelog)/i.test(line)) {
      inChangelog = true;
      continue;
    }
    if (inChangelog) {
      if (/^#{1,6}\s+/.test(line)) inChangelog = false;
      else continue;
    }
    if (/^\|\s*v\d+\.\d+\s*\|\s*\d{4}-\d{2}-\d{2}\s*\|/i.test(line)) continue;
    if (/\*\*Version\.\*\*\s*v\d+\.\d+/i.test(line)) continue;
    if (/Current version:\s*\*\*v\d+\.\d+\*\*/i.test(line)) continue;
    if (/current:\s*v\d+\.\d+/i.test(line)) continue;
    if (/\(sql-migration-advisor\),\s*\*\*v\d+\.\d+\*\*/i.test(line)) continue;
    if (/current as of\s+(?:\d{1,2}\s+)?[A-Za-z]+\s+\d{4}/i.test(line)) continue;
    if (/verified\s+(?:\d{1,2}\s+)?[A-Za-z]+\s+\d{4}/i.test(line)) continue;
    out.push(line.replace(/\s+/g, ' '));
  }
  return out.join('\n').trim();
}

function hasSubstantiveDiff() {
  const base = baselineRef();
  if (!base) return false;
  for (const file of substantiveFiles) {
    const before = gitFile(base, file);
    const after = read(file, null);
    if (before === null || after === null) continue;
    if (normalizeForSubstantiveDiff(file, before) !== normalizeForSubstantiveDiff(file, after)) return true;
  }
  return false;
}

// The workflow still does not apply AI-generated substantive patches. A version bump is
// reachable only when real substantive KB/rules edits already exist on the branch.
const substantiveApplied = hasSubstantiveDiff();
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
  needsUpdate ? '- The model review flagged possible substantive edits. This is report-only until a patch is actually applied.' : `- The model review did not require a substantive update; ${NEWS_COUNT} candidate news item(s) reviewed.`
].join('\n');
const versionStatement = substantiveApplied
  ? `Version bump: **yes** (${bump}), because substantive content diffs were applied before metadata changes.`
  : 'Version bump: **no**. A model verdict, broken links, or claim drift alone cannot increment the version; substantive content must first be edited and consistency tests must pass.';

// GitHub rejects an issue or PR body over 65536 characters, and a wide news window alone can
// exceed that. The decision and the proposed edits must always survive, so the bulky appended
// reports are clipped to whatever budget is left — full copies stay in the run's job summary.
const BODY_LIMIT = 65536;
const SAFETY_MARGIN = 512;
const runUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
  ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
  : '';
const seeFull = runUrl ? ` See the [full report in the run summary](${runUrl}).` : ' The full report is in the run summary.';

function clip(text, budget) {
  if (text.length <= budget) return text;
  const note = `\n\n_… clipped: ${text.length - budget} more characters.${seeFull}_`;
  const keep = Math.max(0, budget - note.length);
  const cut = text.slice(0, keep);
  const lastBreak = cut.lastIndexOf('\n');
  return (lastBreak > keep * 0.5 ? cut.slice(0, lastBreak) : cut) + note;
}

const render = (attachments) => `## 🔄 Weekly knowledge-base freshness check

This was prepared automatically by the weekly check workflow.

### Version decision
${versionStatement}

### Applied automatically
${applied}

### Reported for human review
${reported}

### Suggested substantive edits (not applied automatically)

Tick each box as it lands. An unticked finding is an open finding, whatever the issue's state
suggests. Close this issue only when every box is ticked or explicitly declined in a comment.

${aiSuggestions || '_None proposed by the automated review. Confirm the news and reports below do not require content changes._'}

### 🧾 Claims/source drift report
${attachments.claims}

### 📰 Watched news
${attachments.news}

> News feeds surface announcements; the claims registry separately detects silent Microsoft Learn/source-section edits by content hash.

### 🔗 Link classification
${attachments.links}

<details><summary>Raw lychee report</summary>

${attachments.lychee}

</details>

---
_Automated by \`.github/workflows/weekly-kb-check.yml\`. Human review is required for any reported substantive KB/rules change._
`;

const attachments = {
  claims: read('claims-report.md', '_No claims report produced._'),
  news: read('news.md', '_No news file._'),
  links: read('link-summary.md', '_No link classification produced._'),
  lychee: read('lychee-report.md', '_No link report produced._'),
};
// Clip the least decision-relevant appendix first, so a huge news list never costs us the
// claims report or the link classification.
for (const key of ['lychee', 'news', 'claims', 'links']) {
  const over = render(attachments).length - (BODY_LIMIT - SAFETY_MARGIN);
  if (over <= 0) break;
  attachments[key] = clip(attachments[key], Math.max(0, attachments[key].length - over));
}
const body = render(attachments);
// Last resort: a very long findings list could still overflow on its own. Truncating is
// better than failing to open the issue at all — the findings are also in the run summary.
const finalBody = body.length > BODY_LIMIT
  ? clip(body, BODY_LIMIT - SAFETY_MARGIN)
  : body;
if (body.length > BODY_LIMIT) {
  console.warn(`warning: body was ${body.length} chars, truncated to fit the ${BODY_LIMIT} GitHub limit`);
}
fs.writeFileSync('pr-body.md', finalBody);
fs.writeFileSync('issue-body.md', finalBody);

const out = process.env.GITHUB_OUTPUT;
if (out) fs.appendFileSync(out, `changed=${changed}\nbump=${bump}\npr_required=${prRequired}\nissue_required=${issueRequired}\napply_mode=${housekeeping ? 'housekeeping' : (substantiveApplied ? 'substantive' : 'none')}\n`);
console.log(`changed=${changed} pr_required=${prRequired} issue_required=${issueRequired} apply_mode=${housekeeping ? 'housekeeping' : (substantiveApplied ? 'substantive' : 'none')} bump=${bump} needsUpdate=${needsUpdate} findings=${findingsCount ?? 'n/a'} unsourced=${unsourcedFindings} news=${NEWS_COUNT} unreachable=${(linkSummary.unreachable || []).length} botBlocked=${(linkSummary.unverifiedBotBlocked || []).length} claimDrift=${(claims.drifted || []).length}`);
console.log(`changelog: ${changelog}`);
