// Assemble the review prompt for one knowledge base.
//
//   node tools/weekly-check/build-prompt.mjs --kb migration > prompt-migration.txt
//
// One prompt per knowledge base rather than one prompt for all three. Three reasons, in order of
// how much they cost when ignored: a single prompt carrying every document exceeds the input the
// model can reason over carefully, so the last document in the prompt gets the least attention; a
// finding about connectivity and a finding about migration need different judgement, and a shared
// instruction block ends up written for whichever document dominates; and a failure in one review
// would take the other two with it. Reviewing them one after another keeps each verdict independent.
import fs from 'node:fs';
import { readFile, byId, TARGET_IDS, reviewableFiles, claimsFor } from './kb-targets.mjs';

const arg = name => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
};

const id = arg('kb');
const target = byId(id);
if (!target) {
  console.error(`--kb must be one of: ${TARGET_IDS.join(', ')}`);
  process.exit(2);
}

const local = (p, fallback) => { try { return fs.readFileSync(p, 'utf8').trim(); } catch { return fallback; } };

const doc = (readFile(target.doc, '') || '').trim();
if (!doc) {
  console.error(`${target.doc} is empty or missing; refusing to ask for a review of nothing.`);
  process.exit(1);
}

const context = target.context
  .map(rel => ({ rel, text: (readFile(rel, '') || '').trim() }))
  .filter(c => c.text);

const allClaims = (() => {
  try { return JSON.parse(readFile('reference/claims-registry.json', '[]')); } catch { return []; }
})();
const claims = claimsFor(target, Array.isArray(allClaims) ? allClaims : []);

// News is routed by keyword, and keyword routing is fallible in one direction that matters: an item
// that belongs here can be filed elsewhere. The routed items are given in full, and the rest are
// listed as bare headlines, so a misrouted item is still visible and can still be picked up.
const routed = [];
const others = [];
try {
  for (const item of JSON.parse(local('news.json', '[]'))) {
    if (!Array.isArray(item.targets) || item.targets.includes(target.id)) routed.push(item);
    else others.push(item);
  }
} catch { /* no news file: the sections below say so */ }

const newsBlock = routed.length
  ? routed.map(n => `- **[${n.title}](${n.link})** — ${n.source}, ${n.date}\n  ${(n.snippet || '').trim()}`).join('\n')
  : '_No news item was routed to this knowledge base this week._';
const otherNewsBlock = others.length
  ? others.map(n => `- [${n.title}](${n.link}) — ${n.source}, ${n.date}`).join('\n')
  : '_None._';

const claimsReport = local('claims-report.md', '') || '_No claims/source drift report produced._';
const links = local('link-summary.md', '') || local('lychee-report.md', '') || '_No link report produced._';

const fileEnum = reviewableFiles(target).map(f => `"${f}"`).join(' | ');
const contextSections = context
  .map(c => `\n=== COMPANION — ${c.rel} (FULL) ===\n${c.text}\n`)
  .join('');
const companionRule = target.companions.length
  ? `The companion file${target.companions.length > 1 ? 's' : ''} ${target.companions.map(c => `\`${c}\``).join(', ')} `
    + 'restate these facts in a machine-readable form. A correction that lands in one and not the other '
    + 'is a contradiction, so raise a finding against each file that needs to change.'
  : 'This knowledge base has no companion file.';

process.stdout.write(
`You are auditing one of three knowledge bases maintained in the same repository. Only this one is
in scope for this review. It is reproduced in full below, with this week's evidence.

# The knowledge base under review

**${target.title}** — \`${target.doc}\`

**Its scope.** ${target.scope}

**Out of scope for this review.** Anything belonging to the sibling knowledge bases. They are
reviewed separately, in their own passes, against their own evidence. Do not raise a finding
against a file that is not listed in the output contract below, and do not report that a fact is
missing here when it belongs in a sibling document.

${companionRule}

# Task

Decide whether a substantive content update to this knowledge base is warranted, and list the exact
edits.

# What counts as evidence

Base every finding on one of the evidence blocks below, and cite the authoritative source:
(a) official Azure / SQL Server news routed to this knowledge base,
(b) link classification — 403/429 mean "unverified", never "healthy",
(c) claims/source content drift for the claims that belong to this knowledge base,
(d) a contradiction between this document and its companion file, or inside the document itself.

# Precision beats recall

A false finding costs more than a missed one: it sends a human to verify something that was already
correct, and repeated false alarms make the whole review ignored.

- Every finding MUST carry a specific Microsoft source URL that supports it. No URL, no finding.
- If you are not confident the current text is wrong, do not report it.
- Do not report style, wording, formatting or structure. Only facts that would change the guidance
  a reader acts on.
- Do not restate something the document already says correctly.
- Ignore products unrelated to running or migrating SQL Server on Azure.

# Governance

Your verdict is advisory. It can never, on its own, increment the version. A version bump happens
only after substantive edits are actually applied and the consistency gates pass. Broken links are
reported for a human unless a URL is genuinely rewritten. So set "needsUpdate": true only when real
content edits are required — not merely because news exists or a link was unreachable.

# Output

Return ONLY a JSON object, no prose and no code fence:

{
  "kb": "${target.id}",
  "needsUpdate": true|false,
  "bump": "minor"|"major",
  "changelog": "<=300 chars; truthful summary of the content edits you are proposing; never claim a link was fixed unless a URL is actually rewritten",
  "findings": [
    {
      "file": ${fileEnum},
      "locator": "section or heading, e.g. '§5.2 MI methods table'",
      "current": "what the document says today (short quote or paraphrase)",
      "correction": "what it should say instead",
      "why": "what changed, or why the current text is wrong",
      "source": "https://learn.microsoft.com/...",
      "confidence": "high"|"medium",
      "claim_id": "affected claim or rule id, or null"
    }
  ]
}

Return "findings": [] when nothing warrants a change — that is a valid and useful answer.

=== KNOWLEDGE BASE UNDER REVIEW — ${target.doc} (FULL) ===
${doc}
${contextSections}
=== CLAIMS REGISTRY (entries belonging to this knowledge base: ${claims.length}) ===
${JSON.stringify(claims, null, 2)}

=== CLAIMS/SOURCE DRIFT REPORT (all knowledge bases) ===
${claimsReport}

=== LINK CLASSIFICATION / REPORT (all knowledge bases) ===
${links}

=== WATCHED NEWS ROUTED TO THIS KNOWLEDGE BASE (${routed.length}) ===
${newsBlock}

=== OTHER NEWS THIS WEEK (routed elsewhere; headlines only, in case one was misrouted) ===
${otherNewsBlock}
`);
