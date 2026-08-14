// Turn this week's evidence into a decision: open a maintenance pull request, open an issue for a
// human, or do nothing. Then write the bodies for whichever it chose.
//
// The governing rule is that no automated signal may edit guidance. A model verdict, a drifted
// source hash and a dead link are all reasons to ask a human; none of them is a reason to change a
// sentence or raise a version. A version moves only when a real content diff already exists.
import fs from 'node:fs';
import { TARGETS } from './kb-targets.mjs';
import { isSubstantive, baselineRef } from './substantive-diff.mjs';

const read = (p, f = '') => { try { return fs.readFileSync(p, 'utf8'); } catch { return f; } };
const json = (p, f) => { try { return JSON.parse(read(p, '')); } catch { return f; } };

const NEWS_COUNT = parseInt(process.env.NEWS_COUNT || '0', 10) || 0;
const linkSummary = json('link-summary.json', { ok: true, exitCode: '0', unreachable: [], unverifiedBotBlocked: [] });
const docLinks = json('doc-links.json', null);
const claims = json('claims-report.json', { drifted: [], unverified: [] });
const routing = json('news-routing.json', { perTarget: {} });

// ---------------------------------------------------------------------------------------------
// The model verdict, per knowledge base, as three states rather than two.
//
// "The review ran and found nothing" and "the review never ran" are opposite facts that used to
// produce the same value. An absent response became an empty object, an empty object has no
// needsUpdate, and the report then stated that the model had not asked for an update — an assertion
// about a review that had not happened. Worse, it left the run eligible for housekeeping, so the
// documents were stamped as freshly verified on the strength of it. Unavailable is now its own
// state, it reaches the report as itself, and it blocks the stamp.
// ---------------------------------------------------------------------------------------------
function verdictFor(target) {
  const raw = read(`response-${target.id}.txt`).trim();
  if (!raw) return { id: target.id, target, state: 'unavailable', reason: 'no response file was produced', ai: {} };
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return { id: target.id, target, state: 'unavailable', reason: 'the response contained no JSON object', ai: {} };
  let ai;
  try { ai = JSON.parse(m[0]); } catch (e) { return { id: target.id, target, state: 'unavailable', reason: `the response was not valid JSON (${e.message})`, ai: {} }; }
  if (typeof ai.needsUpdate !== 'boolean') {
    return { id: target.id, target, state: 'unavailable', reason: 'the response carried no boolean needsUpdate verdict', ai };
  }
  return { id: target.id, target, state: ai.needsUpdate ? 'update' : 'no-update', reason: null, ai };
}

const verdicts = TARGETS.map(verdictFor);
const reviewUnavailable = verdicts.filter(v => v.state === 'unavailable');
const reviewWantsUpdate = verdicts.filter(v => v.state === 'update');
const bump = verdicts.some(v => v.ai?.bump === 'major') ? 'major' : 'minor';

// Findings render as a checklist, not prose. Two findings from an earlier cycle were believed
// applied, were not, and came back a version later; a paragraph gives a reader nothing to tick, so
// nothing records what was actually done. The sub-boxes name the places a correction has to land,
// because correcting the document and leaving its companion alone is exactly how they came back.
function renderFindings(v) {
  const list = Array.isArray(v.ai.findings) ? v.ai.findings : [];
  if (!list.length) {
    return v.ai.suggestions ? String(v.ai.suggestions).trim() : '_No finding raised for this knowledge base._';
  }
  return list.map((f, i) => {
    const head = `- [ ] **${i + 1}. ${f.file || 'unknown file'}**${f.locator ? ` — ${f.locator}` : ''}`;
    const rows = [
      f.current ? `      - current: ${String(f.current).trim()}` : null,
      f.correction ? `      - correction: ${String(f.correction).trim()}` : null,
      f.why ? `      - why: ${String(f.why).trim()}` : null,
      f.source ? `      - source: ${String(f.source).trim()}` : '      - source: _none given — treat as unverified_',
      f.claim_id ? `      - affected claim/rule: \`${String(f.claim_id).trim()}\`` : null,
      f.confidence ? `      - confidence: ${String(f.confidence).trim()}` : null,
      '      - [ ] knowledge base updated',
      `      - [ ] ${v.target.companions.length ? `companion updated (${v.target.companions.join(', ')})` : 'companion check not applicable'}, or explicitly not applicable`,
      '      - [ ] scenario or gate added so this cannot regress',
    ].filter(Boolean);
    return [head, ...rows].join('\n');
  }).join('\n\n');
}

