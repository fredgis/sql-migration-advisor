// Assemble the user prompt for the GitHub Models review step.
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
`Review the FULL knowledge base AND the FULL decision tree below, then decide whether a
substantive update is warranted THIS WEEK, based on:
(a) official Azure / SQL Server news feeds,
(b) the link classification (403/429 are unverified, not healthy),
(c) claims/source content drift, and
(d) drift between the two documents — the decision tree is a distilled mirror of the
    knowledge base and must stay consistent with it.

Important governance rule: your needsUpdate verdict is advisory only. It must never by
itself bump the version. A version increment is allowed only after substantive content
edits have actually been applied and consistency tests pass. Broken links alone should be
reported for human review unless a link URL is actually rewritten.

Only recommend changes relevant to migrating SQL Server to Azure: GA/preview/retirement,
changed dates, target/method/tool changes, pricing/ESU/licensing, inaccessible/moved
sources, or KB-to-decision-tree drift. Ignore unrelated products.

Respond with ONLY a JSON object (no prose, no code fence):
{"needsUpdate": true|false, "bump": "minor"|"major", "changelog": "<=300 chars, truthful summary of APPLIED content edits only; do not claim link fixes unless URLs were rewritten", "suggestions": "markdown bullets; each names the file (docs/sql-server-to-azure-migration.md or reference/decision-rules.md), concrete edit, affected claim/rule if applicable, and source link; empty string if none"}

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
