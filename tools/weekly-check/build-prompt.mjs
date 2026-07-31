// Assemble the user prompt for the model review step.
// Prints to stdout (the workflow redirects it to prompt.txt).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DOC = path.resolve(HERE, '..', '..', 'docs', 'sql-server-to-azure-migration.md');
const RULES = path.resolve(HERE, '..', '..', 'reference', 'decision-rules.md');
const CLAIMS = path.resolve(HERE, '..', '..', 'reference', 'claims-registry.json');
const read = (p, fallback) => { try { return fs.readFileSync(p, 'utf8'); } catch { return fallback; } };

const doc = read(DOC, '').trim();
const rules = read(RULES, '').trim() || '_reference/decision-rules.md not found._';
const links = read('link-summary.md', '').trim() || read('lychee-report.md', '').trim() || '_No link report produced._';
const claimsReport = read('claims-report.md', '').trim() || '_No claims/source drift report produced._';
const claimsRegistry = read(CLAIMS, '[]').trim();
const news = read('news.md', '').trim() || '_No news file._';

process.stdout.write(
`You are auditing a SQL Server → Azure migration knowledge base and its distilled decision
tree. Both are reproduced in full below, together with this week's evidence.

# Task

Decide whether a substantive content update is warranted, and list the exact edits.

# What counts as evidence

Base every finding on one of the four evidence blocks below, and cite the authoritative
source for it:
(a) official Azure / SQL Server news,
(b) link classification — 403/429 mean "unverified", never "healthy",
(c) claims/source content drift,
(d) drift between the two documents — the decision tree is a mirror of the knowledge base
    and must agree with it.

# Precision beats recall

A false finding costs more than a missed one: it sends a human to verify something that
was already correct, and repeated false alarms make the whole review ignored.

- Every finding MUST carry a specific Microsoft source URL that supports it. No URL, no finding.
- If you are not confident the current text is wrong, do not report it.
- Do not report style, wording, formatting or structure. Only facts that would change a
  migration recommendation.
- Do not restate something the documents already say correctly.
- Ignore products unrelated to migrating SQL Server to Azure.

In scope: GA/preview/retirement transitions, changed dates, version gates and floors,
target/method/tool support changes, ports and limits, pricing/ESU/licensing rules,
moved or dead sources, and KB-vs-decision-tree contradictions.

# Governance

Your verdict is advisory. It can never, on its own, increment the version. A version bump
happens only after substantive edits are actually applied and the consistency tests pass.
Broken links are reported for a human unless a URL is genuinely rewritten. So set
"needsUpdate": true only when real content edits are required — not merely because news
exists or a link was unreachable.

# Output

Return ONLY a JSON object, no prose and no code fence:

{
  "needsUpdate": true|false,
  "bump": "minor"|"major",
  "changelog": "<=300 chars; truthful summary of the content edits you are proposing; never claim a link was fixed unless a URL is actually rewritten",
  "findings": [
    {
      "file": "docs/sql-server-to-azure-migration.md" | "reference/decision-rules.md",
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

=== KNOWLEDGE BASE — docs/sql-server-to-azure-migration.md (FULL) ===
${doc}

=== DECISION TREE — reference/decision-rules.md (FULL · offline mirror of the KB) ===
${rules}

=== CLAIMS REGISTRY ===
${claimsRegistry}

=== CLAIMS/SOURCE DRIFT REPORT ===
${claimsReport}

=== LINK CLASSIFICATION / REPORT ===
${links}

=== WATCHED NEWS (candidate items) ===
${news}
`);
