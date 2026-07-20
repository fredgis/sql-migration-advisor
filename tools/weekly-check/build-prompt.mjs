// Assemble the user prompt for the GitHub Models review step.
// Prints to stdout (the workflow redirects it to prompt.txt).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DOC = path.resolve(HERE, '..', '..', 'docs', 'sql-server-to-azure-migration.md');
const RULES = path.resolve(HERE, '..', '..', 'reference', 'decision-rules.md');
const read = (p, fallback) => { try { return fs.readFileSync(p, 'utf8'); } catch { return fallback; } };

const doc = read(DOC, '').trim();
const rules = read(RULES, '').trim() || '_reference/decision-rules.md not found._';
const links = read('lychee-report.md', '').trim() || '_No broken-link report produced._';
const news = read('news.md', '').trim() || '_No news file._';

process.stdout.write(
`Review the FULL knowledge base AND the FULL decision tree below, then decide whether an
update is warranted THIS WEEK, based on:
(a) this week's official Azure / SQL Server news,
(b) any broken or moved links found, and
(c) any drift between the two documents — the decision tree is a distilled mirror of the
    knowledge base and must stay consistent with it, so flag stale versions, dates, retired
    tools, or target/method/gate facts that disagree between them.

Only recommend an update for things actually relevant to migrating SQL Server to Azure:
a new GA / preview / retirement, changed effective dates, a new target/method/tool,
pricing / ESU / licensing changes, a broken/moved link, or KB-to-decision-tree drift.
Ignore unrelated products (MySQL, PostgreSQL, Cosmos DB, etc.) and pure marketing posts.

Respond with ONLY a JSON object (no prose, no code fence):
{"needsUpdate": true|false, "bump": "minor"|"major", "changelog": "<=300 chars, one line for the changelog", "suggestions": "markdown bullets; each names the file (docs/sql-server-to-azure-migration.md or reference/decision-rules.md), the concrete edit, and a source link; empty string if none"}

=== KNOWLEDGE BASE — docs/sql-server-to-azure-migration.md (FULL) ===
${doc}

=== DECISION TREE — reference/decision-rules.md (FULL · offline mirror of the KB) ===
${rules}

=== BROKEN-LINK REPORT ===
${links}

=== THIS WEEK'S NEWS (candidate items) ===
${news}
`);
