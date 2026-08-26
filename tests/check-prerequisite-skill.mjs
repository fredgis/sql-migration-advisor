import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = (...parts) => path.join(root, ...parts);
const read = (...parts) => fs.readFileSync(rel(...parts), 'utf8');
const parse = (...parts) => JSON.parse(read(...parts));
const failures = [];
const checks = [];

function check(name, condition, detail) {
  checks.push(name);
  if (!condition) failures.push(`${name}: ${detail}`);
}

const skillDir = ['skills', 'generate-migration-prerequisite-plan'];
const catalog = parse(...skillDir, 'reference', 'path-catalog.json');
const questions = parse(...skillDir, 'reference', 'questions.json');
const inputSchema = parse(...skillDir, 'schemas', 'input.schema.json');
const outputSchema = parse(...skillDir, 'schemas', 'output.schema.json');
const skill = read(...skillDir, 'SKILL.md');
const inputContract = read(...skillDir, 'reference', 'input-contract.md');
const outputContract = read(...skillDir, 'reference', 'output-contract.md');
const template = read(...skillDir, 'templates', 'prerequisite-plan.md');
const kb = read('docs', 'sql-server-to-azure-migration-prerequisite.md');

const expectedPathIds = Array.from({ length: 28 }, (_, i) => `P${String(i + 1).padStart(2, '0')}`);
const pathIds = catalog.paths.map(pathEntry => pathEntry.id);
check('path-count', catalog.paths.length === 28, `expected 28 paths, found ${catalog.paths.length}`);
check('path-ids', JSON.stringify(pathIds) === JSON.stringify(expectedPathIds), `expected ${expectedPathIds.join(', ')}, found ${pathIds.join(', ')}`);
check('path-ordinals', catalog.paths.every((entry, index) => entry.ordinal === index + 1), 'ordinals must be contiguous from 1 to 28');

// The output schema once admitted only P01-P22 while the catalog already declared P01-P28, so six
// paths could never be serialised and nothing caught it. Read the pattern out of the schema file
// at run time (never hard-code it here) so the next drift between the two files fails this test.
const selectedPathIdPattern = outputSchema.properties.selectedPath.properties.id.pattern;
const selectedPathIdRegex = new RegExp(selectedPathIdPattern);
for (const id of pathIds) {
  check(`output-schema-admits-catalog-id-${id}`, selectedPathIdRegex.test(id), `${id} is declared in path-catalog.json but does not match the output schema's selectedPath.id pattern ${selectedPathIdPattern}`);
}
const highestOrdinal = catalog.paths.reduce((max, entry) => Math.max(max, entry.ordinal), 0);
for (let ordinal = highestOrdinal + 1; ordinal <= 99; ordinal += 1) {
  const beyondCatalog = `P${String(ordinal).padStart(2, '0')}`;
  check(`output-schema-excludes-beyond-catalog-${beyondCatalog}`, !selectedPathIdRegex.test(beyondCatalog), `the output schema's selectedPath.id pattern ${selectedPathIdPattern} admits ${beyondCatalog}, beyond the catalog's highest ordinal P${String(highestOrdinal).padStart(2, '0')}`);
}

for (const key of ['id', 'slug', 'title', 'target', 'method', 'supportStatus']) {
  const values = catalog.paths.map(entry => entry[key]);
  check(`path-${key}-present`, values.every(value => typeof value === 'string' && value.length > 0), `every path must define ${key}`);
  if (['id', 'slug', 'title'].includes(key)) {
    check(`path-${key}-unique`, new Set(values).size === values.length, `${key} values must be unique`);
  }
}

const questionIds = questions.questions.map(question => question.id);
check('question-ids-unique', new Set(questionIds).size === questionIds.length, 'question IDs must be unique');
const definedQuestionIds = new Set(questionIds);
const effectiveQuestionIds = new Set([
  ...(catalog.commonQuestionFields || []),
  ...catalog.paths.flatMap(entry => entry.questionFields || []),
  ...catalog.paths.map(entry => entry.disambiguation?.field).filter(Boolean)
]);
for (const field of effectiveQuestionIds) {
  check(`catalog-question-${field}`, definedQuestionIds.has(field), `${field} is used by the catalog but not defined in questions.json`);
}
for (const field of questionIds) {
  check(`question-reachable-${field}`, effectiveQuestionIds.has(field), `${field} is defined but no common/path/disambiguation rule can ask it`);
}

