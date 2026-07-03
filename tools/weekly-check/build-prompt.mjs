// Assemble the user prompt for the GitHub Models review step.
// Prints to stdout (the workflow redirects it to prompt.txt).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DOC = path.resolve(HERE, '..', '..', 'docs', 'sql-server-to-azure-migration.md');
const read = (p, fallback) => { try { return fs.readFileSync(p, 'utf8'); } catch { return fallback; } };

const docHead = read(DOC, '').split('\n').slice(0, 48).join('\n');
const links = read('lychee-report.md', '').trim() || '_No broken-link report produced._';
const news = read('news.md', '').trim() || '_No news file._';

process.stdout.write(
`Decide whether the knowledge base below needs an update THIS WEEK, based on:
(a) any broken links found, and
(b) this week's official Azure / SQL Server news.

Only recommend an update for things actually relevant to migrating SQL Server to Azure:
a new GA / preview / retirement, changed effective dates, a new target/method/tool,
pricing / ESU / licensing changes, or a broken/moved link. Ignore unrelated products
(MySQL, PostgreSQL, Cosmos DB, etc.) and pure marketing posts.

Respond with ONLY a JSON object (no prose, no code fence):
{"needsUpdate": true|false, "bump": "minor"|"major", "changelog": "<=300 chars, one line for the changelog", "suggestions": "markdown bullets with the concrete edit to make and the source link for each; empty string if none"}

=== CURRENT DOC (intro, tooling reset, version) ===
${docHead}

=== BROKEN-LINK REPORT ===
${links}

=== THIS WEEK'S NEWS (candidate items) ===
${news}
`);
