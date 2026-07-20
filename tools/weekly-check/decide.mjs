// Decide whether a PR is warranted and prepare its inputs.
// Reads: env LYCHEE_EXIT, NEWS_COUNT; files response.txt (AI JSON), news.md, lychee-report.md.
// Writes: changelog.txt, pr-body.md; sets GITHUB_OUTPUT changed / bump.
import fs from 'node:fs';

const read = (p, f = '') => { try { return fs.readFileSync(p, 'utf8'); } catch { return f; } };
const LYCHEE_EXIT = (process.env.LYCHEE_EXIT || '0').trim();
const NEWS_COUNT = parseInt(process.env.NEWS_COUNT || '0', 10) || 0;
const hasBroken = LYCHEE_EXIT !== '' && LYCHEE_EXIT !== '0';

let ai = {};
const resp = read('response.txt').trim();
if (resp) {
  const m = resp.match(/\{[\s\S]*\}/);
  if (m) { try { ai = JSON.parse(m[0]); } catch { /* ignore malformed */ } }
}

const needsUpdate = ai.needsUpdate === true;
const changed = hasBroken || needsUpdate;
const bump = ai.bump === 'major' ? 'major' : 'minor';

const parts = [];
if (hasBroken) parts.push('fixed/verified broken link(s)');
if (needsUpdate && ai.changelog) parts.push(String(ai.changelog).trim());
else if (NEWS_COUNT > 0) parts.push(`reviewed ${NEWS_COUNT} Azure/SQL update(s)`);
let changelog = (ai.changelog && String(ai.changelog).trim())
  || (parts.length ? `Weekly check: ${parts.join('; ')}.` : 'Weekly freshness check: links re-verified; no substantive changes.');
changelog = changelog.replace(/\s+/g, ' ').slice(0, 300);
fs.writeFileSync('changelog.txt', changelog);

const triggers = [
  hasBroken ? '- ⚠️ Broken or moved links were detected (see the link report below).' : '- ✅ All links resolved.',
  needsUpdate ? '- 🔔 The automated review flagged relevant Azure/SQL news worth folding in.' : `- 📰 ${NEWS_COUNT} candidate news item(s) reviewed.`
].join('\n');

const body = `## 🔄 Weekly knowledge-base freshness check

This PR was opened automatically by the weekly check workflow.

### Why this PR was opened
${triggers}

### Applied automatically
- Version bumped and a changelog row added in \`docs/sql-server-to-azure-migration.md\`.
- Freshness stamp synced in \`reference/decision-rules.md\` (the skill's offline mirror) — **check it for substantive drift**, content isn't auto-propagated.
- PDF and preview regenerated (best-effort — verify the diff).

### Suggested substantive edits (review before merge)
${(ai.suggestions && String(ai.suggestions).trim()) || '_None proposed by the automated review. Confirm the news items below don\'t require content changes._'}

### 📰 This week's news
${read('news.md', '_No news file._')}

### 🔗 Link report
<details><summary>lychee report</summary>

${read('lychee-report.md', '_No link report produced._')}

</details>

---
_Automated by \`.github/workflows/weekly-kb-check.yml\`. A human should confirm any substantive wording before merge — this document grounds the \`sql-migration-advisor\` skill._
`;
fs.writeFileSync('pr-body.md', body);

const out = process.env.GITHUB_OUTPUT;
if (out) fs.appendFileSync(out, `changed=${changed}\nbump=${bump}\n`);
console.log(`changed=${changed} bump=${bump} hasBroken=${hasBroken} needsUpdate=${needsUpdate} news=${NEWS_COUNT}`);
console.log(`changelog: ${changelog}`);