const totalFindings = verdicts.reduce((n, v) => n + (Array.isArray(v.ai.findings) ? v.ai.findings.length : 0), 0);
const unsourcedFindings = verdicts.reduce(
  (n, v) => n + (Array.isArray(v.ai.findings) ? v.ai.findings.filter(f => !f || !f.source).length : 0), 0);

// ---------------------------------------------------------------------------------------------
// Deterministic evidence.
// ---------------------------------------------------------------------------------------------
const claimDrift = (claims.drifted || []).length > 0;
const claimUnverified = (claims.unverified || []).length > 0;
const hasUnreachable = (linkSummary.unreachable || []).length > 0;
const hasBotBlocked = (linkSummary.unverifiedBotBlocked || []).length > 0;
// A timeout, a DNS failure or a TLS error carries no HTTP status, so it lands in neither list above
// while still failing the run. Reading the classifier's own healthy-run verdict catches those; the
// lists alone would have let the week pass as clean.
const linkRunUnhealthy = linkSummary.ok === false;
const docLinksFailed = docLinks ? docLinks.ok === false : false;
const docLinksMissing = docLinks === null;
// The prerequisite catalogue cites sources that live in JSON rather than in the document's prose, so
// they are proven by their own contract test. Its result reaches the decision the same way as every
// other piece of evidence: as a reason to ask a human, never as a reason to stay quiet.
const prereqLinksOk = (process.env.PREREQ_LINKS_OK || 'true') !== 'false';

const base = baselineRef();
const substantive = TARGETS.filter(t => isSubstantive(t, base));
const substantiveIds = substantive.map(t => t.id);
const substantiveApplied = substantive.length > 0;

const reportOnly =
  reviewWantsUpdate.length > 0 ||
  reviewUnavailable.length > 0 ||
  claimDrift || claimUnverified ||
  hasUnreachable || hasBotBlocked || linkRunUnhealthy ||
  docLinksFailed || docLinksMissing || !prereqLinksOk;

const changed = substantiveApplied;
const housekeeping = !substantiveApplied && !reportOnly && NEWS_COUNT > 0;
const prRequired = changed || housekeeping;
const issueRequired = reportOnly && !changed;

// ---------------------------------------------------------------------------------------------
// Changelog line, ordered so the most consequential reason wins.
// ---------------------------------------------------------------------------------------------
let changelog;
if (substantiveApplied) {
  const proposed = verdicts.find(v => v.state === 'update' && substantiveIds.includes(v.id) && v.ai.changelog);
  changelog = (proposed && String(proposed.ai.changelog).trim())
    || `Applied substantive updates to ${substantiveIds.join(', ')}.`;
} else if (reviewUnavailable.length) {
  changelog = `Weekly check incomplete: the review did not run for ${reviewUnavailable.map(v => v.id).join(', ')}.`;
} else if (hasUnreachable || hasBotBlocked || linkRunUnhealthy || docLinksFailed) {
  changelog = `Link check reported ${(linkSummary.unreachable || []).length} unreachable and ${(linkSummary.unverifiedBotBlocked || []).length} bot-blocked link(s) — flagged for human review.`;
} else if (reviewWantsUpdate.length) {
  changelog = `Automated review reported possible substantive updates to ${reviewWantsUpdate.map(v => v.id).join(', ')} — flagged for human review.`;
} else if (housekeeping) {
  changelog = `Weekly housekeeping: reviewed ${NEWS_COUNT} Azure/SQL update(s) across ${TARGETS.length} knowledge bases; no substantive content changes applied.`;
} else {
  changelog = 'Weekly freshness check: no substantive content changes applied.';
}
changelog = changelog.replace(/\s+/g, ' ').slice(0, 300);
fs.writeFileSync('changelog.txt', changelog);