for (const question of questions.questions) {
  check(`question-type-${question.id}`, typeof question.answerType === 'string' && question.answerType.length > 0, 'answerType is required');
  check(`question-consumer-${question.id}`, Array.isArray(question.consumedBy) && question.consumedBy.length > 0, 'at least one consuming prerequisite is required');
  const effects = Object.values(question.effects || {});
  check(`question-effects-${question.id}`, new Set(effects).size >= 2, 'at least two distinct documented effects are required');
}

const prerequisiteRows = [];
for (const line of kb.split(/\r?\n/)) {
  const match = line.match(/^\| ((?:COM|P\d{2})-\d{3}) \|/u);
  if (!match) continue;
  const cells = line.split('|').slice(1, -1).map(cell => cell.trim());
  prerequisiteRows.push({ id: match[1], cells, line });
}
const prerequisiteIds = prerequisiteRows.map(row => row.id);
const prerequisiteIdSet = new Set(prerequisiteIds);
check('prerequisite-rows-exist', prerequisiteRows.length >= 100, `expected a substantial KB, found ${prerequisiteRows.length} prerequisite rows`);
check('prerequisite-ids-unique', prerequisiteIdSet.size === prerequisiteIds.length, 'prerequisite IDs must be globally unique');

for (const row of prerequisiteRows) {
  check(`row-columns-${row.id}`, row.cells.length === 9, `expected 9 columns, found ${row.cells.length}`);
  check(`row-type-${row.id}`, ['required', 'conditional', 'recommended'].includes(row.cells[2]), `invalid requirement type ${row.cells[2]}`);
  check(`row-blocking-${row.id}`, ['Yes', 'No'].includes(row.cells[3]), `invalid blocking value ${row.cells[3]}`);
  check(`row-source-${row.id}`, /\]\(https:\/\/[^)]+\)/u.test(row.cells[7]), 'official source must be a public HTTPS Markdown link');
  check(`row-date-${row.id}`, /^\d{4}-\d{2}-\d{2}$/u.test(row.cells[8]), `invalid verification date ${row.cells[8]}`);
}

// A GFM table whose delimiter row has a different cell count from its header row is not a table
// at all: the whole block renders as raw pipe text. Six path sections shipped that way because
// every row-level check passed while the table around them was never parsed.
const kbLines = kb.split(/\r?\n/);
const cellCount = line => line.trimEnd().split('|').slice(1, -1).length;
let tableIndex = 0;
for (let i = 1; i < kbLines.length; i += 1) {
  if (!/^\s*\|\s*:?-{3,}/u.test(kbLines[i])) continue;
  if (!kbLines[i - 1].trimStart().startsWith('|')) continue;
  tableIndex += 1;
  const header = cellCount(kbLines[i - 1]);
  const delimiter = cellCount(kbLines[i]);
  check(
    `kb-table-shape-${tableIndex}`,
    header === delimiter,
    `line ${i + 1}: header has ${header} cells, delimiter row has ${delimiter}; the table will not render`
  );
}
check('kb-tables-found', tableIndex >= 24, `expected at least 24 KB tables, found ${tableIndex}`);

// The Advisor matrix is the upstream authority on which (method, target) routes exist. Nothing
// used to connect it to this catalog, so DMS shipped covering 1 of its 5 GA scenarios and no gate
// noticed. Every supported cell must now carry an explicit disposition.
const coverage = parse(...skillDir, 'reference', 'advisor-coverage.json');
const advisorKb = read('docs', 'sql-server-to-azure-migration.md');
const matrixHeader = advisorKb.split(/\r?\n/).findIndex(line => line.startsWith('| Method / tool |'));
check('advisor-matrix-found', matrixHeader !== -1, 'section 8 method x target matrix not found in the Advisor knowledge base');

