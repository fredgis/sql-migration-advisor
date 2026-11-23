// Where every file of the two skills Microsoft publishes lives in its layout, and how its links are
// written there.
//
// This repository keeps a skill's policy under reference/, schemas/, templates/ and docs/. The
// Microsoft layout (microsoft/microsoft-sql, and the fork in microsoft/sql-migration-agent) puts
// everything a skill reads in references/, because apm pack picks up SKILL.md plus references/ and
// nothing else. The text is the same; only the paths differ. This module is the one statement of
// that difference: tools/port-to-fork.mjs writes it, tools/check-fork-parity.mjs and
// tools/check-official-parity.mjs prove it.

export const PREREQ = 'skills/generate-migration-prerequisite-plan';
export const ADVISOR = 'skills/recommend-migration-path';

export const COPIES = [
  [`${PREREQ}/SKILL.md`, `${PREREQ}/SKILL.md`],
  [`${PREREQ}/reference/input-contract.md`, `${PREREQ}/references/input-contract.md`],
  [`${PREREQ}/reference/output-contract.md`, `${PREREQ}/references/output-contract.md`],
  [`${PREREQ}/reference/path-catalog.json`, `${PREREQ}/references/path-catalog.json`],
  [`${PREREQ}/reference/questions.json`, `${PREREQ}/references/questions.json`],
  [`${PREREQ}/reference/advisor-coverage.json`, `${PREREQ}/references/advisor-coverage.json`],
  [`${PREREQ}/reference/advisor-fact-mappings.json`, `${PREREQ}/references/advisor-fact-mappings.json`],
  [`${PREREQ}/schemas/input.schema.json`, `${PREREQ}/references/input.schema.json`],
  [`${PREREQ}/schemas/output.schema.json`, `${PREREQ}/references/output.schema.json`],
  [`${PREREQ}/templates/prerequisite-plan.md`, `${PREREQ}/references/prerequisite-plan-template.md`],
  ['docs/sql-server-to-azure-migration-prerequisite.md', `${PREREQ}/references/knowledge-base.md`],

  [`${ADVISOR}/SKILL.md`, `${ADVISOR}/SKILL.md`],
  [`${ADVISOR}/schemas/input.schema.json`, `${ADVISOR}/references/input.schema.json`],
  [`${ADVISOR}/schemas/output.schema.json`, `${ADVISOR}/references/output.schema.json`],
  ['reference/input-contract.md', `${ADVISOR}/references/input-contract.md`],
  ['reference/output-contract.md', `${ADVISOR}/references/output-contract.md`],
  ['reference/decision-rules.md', `${ADVISOR}/references/decision-rules.md`],
  ['docs/sql-server-to-azure-migration.md', `${ADVISOR}/references/knowledge-base.md`],
  ['examples/sample-recommendation.md', `${ADVISOR}/references/sample-recommendation.md`],
  // role is defined by advisor-coverage.json and required by the advisor's own output schema, so
  // the file belongs in both skills: they are meant to be independently runnable.
  [`${PREREQ}/reference/advisor-coverage.json`, `${ADVISOR}/references/advisor-coverage.json`]
];

// This layout on the left, the Microsoft layout on the right. Link text is rewritten alongside the
// target, because a label naming a path that does not exist misleads a reader even when the link
// itself works. The prefix depends on where the file lands: SKILL.md sits at the skill root and
// reaches its policy through references/, while a file already inside references/ reaches its
// siblings by name. Getting that wrong is how the knowledge-base link ended up pointing at the
// skill root, where no such file exists.
export const rewritesFor = (prefix) => [
  [/\[`(?:\.\.\/)*docs\/sql-server-to-azure-migration(?:-prerequisite)?\.md`\]\((?:\.\.\/)*docs\/sql-server-to-azure-migration(?:-prerequisite)?\.md\)/g, `[\`${prefix}knowledge-base.md\`](${prefix}knowledge-base.md)`],
  [/\((?:\.\.\/)*docs\/sql-server-to-azure-migration(?:-prerequisite)?\.md\)/g, `(${prefix}knowledge-base.md)`],
  [/`(?:\.\.\/)*docs\/sql-server-to-azure-migration(?:-prerequisite)?\.md`/g, `\`${prefix}knowledge-base.md\``],
  [/\((?:\.\.\/)*templates\/prerequisite-plan\.md\)/g, `(${prefix}prerequisite-plan-template.md)`],
  [/`(?:\.\.\/)*templates\/prerequisite-plan\.md`/g, `\`${prefix}prerequisite-plan-template.md\``],
  // A sibling skill's folder, written relative to this one. The advisor reads advisor-coverage.json
  // out of the prerequisite skill here, and the Microsoft layout gives each skill its own copy, so it
  // is reached by name there. Without this the link points at a sibling folder the flat layout
  // does not have.
  [/\[`\.\.\/generate-migration-prerequisite-plan\/reference\/([a-z0-9.-]+)`\]\(\.\.\/generate-migration-prerequisite-plan\/reference\/[a-z0-9.-]+\)/g, `[\`${prefix}$1\`](${prefix}$1)`],
  [/\.\.\/generate-migration-prerequisite-plan\/reference\/([a-z0-9.-]+)/g, `${prefix}$1`],
  // Repository-root paths written in code spans. These resolve here and nowhere there once the
  // folders move, and they are invisible to a check that reads Markdown links only: that is how
  // two of them reached a reviewer, and how two more survived the commit meant to fix them.
  [/(skills\/[a-z-]+\/)templates\/prerequisite-plan\.md/g, '$1references/prerequisite-plan-template.md'],
  [/(skills\/[a-z-]+\/)(?:reference|schemas)\//g, '$1references/'],
  [/\((?:\.\.\/)*(?:reference|references|schemas)\/([a-z0-9.-]+)\)/g, `(${prefix}$1)`],
  [/`(?:\.\.\/)*(?:reference|references|schemas)\/([a-z0-9.-]+)`/g, `\`${prefix}$1\``],
  // Repository tooling is not part of a skill bundle and does not ship there. Left as a link it
  // would point at a tools/ folder the package has no reason to carry, so the reference names
  // where the file lives instead of pretending it is next door.
  [/\[`tools\/validate-plan\.mjs`\]\((?:\.\.\/)*tools\/validate-plan\.mjs\)/g, '`validate-plan.mjs` in the upstream repository'],
  [/`tools\/validate-plan\.mjs`(?! in the upstream)/g, '`validate-plan.mjs` in the upstream repository']
];

// The text a file of this repository has in the Microsoft layout. Nothing but paths changes: no
// version is restamped and no section is swapped, so a difference between this and the published
// file is a difference in content.
export const portText = (to, text) => {
  if (!to.endsWith('.md')) return text;
  const prefix = to.includes('/references/') ? '' : 'references/';
  let out = text;
  for (const [pattern, replacement] of rewritesFor(prefix)) out = out.replace(pattern, replacement);
  return out;
};