// ---------------------------------------------------------------------------------------------
// Report bodies.
// ---------------------------------------------------------------------------------------------
const applied = substantiveApplied
  ? `- Substantive edits were already present for **${substantiveIds.join(', ')}**. A ${bump} version bump is allowed for those after the consistency gates pass; the other knowledge bases receive a freshness stamp only.`
  : housekeeping
    ? `- Housekeeping only: freshness stamps are refreshed on all ${TARGETS.length} knowledge bases; no version is bumped and no changelog row is added.`
    : '- Nothing was applied automatically to any knowledge-base content.';

const reviewLines = verdicts.map(v => {
  const n = Array.isArray(v.ai.findings) ? v.ai.findings.length : 0;
  if (v.state === 'unavailable') return `- ⚠️ **${v.target.title}** — the review did not run (${v.reason}). This is not a clean verdict; nothing was verified for this knowledge base this week.`;
  if (v.state === 'update') return `- 🔴 **${v.target.title}** — the review proposes ${n} substantive edit(s), listed below. Report-only until a human applies them.`;
  return `- 🟢 **${v.target.title}** — the review ran and proposed no substantive edit (${routing.perTarget?.[v.id] ?? 0} news item(s) routed to it).`;
}).join('\n');

const reported = [
  hasUnreachable ? `- Link check reported ${(linkSummary.unreachable || []).length} unreachable link(s), reported for human review; no link was rewritten.` : '- No unreachable links reported.',
  hasBotBlocked ? `- ${(linkSummary.unverifiedBotBlocked || []).length} link(s) returned 403/429 and are classified as unverified bot-blocked, not healthy.` : '- No 403/429 bot-blocked links reported.',
  linkRunUnhealthy && !hasUnreachable && !hasBotBlocked ? `- The link checker exited non-zero (\`${linkSummary.exitCode}\`) without reporting an HTTP status, which is how a timeout, DNS or TLS failure appears. Treated as unverified.` : null,
  docLinksMissing ? '- ⚠️ No source/anchor verification result was produced, so no knowledge-base source was confirmed to still resolve this week.'
    : docLinksFailed ? `- Source/anchor verification failed for ${(docLinks.failures || []).length} URL(s) across the knowledge bases; a moved heading breaks a citation without breaking its link.`
      : `- Every knowledge-base source URL and heading anchor still resolves (${docLinks.okCount}/${docLinks.checked} checked, ${(docLinks.unverified || []).length} bot-blocked).`,
  prereqLinksOk ? null : '- The prerequisite catalogue contract test could not confirm every source and anchor it cites.',
  claimDrift ? `- Claims registry detected ${(claims.drifted || []).length} source-section hash drift(s); the affected rules require human review.` : '- No claim hash drift reported.',
  claimUnverified ? `- Claims registry could not verify ${(claims.unverified || []).length} claim source(s); review manually.` : '- All fetched claim sources verified or were baselined.',
].filter(Boolean).join('\n');

const versionStatement = substantiveApplied
  ? `Version bump: **yes** (${bump}) for ${substantiveIds.join(', ')}, because substantive content diffs exist against \`${base || 'unknown'}\` before any metadata was written.`
  : 'Version bump: **no**. A model verdict, a broken link or claim drift cannot on its own increment a version; substantive content must be edited first and the consistency gates must pass.';