const supportedCells = [];
if (matrixHeader !== -1) {
  const lines = advisorKb.split(/\r?\n/);
  const columns = lines[matrixHeader].split('|').slice(2, -1).map(cell => cell.trim());
  for (let i = matrixHeader + 2; i < lines.length && lines[i].trimStart().startsWith('|'); i += 1) {
    const cells = lines[i].split('|').slice(1, -1).map(cell => cell.trim());
    const method = cells[0];
    cells.slice(1).forEach((cell, index) => {
      if (cell.includes('✅')) supportedCells.push({ method, target: columns[index] });
    });
  }
}
check('advisor-matrix-cells', supportedCells.length === 58, `expected 58 supported cells, parsed ${supportedCells.length}`);

const dispositionKey = entry => `${entry.method}|${entry.target}`;
const dispositions = new Map(coverage.dispositions.map(entry => [dispositionKey(entry), entry]));
check(
  'coverage-no-duplicates',
  dispositions.size === coverage.dispositions.length,
  `${coverage.dispositions.length - dispositions.size} duplicate disposition(s)`
);

for (const cell of supportedCells) {
  const entry = dispositions.get(dispositionKey(cell));
  check(`coverage-declared-${cell.method}-${cell.target}`, Boolean(entry), 'supported in the Advisor matrix but absent from advisor-coverage.json');
  if (!entry) continue;
  check(
    `coverage-status-${cell.method}-${cell.target}`,
    ['path', 'out-of-scope'].includes(entry.status),
    `invalid status ${entry.status}`
  );
  if (entry.status === 'path') {
    check(`coverage-paths-${cell.method}-${cell.target}`, Array.isArray(entry.paths) && entry.paths.length > 0, 'status path requires at least one path ID');
    for (const id of entry.paths || []) {
      check(`coverage-path-exists-${cell.method}-${cell.target}-${id}`, pathIds.includes(id), `${id} is not in the path catalog`);
    }
  } else {
    check(`coverage-reason-${cell.method}-${cell.target}`, typeof entry.reason === 'string' && entry.reason.length >= 40, 'a non-path disposition requires a substantive reason');
  }
}

for (const entry of coverage.dispositions) {
  check(
    `coverage-cell-supported-${entry.method}-${entry.target}`,
    supportedCells.some(cell => dispositionKey(cell) === dispositionKey(entry)),
    'declared in advisor-coverage.json but not a supported cell in the Advisor matrix'
  );
}

// Reciprocal of the matrix -> path check above: the matrix -> path direction alone let P03, P06,
// P14 and P15 sit in the catalog referenced by zero dispositions, invisible to anyone who only
// reads the Advisor matrix. Every catalog path must be reachable from at least one disposition, or
// must openly declare, with a specific reason, why it is published standalone-only.
const pathsReferencedByCoverage = new Set(coverage.dispositions.flatMap(entry => entry.paths || []));
for (const entry of catalog.paths) {
  const isReferenced = pathsReferencedByCoverage.has(entry.id);
  const isStandalone = entry.standaloneOnly === true;
  check(
    `path-reachable-or-standalone-${entry.id}`,
    isReferenced || isStandalone,
    `${entry.id} is referenced by no advisor-coverage.json disposition and does not declare standaloneOnly`
  );
  if (!isReferenced) {
    check(
      `path-standalone-reason-${entry.id}`,
      typeof entry.standaloneReason === 'string' && entry.standaloneReason.length >= 40,
      `${entry.id} is standaloneOnly but its standaloneReason is missing or shorter than 40 characters`
    );
  } else {
    check(
      `path-no-spurious-standalone-${entry.id}`,
      entry.standaloneOnly !== true,
      `${entry.id} is reachable from advisor-coverage.json but also declares standaloneOnly; remove the flag`
    );
  }
}

// Inverse coverage. The checks above run path -> question: they prove a path can ask something.
// They cannot prove the opposite and more dangerous direction: a prerequisite that blocks readiness
// while nothing in the skill can ever resolve it. Such a row is not merely unanswered, it is a
// permanent blocker -- the plan can never reach `ready`, and the reader is given no way to act.
//
// A blocking prerequisite is resolvable when at least one of three things is true: a question that
// the path can actually ask names it, or the row demands evidence, which makes it resolvable by
// inspection. Recommended rows are exempt: they never block readiness by design.
const questionById = new Map(questions.questions.map(question => [question.id, question]));
const commonFields = catalog.commonQuestionFields || [];
const reachableByPath = new Map();
for (const entry of catalog.paths) {
  const fields = new Set([...commonFields, ...(entry.questionFields || [])]);
  const reachable = new Set();
  for (const field of fields) {
    for (const consumed of questionById.get(field)?.consumedBy || []) reachable.add(consumed);
  }
  reachableByPath.set(entry.id, reachable);
}

const allPathIds = catalog.paths.map(entry => entry.id);
let unresolvableBlockers = 0;
for (const row of prerequisiteRows) {
  if (row.cells[3] !== 'Yes') continue;
  // COM- rows are common to every path, so they must be resolvable from every path that can apply
  // them; a path-scoped row only has to be resolvable from its own path.
  const scope = row.id.startsWith('COM-') ? allPathIds : [row.id.slice(0, 3)];
  const askable = scope.some(pathId => reachableByPath.get(pathId)?.has(row.id));
  const hasEvidence = row.cells[6].length >= 4;
  const resolvable = askable || hasEvidence;
  if (!resolvable) unresolvableBlockers += 1;
  check(
    `blocking-prerequisite-resolvable-${row.id}`,
    resolvable,
    `${row.id} blocks readiness but no question the path can ask names it and it demands no evidence, so the plan can never leave blocked`
  );
}
check('blocking-prerequisites-all-resolvable', unresolvableBlockers === 0,
  `${unresolvableBlockers} blocking prerequisite(s) can never be resolved`);

// Target vocabulary differs in register between advisor-coverage.json (short forms such as
// "SQL MI", "Arc SQL MI", "SQL container") and the catalog (long forms such as "Azure SQL Managed
// Instance"). Normalise through an alias map rather than a naive substring test, which would never
// match. A disposition can combine a method path with an overlay path (AVS cells always pair a
// method path with P27, the AVS-hosting overlay); the overlay alone may be what names the target,
// so the check considers the union of every mapped path's target string, not each path in isolation.
const TARGET_ALIASES = {
  'SQL VM': 'SQL Server on Azure VM',
  AVS: 'Azure VMware Solution',
  'SQL MI': 'Azure SQL Managed Instance',
  'SQL DB': 'Azure SQL Database',
  'Fabric SQL DB': 'SQL database in Fabric',
  'Arc SQL MI': 'Azure Arc-enabled SQL Managed Instance',
  'SQL container': 'SQL Server in a container'
};
const catalogTargetById = new Map(catalog.paths.map(entry => [entry.id, entry.target]));
for (const entry of coverage.dispositions) {
  if (entry.status !== 'path') continue;
  const expectedTarget = TARGET_ALIASES[entry.target];
  check(`coverage-target-alias-known-${entry.method}-${entry.target}`, Boolean(expectedTarget), `"${entry.target}" has no entry in the test's target alias map`);
  if (!expectedTarget) continue;
  const covered = (entry.paths || []).some(id => (catalogTargetById.get(id) || '').includes(expectedTarget));
  check(
    `coverage-target-named-${entry.method}-${entry.target}`,
    covered,
    `none of ${JSON.stringify(entry.paths)} names "${expectedTarget}" (the catalog form of coverage target "${entry.target}") in its target field`
  );
}

for (const question of questions.questions) {
  for (const consumer of question.consumedBy) {
    check(`consumer-exists-${question.id}-${consumer}`, prerequisiteIdSet.has(consumer), `${consumer} does not exist in the KB`);
  }
}

for (const id of expectedPathIds) {
  check(`kb-section-${id}`, new RegExp(`^## \\d+\\. ${id} —`, 'mu').test(kb), `${id} has no dedicated KB section`);
  check(`kb-prerequisites-${id}`, prerequisiteIds.some(prerequisiteId => prerequisiteId.startsWith(`${id}-`)), `${id} has no prerequisite rows`);
}