const perKb = verdicts.map(v => `#### ${v.target.title} — \`${v.target.doc}\`

${v.state === 'unavailable'
    ? `_The review did not run: ${v.reason}. Treat this knowledge base as unreviewed this week._`
    : renderFindings(v)}`).join('\n\n');

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

const render = a => `## 🔄 Weekly knowledge-base freshness check

Prepared automatically by the weekly check workflow, across ${TARGETS.length} knowledge bases:
${TARGETS.map(t => `\`${t.doc}\``).join(', ')}.

### Version decision
${versionStatement}

### Applied automatically
${applied}

### Review verdict per knowledge base
${reviewLines}

### Reported for human review
${reported}

### Suggested substantive edits (not applied automatically)

Tick each box as it lands. An unticked finding is an open finding, whatever this item's state
suggests. Close it only when every box is ticked or explicitly declined in a comment.

${perKb}

### 🧾 Claims/source drift report
${a.claims}

### 📰 Watched news
${a.news}

> News feeds surface announcements; the claims registry separately detects silent Microsoft Learn
> source-section edits by content hash, and the source check separately proves every cited heading
> anchor still exists.

### 🔗 Link classification
${a.links}

<details><summary>Source and anchor verification</summary>

${a.docLinks}

</details>

<details><summary>Raw lychee report</summary>

${a.lychee}

</details>

---
_Automated by \`.github/workflows/weekly-kb-check.yml\`. Human review is required for any reported substantive change._
`;

const attachments = {
  claims: read('claims-report.md', '_No claims report produced._'),
  news: read('news.md', '_No news file._'),
  links: read('link-summary.md', '_No link classification produced._'),
  docLinks: read('doc-links.md', '_No source/anchor verification produced._'),
  lychee: read('lychee-report.md', '_No link report produced._'),
};
// Clip the least decision-relevant appendix first, so a long news list never costs us the claims
// report or the link classification.
for (const key of ['lychee', 'news', 'docLinks', 'claims', 'links']) {
  const over = render(attachments).length - (BODY_LIMIT - SAFETY_MARGIN);
  if (over <= 0) break;
  attachments[key] = clip(attachments[key], Math.max(0, attachments[key].length - over));
}
const body = render(attachments);
const finalBody = body.length > BODY_LIMIT ? clip(body, BODY_LIMIT - SAFETY_MARGIN) : body;
if (body.length > BODY_LIMIT) console.warn(`warning: body was ${body.length} chars, truncated to fit the ${BODY_LIMIT} GitHub limit`);
fs.writeFileSync('pr-body.md', finalBody);
fs.writeFileSync('issue-body.md', finalBody);

const applyMode = housekeeping ? 'housekeeping' : (substantiveApplied ? 'substantive' : 'none');
const out = process.env.GITHUB_OUTPUT;
if (out) {
  fs.appendFileSync(out, [
    `changed=${changed}`,
    `bump=${bump}`,
    `pr_required=${prRequired}`,
    `issue_required=${issueRequired}`,
    `apply_mode=${applyMode}`,
    `substantive_kbs=${substantiveIds.join(',')}`,
    `review_unavailable=${reviewUnavailable.map(v => v.id).join(',')}`,
    ''
  ].join('\n'));
}
console.log(
  `apply_mode=${applyMode} pr_required=${prRequired} issue_required=${issueRequired} bump=${bump} `
  + `substantive=[${substantiveIds.join(',') || 'none'}] baseline=${base || 'unknown'} `
  + `review=[${verdicts.map(v => `${v.id}:${v.state}`).join(' ')}] findings=${totalFindings} unsourced=${unsourcedFindings} `
  + `news=${NEWS_COUNT} unreachable=${(linkSummary.unreachable || []).length} botBlocked=${(linkSummary.unverifiedBotBlocked || []).length} `
  + `linkRunOk=${linkSummary.ok !== false} docLinksOk=${docLinks ? docLinks.ok !== false : 'missing'} claimDrift=${(claims.drifted || []).length}`);
console.log(`changelog: ${changelog}`);