// SKILL.md orders the skill to ask "the documented disambiguation question", but section 5 of the
// input contract only allows asking a field listed in commonQuestionFields or the selected path's
// questionFields. ha_migration_pattern and arc_restore_entrypoint are listed in neither, so the
// skill was simultaneously required and forbidden to ask them. Compute, from the catalog itself,
// which disambiguation fields actually need the documented exception, and require the contract to
// name each one.
const disambiguationOnlyFields = new Set();
for (const entry of catalog.paths) {
  const field = entry.disambiguation?.field;
  if (!field) continue;
  const inCommon = (catalog.commonQuestionFields || []).includes(field);
  const inOwnQuestionFields = (entry.questionFields || []).includes(field);
  if (!inCommon && !inOwnQuestionFields) disambiguationOnlyFields.add(field);
}
check(
  'input-contract-disambiguation-exception',
  /disambiguation/u.test(inputContract) &&
  /even\s+before a path is selected/u.test(inputContract) &&
  [...disambiguationOnlyFields].every(field => inputContract.includes(field)),
  `input-contract.md section 5 must document a disambiguation exception naming ${[...disambiguationOnlyFields].join(', ')}`
);

const knownFactNames = inputSchema.properties.knownFacts.propertyNames.enum;
check('input-schema-question-parity',
  JSON.stringify([...knownFactNames].sort()) === JSON.stringify([...questionIds].sort()),
  'input schema knownFacts must exactly match questions.json');
check('input-schema-mode-contract',
  inputSchema.allOf?.length === 2 &&
  inputSchema.properties.mode.enum.includes('advisor_handoff') &&
  inputSchema.properties.mode.enum.includes('standalone'),
  'both input modes must be schema-enforced');
check('input-schema-mode-non-null',
  inputSchema.allOf.every((branch) =>
    branch.if?.required?.includes('mode') &&
    branch.then?.required?.length === 1 &&
    branch.then?.properties?.[branch.then.required[0]]?.type === 'object'),
  'the payload selected by each input mode must be a non-null object');
check('output-schema-statuses',
  JSON.stringify(outputSchema.properties.prerequisites.items.properties.status.enum) ===
  JSON.stringify(['confirmed', 'missing', 'unknown', 'not_applicable']),
  'output prerequisite status vocabulary drifted');

check('skill-frontmatter-name', /^name: generate-migration-prerequisite-plan$/mu.test(skill), 'frontmatter name must match the folder');

// A row whose Applicability names a target its own path does not serve can never activate: the
// catalog will not resolve that target to that path, so the row is unreachable. It still counts
// towards coverage and still reads as protection, which is the dangerous part -- it overstates
// what the plan checks. AVS is exempt because it is carried by the P27 overlay rather than by
// each method path.
//
// This gate is only ever as right as the Advisor matrix behind it. It first fired on P20-015,
// scoped to SQL database in Fabric on a bcp path the matrix gave no Fabric cell -- and the row was
// correct while the matrix was wrong: Microsoft documents bcp against Fabric SQL database, both in
// the bcp "Applies to" banner and in a dedicated Fabric connect procedure. The row was deleted,
// then restored once the matrix was fixed. Treat a failure here as a question about which of the
// two sides is wrong, not as a licence to delete the row.
const canonicalTargets = [
  'Azure SQL Managed Instance',
  'Azure SQL Database',
  'SQL database in Fabric',
  'SQL Server on Azure VM',
  'Azure Arc-enabled SQL Managed Instance',
  'SQL Server in a container'
];
const targetsByPath = new Map(catalog.paths.map(entry => [entry.id, entry.target.split('/').map(part => part.trim())]));
for (const row of prerequisiteRows) {
  if (row.id.startsWith('COM-')) continue;
  const served = targetsByPath.get(row.id.slice(0, 3));
  if (!served) continue;
  for (const target of canonicalTargets) {
    if (!row.cells[5].includes(target)) continue;
    check(`row-target-reachable-${row.id}-${target.replace(/\W+/gu, '-')}`, served.includes(target),
      `${row.id} is scoped to ${target}, which ${row.id.slice(0, 3)} does not serve, so the row can never activate`);
  }
}

// Every path identifier written in prose is a routing instruction the agent will follow literally.
// A wrong one is invisible on review -- `P21` and `P20` read alike -- and sends the reader to an
// unrelated prerequisite set. Prose that names an identifier and its method in parentheses, the
// house style, is checked against the catalog so the pair has to agree.
const catalogMethods = new Map(catalog.paths.map(entry => [entry.id, entry.method.toLowerCase()]));
for (const doc of [
  { name: 'SKILL.md', text: skill },
  { name: 'input-contract.md', text: inputContract },
  { name: 'output-contract.md', text: outputContract }
]) {
  for (const [, id] of doc.text.matchAll(/`(P\d{2})`/gu)) {
    check(`${doc.name}-path-exists-${id}`, catalogMethods.has(id),
      `${doc.name} names ${id}, which is not a catalog path`);
  }
  for (const [, id, label] of doc.text.matchAll(/`(P\d{2})` \(`?([^)`]+)`?\)/gu)) {
    const method = catalogMethods.get(id);
    const claimed = label.trim().toLowerCase();
    check(`${doc.name}-path-method-${id}-${claimed.replace(/\W+/gu, '-')}`,
      method !== undefined && (method.includes(claimed) || claimed.includes(method)),
      `${doc.name} calls ${id} "${label.trim()}" but the catalog method is "${method}"`);
  }
}

check('skill-ask-user', /^allowed-tools: ask_user$/mu.test(skill), 'the guided interview must declare ask_user');
check('skill-contracts-wired',
  ['input-contract.md', 'output-contract.md', 'path-catalog.json', 'questions.json', 'input.schema.json', 'output.schema.json', 'sql-server-to-azure-migration-prerequisite.md'].every(name => skill.includes(name)),
  'SKILL.md must reference every local contract, both schemas and the KB');
check('handoff-no-reask',
  /Do not re-ask a fact already present/u.test(inputContract) && /Never re-ask an Advisor-supplied fact/u.test(skill),
  'Advisor facts must not be re-asked');
check('no-multiselect',
  /Never use a multi-select/u.test(inputContract) && /never use multi-select/u.test(skill),
  'multi-select controls must be forbidden');
check('free-text-not-evidence',
  /Never convert free prose/u.test(inputContract) && /Never promote free prose/u.test(skill),
  'free-text claims must not confirm evidence');
check('unknown-semantics',
  ['CONFIRMED', 'MISSING', 'UNKNOWN', 'NOT_APPLICABLE'].every(marker => inputContract.includes(marker)),
  'all four absence/readiness markers must be defined');
check('markdown-json-parity',
  /same normalized\s+decision state/u.test(inputContract) &&
  /same object/u.test(outputContract) &&
  /Build the JSON object first/u.test(skill),
  'Markdown and JSON must share one state model');
check('template-columns',
  template.includes('| Area | Prerequisite | Status | Blocking | Owner | Evidence required | Official source |'),
  'the required output table columns drifted');

// The invariant count lived twice: as a literal here and as prose in SKILL.md. Two copies of a
// number drift, and the drift is silent -- the skill would tell the agent to run 13 checks while 16
// exist, so the last three would never run. Derive both from the table instead of restating it.
const invariantCount = (outputContract.match(/^\| \d+ \| /gmu) || []).length;
const invariantIds = (outputContract.match(/^\| (\d+) \| /gmu) || []).map(row => Number(row.split('|')[1].trim()));
check('output-invariants-present', invariantCount >= 13, `expected at least 13 self-check invariants, found ${invariantCount}`);
check('output-invariants-numbered', invariantIds.every((id, index) => id === index + 1),
  `self-check invariants are not numbered 1..${invariantCount}: ${invariantIds.join(',')}`);
const declaredInvariants = Number((skill.match(/Run all (\d+) output invariants/u) || [])[1]);
check('output-invariants-count-declared', declaredInvariants === invariantCount,
  `SKILL.md tells the agent to run ${declaredInvariants} invariants but the contract defines ${invariantCount}`);

// The README advertises the size of the knowledge base. It had drifted to 237 while the file held
// 283, because nothing tied the prose to the table. A stale count is a small lie with a large
// effect: it is the number a reader uses to decide whether the KB is worth trusting.
const readme = read('README.md');
const advertised = readme.match(/(\d+) common requirements and (\d+) rows in total/u);
check('readme-row-counts-present', advertised !== null, 'README no longer advertises the knowledge-base size');
if (advertised) {
  const commonRows = prerequisiteRows.filter(row => row.id.startsWith('COM-')).length;
  check('readme-common-count', Number(advertised[1]) === commonRows,
    `README claims ${advertised[1]} common requirements, the KB has ${commonRows}`);
  check('readme-total-count', Number(advertised[2]) === prerequisiteRows.length,
    `README claims ${advertised[2]} rows, the KB has ${prerequisiteRows.length}`);
}

const specialSupport = Object.fromEntries(catalog.paths.map(entry => [entry.id, entry.supportStatus]));
check('data-box-support-label', specialSupport.P14 === 'composed_pattern', `P14 label is ${specialSupport.P14}`);
check('striim-support-label', specialSupport.P15 === 'third_party', `P15 label is ${specialSupport.P15}`);
check('fabric-support-label', specialSupport.P16 === 'preview_tool_ga_target', `P16 label is ${specialSupport.P16}`);
check('smart-bulk-support-label', specialSupport.P22 === 'deprecated_archived_sample', `P22 label is ${specialSupport.P22}`);
const smartBulkPath = catalog.paths.find(entry => entry.id === 'P22');
check('smart-bulk-opt-in-required', smartBulkPath?.requiresExplicitOptIn === true,
  'P22 must declare requiresExplicitOptIn so an archived sample is never resolved by inference');
check('smart-bulk-opt-in-reason', /archived/u.test(smartBulkPath?.optInReason || '') && /\.NET Core 3\.1/u.test(smartBulkPath?.optInReason || ''),
  'P22 optInReason must state both the archived repository and the out-of-support runtime');
check('smart-bulk-opt-in-gated', smartBulkPath?.disambiguation?.field === 'bulk_copy_tool' && smartBulkPath?.disambiguation?.equals === 'SMART_BULK_COPY',
  'P22 must stay behind an explicit bulk_copy_tool choice');
check('smart-bulk-opt-in-documented', /explicit(ly)? (opt|choose|select)/iu.test(skill) && /P22/u.test(skill),
  'SKILL.md must document the P22 explicit opt-in rule');
for (const entry of catalog.paths) {
  if (entry.id === 'P22') continue;
  check(`support-label-not-deprecated-${entry.id}`, entry.supportStatus !== 'deprecated_archived_sample',
    `${entry.id} must not borrow the archived-sample label`);
}
check('data-box-caveat',
  /Data Box transports files; it does not restore a SQL Server backup/u.test(kb) && /a `\.bak` alone cannot be restored/u.test(kb),
  'P14 must not be presented as direct SQL backup restore to Azure SQL Database');
check('fabric-caveat',
  /target is GA/u.test(kb) && /Migration Assistant is Preview/u.test(kb),
  'P16 must distinguish the GA target from the Preview tool');
check('smart-bulk-caveat',
  /archived read-only/u.test(kb) &&
  /\*\*2023-07-12\*\*/u.test(kb) &&
  /146a9056/u.test(kb) &&
  /metadata change, not a code change/u.test(kb) &&
  /\.NET Core 3\.1/u.test(kb) &&
  /not\*\* an Azure migration service or supported product/u.test(kb),
  'P22 must date the archive on its last commit, say plainly that the repository updated_at timestamp is not a code change, and disclose the out-of-support runtime and the lack of product/SLA support');
check('smart-bulk-skill-guardrail',
  /archived/u.test(skill) &&
  /\.NET Core 3\.1/u.test(skill) &&
  /out of support/u.test(skill) &&
  /Never describe Smart Bulk Copy as an Azure service/u.test(skill),
  'SKILL.md must name the archived repository and unsupported .NET Core 3.1 runtime in the P22 support label, and forbid presenting Smart Bulk Copy as a product in Guardrails');

const sourceUrls = [...new Set([...kb.matchAll(/\]\((https:\/\/[^)]+)\)/gu)].map(match => match[1]))];
const allowedSourceHosts = new Set(['learn.microsoft.com', 'github.com', 'www.striim.com', 'developer.striim.com']);
for (const url of sourceUrls) {
  const parsed = new URL(url);
  check(`source-host-${url}`, allowedSourceHosts.has(parsed.hostname), `${parsed.hostname} is not an approved primary-source host`);
  if (parsed.hostname === 'github.com') {
    check(`github-source-owner-${url}`, parsed.pathname.toLowerCase().startsWith('/azure-samples/'), 'GitHub sources must belong to Azure-Samples');
  }
}

async function checkLink(url) {
  const request = async method => fetch(url, {
    method,
    redirect: 'follow',
    headers: {
      'user-agent': 'sql-migration-advisor-prerequisite-link-check/1.0',
      ...(method === 'GET' ? { range: 'bytes=0-1024' } : {})
    },
    signal: AbortSignal.timeout(30000)
  });
  let response = await request('HEAD');
  if ([403, 405, 429].includes(response.status)) response = await request('GET');
  return { url, status: response.status, finalUrl: response.url };
}

// The link check above proves a page answers, and nothing more. A fragment is never sent to the
// server, so `.../log-replay-service-migrate#stop-the-migration` returned 200 for as long as it was
// wrong -- the heading is `stop-the-migration-optional`. A reader following that source lands at the
// top of a long page with no idea which paragraph was meant to justify the row, which is the whole
// value of citing an anchor. Headings get renamed far more often than pages get retired, so these
// rot silently and faster than the URLs around them. Resolve each fragment against the ids the page
// actually renders.
async function checkAnchors(page, fragments) {
  const response = await fetch(page, {
    redirect: 'follow',
    headers: { 'user-agent': 'sql-migration-advisor-prerequisite-anchor-check/1.0' },
    signal: AbortSignal.timeout(45000)
  });
  if (!response.ok) return [{ url: page, ok: false, reason: `HTTP ${response.status}` }];
  const html = await response.text();
  const ids = new Set([
    ...[...html.matchAll(/\sid="([^"]+)"/gu)].map(match => match[1].toLowerCase()),
    ...[...html.matchAll(/\sname="([^"]+)"/gu)].map(match => match[1].toLowerCase())
  ]);
  return [...fragments].map(fragment => ({
    url: `${page}#${fragment}`,
    ok: ids.has(decodeURIComponent(fragment).toLowerCase()),
    reason: 'no heading on the page renders this id, so the anchor resolves nowhere'
  }));
}

if (process.argv.includes('--check-links')) {
  const pending = [...sourceUrls];
  const results = [];
  const workers = Array.from({ length: Math.min(8, pending.length) }, async () => {
    while (pending.length) {
      const url = pending.shift();
      try {
        results.push(await checkLink(url));
      } catch (error) {
        results.push({ url, status: 0, error: error.message });
      }
    }
  });
  await Promise.all(workers);
  for (const result of results) {
    check(`live-source-${result.url}`, result.status >= 200 && result.status < 400, `HTTP ${result.status}${result.error ? ` (${result.error})` : ''}`);
  }

  const fragmentsByPage = new Map();
  for (const url of sourceUrls) {
    const hash = url.indexOf('#');
    if (hash === -1) continue;
    const page = url.slice(0, hash);
    const fragment = url.slice(hash + 1);
    if (!fragmentsByPage.has(page)) fragmentsByPage.set(page, new Set());
    fragmentsByPage.get(page).add(fragment);
  }
  const anchorPages = [...fragmentsByPage.keys()];
  const anchorResults = [];
  const anchorWorkers = Array.from({ length: Math.min(6, anchorPages.length) }, async () => {
    while (anchorPages.length) {
      const page = anchorPages.shift();
      try {
        anchorResults.push(...await checkAnchors(page, fragmentsByPage.get(page)));
      } catch (error) {
        anchorResults.push({ url: page, ok: false, reason: error.message });
      }
    }
  });
  await Promise.all(anchorWorkers);
  for (const result of anchorResults) {
    check(`live-anchor-${result.url}`, result.ok, result.reason);
  }
}

if (failures.length) {
  console.error(`Prerequisite skill checks failed (${failures.length}/${checks.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Prerequisite skill checks passed: ${checks.length} checks, ${catalog.paths.length} paths, ${questions.questions.length} questions, ${prerequisiteRows.length} prerequisites, ${sourceUrls.length} primary-source URLs.`);
