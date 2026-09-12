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
const catalogVariantsById = new Map(catalog.paths.map(entry => [entry.id, entry.targetVariants || []]));
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
  // Third review pass on microsoft/sql-migration-agent#27: invariant 17 requires the plan to name
  // the selected family in targetVariant, and targetVariants was derived from each path's own
  // target string. For AVS that string lives on the overlay, not on the method path, so nine
  // documented AVS routes could satisfy neither the invariant nor the coverage map. The invariant
  // reads the union of the method path and its overlays, and so does this check.
  const variantUnion = new Set((entry.paths || []).flatMap(id => catalogVariantsById.get(id) || []));
  check(
    `coverage-target-variant-available-${entry.method}-${entry.target}`,
    variantUnion.has(expectedTarget),
    `no path in ${JSON.stringify(entry.paths)} offers "${expectedTarget}" as a targetVariant, so a plan for this route cannot satisfy invariant 17`
  );
}

// Sixth review pass: the matrix and the engine name a method in one spelling and the catalog
// answers to another, so the label had to be resolved by a hard-coded escape hatch in the engine
// instead of by the catalog. Checking that every path exists says nothing about whether its name
// can be found, which is how "DMS" for SQL Database, "Distributed / Always On AG" and the
// container restore all became unreachable by name under a green suite.
const aliasKey = value => String(value).toLowerCase().replace(/[^a-z0-9]/gu, '');
const aliasesById = new Map(catalog.paths.map(entry => [entry.id, (entry.advisorAliases || []).map(aliasKey)]));
for (const entry of coverage.dispositions) {
  if (entry.status !== 'path' || !(entry.paths || []).length) continue;
  check(
    `coverage-method-resolvable-${entry.method}-${entry.target}`,
    entry.paths.some(id => (aliasesById.get(id) || []).includes(aliasKey(entry.method))),
    `the matrix calls this route "${entry.method}" and none of ${JSON.stringify(entry.paths)} lists that spelling in advisorAliases, so the label resolves to no path`
  );
}

// The other half of the same question: a spelling that resolves to two paths sharing a target is
// as unusable as one that resolves to none, because the catalog picks whichever comes first.
// "Azure Migrate" named both the assessment and the VM replication, and an assessment plan is not
// a replication plan. Shared spellings are legitimate, but only behind a disambiguation field.
const pathsByAlias = new Map();
for (const entry of catalog.paths) {
  for (const alias of entry.advisorAliases || []) {
    const key = aliasKey(alias);
    if (!pathsByAlias.has(key)) pathsByAlias.set(key, new Set());
    pathsByAlias.get(key).add(entry);
  }
}
for (const [key, entrySet] of pathsByAlias) {
  const entries = [...entrySet];
  if (entries.length < 2) continue;
  for (const target of new Set(entries.flatMap(entry => entry.targetVariants || [entry.target]))) {
    const competing = entries.filter(entry => (entry.targetVariants || [entry.target]).includes(target));
    if (competing.length < 2) continue;
    check(
      `alias-disambiguated-${key}-${aliasKey(target)}`,
      competing.every(entry => entry.disambiguation?.field),
      `${competing.map(entry => entry.id).join(' and ')} answer to the same spelling for "${target}" and ${competing.filter(entry => !entry.disambiguation?.field).map(entry => entry.id).join(', ')} declare no disambiguation field, so the catalog resolves the label by accident`
    );
  }
}

for (const question of questions.questions) {
  for (const consumer of question.consumedBy) {
    check(`consumer-exists-${question.id}-${consumer}`, prerequisiteIdSet.has(consumer), `${consumer} does not exist in the KB`);
  }
}

// Sixth review pass. The plan must echo six provenance fields in advisor_handoff mode, and the
// regression mirror declared three of them nowhere. A handoff that validated on the way in produced
// a plan that could not validate on the way out unless someone invented the provenance. A consumer
// requirement no accepted producer shape can satisfy is not a requirement, it is a trap, and
// nothing was comparing the two ends.
{
  const handoffBranch = (outputSchema.allOf || []).find(branch =>
    branch?.if?.properties?.metadata?.properties?.mode?.const === 'advisor_handoff');
  check('handoff-branch-present', Boolean(handoffBranch),
    'the output schema no longer carries an advisor_handoff branch, so this check has nothing to compare');
  const demanded = handoffBranch?.then?.properties?.metadata?.properties?.sourceAdvisor?.required || [];
  check('handoff-demands-provenance', demanded.length > 0,
    'the handoff branch demands no provenance at all, so this check is checking nothing');

  // A field the plan must echo has to be readable from every shape a handoff may arrive in, either
  // at the top level of the mirror or inside the canonical shape's metadata.
  const supplies = {
    advisorPublicOutput: new Set(inputSchema.$defs?.advisorPublicOutput?.properties?.metadata?.required || []),
    advisorMirrorOutput: new Set(inputSchema.$defs?.advisorMirrorOutput?.required || [])
  };
  for (const [shape, guaranteed] of Object.entries(supplies)) {
    for (const field of demanded) {
      // controlPlane rides on the recommendation in the canonical shape and at the top level in the
      // mirror, and both require it; the sweep below reads the place each shape keeps it.
      const alsoRequired = shape === 'advisorPublicOutput'
        && (inputSchema.$defs.advisorPublicOutput.properties.recommendation?.required || []).includes(field);
      check(`handoff-provenance-suppliable-${shape}-${field}`, guaranteed.has(field) || alsoRequired,
        `the plan must echo \`${field}\` in advisor_handoff mode and ${shape} does not require it, so a valid input can produce an output that cannot validate`);
    }
  }

  // The consumer's copy of the provenance vocabulary equals the producer's, or the check above only
  // proves a field arrives and says nothing about whether its value can be read.
  const advisorOut = JSON.parse(read('skills', 'recommend-migration-path', 'schemas', 'output.schema.json'));
  const sourceAdvisor = outputSchema.properties.metadata.properties.sourceAdvisor.properties;
  const producerMeta = advisorOut.$defs.metadata.properties;
  for (const field of ['recommendationStatus', 'confidence']) {
    const ref = producerMeta[field]?.$ref?.split('/').pop();
    const producerEnum = advisorOut.$defs[ref]?.enum || [];
    check(`handoff-provenance-typed-${field}`,
      JSON.stringify(sourceAdvisor[field]?.enum) === JSON.stringify(producerEnum),
      `the plan types sourceAdvisor.${field} as ${JSON.stringify(sourceAdvisor[field])} and the Advisor emits ${JSON.stringify(producerEnum)}`);
  }
  check('handoff-provenance-keeps-the-commit', Boolean(sourceAdvisor.sourceCommit),
    'sourceAdvisor is closed and declares no sourceCommit, so the one identifier that pins a recommendation to an exact tree is dropped on the way through');

  // The vocabulary check above compares the shared $defs and says nothing about the fields that
  // use them. So the Advisor could close `recommendation.target` to the eight families while the
  // consumer still took any string, and the phrase the producer had just stopped emitting would
  // have been accepted by the end that reads it. A check whose scope is narrower than its name is
  // the defect this whole review kept finding; this is the same question asked of the fields.
  const resolve = (schema, node) => (node?.$ref ? schema.$defs[node.$ref.split('/').pop()] : node);
  const shapeOf = (schema, node) => {
    const resolved = resolve(schema, node) || {};
    return JSON.stringify({ enum: resolved.enum, type: resolved.type, minimum: resolved.minimum, items: resolved.items });
  };
  const producerRec = advisorOut.$defs.recommendation;
  const consumerRec = inputSchema.$defs.advisorPublicOutput.properties.recommendation;
  check('handoff-recommendation-requires-the-same-fields',
    JSON.stringify([...(producerRec.required || [])].sort()) === JSON.stringify([...(consumerRec.required || [])].sort()),
    `the Advisor requires ${JSON.stringify(producerRec.required)} on a recommendation and the consumer requires ${JSON.stringify(consumerRec.required)}; the looser end accepts a recommendation the other never emits`);
  for (const field of Object.keys(producerRec.properties || {})) {
    const consumerField = consumerRec.properties?.[field];
    check(`handoff-recommendation-field-typed-alike-${field}`,
      consumerField && shapeOf(advisorOut, producerRec.properties[field]) === shapeOf(inputSchema, consumerField),
      `\`recommendation.${field}\` is ${shapeOf(advisorOut, producerRec.properties[field])} for the Advisor and ${consumerField ? shapeOf(inputSchema, consumerField) : 'absent'} for the consumer`);
  }
  // The mirror names the same family in a flat field, and it has to be the same vocabulary.
  check('handoff-mirror-target-typed-alike',
    shapeOf(inputSchema, inputSchema.$defs.advisorMirrorOutput.properties.primary_target) === shapeOf(advisorOut, producerRec.properties.target),
    'the regression mirror types primary_target differently from the Advisor\'s recommendation.target, so a value refused at one end arrives at the other');
  // Both shapes answer a shortlist the same way the producer states it, or a handoff could declare
  // it had refused to choose while naming the target it chose.
  for (const shape of ['advisorPublicOutput', 'advisorMirrorOutput']) {
    check(`handoff-${shape}-separates-a-shortlist-from-a-recommendation`,
      (inputSchema.$defs[shape].allOf || []).length === 2,
      `${shape} does not branch on recommendationStatus, so it can carry a shortlist and a chosen target at once`);
  }
}

// Sixth review pass. The error table tells the agent to stop when a bundle file declares a schema
// or knowledge base line that disagrees. A bare `version` key reads as exactly that claim, so a
// crosswalk carrying its own release history could halt a run for disagreeing with lines it was
// never declaring. A file versions itself under its own key, or it declares the coordinated line.
{
  const bundleFiles = [
    ['reference', 'path-catalog.json'],
    ['reference', 'questions.json'],
    ['reference', 'advisor-coverage.json'],
    ['reference', 'advisor-fact-mappings.json'],
    ['schemas', 'input.schema.json'],
    ['schemas', 'output.schema.json']
  ];
  const schemaLine = outputSchema.properties.metadata.properties.schemaVersion.const;
  const kbLine = outputSchema.properties.metadata.properties.prerequisiteKnowledgeBaseVersion.const;
  for (const parts of bundleFiles) {
    const file = parts.join('/');
    const declared = parse(...skillDir, ...parts).version;
    check(`bundle-version-key-is-unambiguous-${file}`,
      declared === undefined || declared === schemaLine || declared === kbLine,
      `${file} declares \`version: ${declared}\`, which is neither the schema line ${schemaLine} nor the knowledge base line ${kbLine}; the startup rule reads a bare version as a claim about those two and stops, so this file halts a run for being healthy. Version it under its own key.`);
  }
  const crosswalk = parse(...skillDir, 'reference', 'advisor-fact-mappings.json');
  check('crosswalk-versions-itself-under-its-own-key', Boolean(crosswalk.mappingsVersion),
    'advisor-fact-mappings.json carries its own release history and must publish it as mappingsVersion, so a reader can tell a crosswalk revision from a policy line');
}

// Sixth review pass. The worked example counted the seven P10 rows and none of the twelve common
// ones, so it showed a third of the blocking surface a real plan carries and taught a reader to
// expect a shorter plan than the skill produces. An example is a claim about the output, and it was
// the only claim nothing checked.
{
  const example = (skill.match(/```text\n([\s\S]*?)```/u) || [])[1] || '';
  check('example-block-present', example.length > 0, 'SKILL.md no longer carries a worked example, so this check has nothing to read');
  const pathId = (example.match(/Path (P[0-9]{2})/u) || [])[1];
  check('example-names-its-path', Boolean(pathId), 'the worked example does not name the path it plans');
  if (pathId) {
    const commonRows = prerequisiteRows.filter(row => row.id.startsWith('COM-')).length;
    const pathRows = prerequisiteRows.filter(row => row.id.startsWith(`${pathId}-`)).length;
    const expected = commonRows + pathRows;
    const claimed = Number((example.match(/carries \*{0,2}(\d+) rows/u) || skill.match(/plan carries \*{0,2}(\d+) rows\*{0,2}/u) || [])[1]);
    check('example-counts-the-whole-plan', claimed === expected,
      `the example is written for ${pathId} and claims ${claimed} rows where the knowledge base gives ${commonRows} common plus ${pathRows} path rows, which is ${expected}`);
    // The totals line is the sentence a reader trusts; it has to add up to the same plan.
    const total = (example.match(/^Total\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/mu) || []).slice(1).map(Number);
    check('example-totals-add-up', total.length === 5 && total.reduce((sum, n) => sum + n, 0) === expected,
      `the example's totals row sums to ${total.reduce((sum, n) => sum + n, 0)} and the plan has ${expected} rows`);
    // Per-area rows have to sum to the totals, or the table contradicts its own last line.
    const areas = [...example.matchAll(/^(Common|P[0-9]{2})\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*$/gmu)]
      .map(row => row.slice(2).map(Number));
    check('example-areas-sum-to-the-total', areas.length >= 2
      && total.every((value, column) => areas.reduce((sum, row) => sum + row[column], 0) === value),
      'the example\'s per-area counts do not sum to its own totals row');
    // And the columns the template mandates have to be the ones the example shows.
    for (const column of ['Confirmed', 'Reported', 'Missing', 'Unknown', 'Not applicable']) {
      check(`example-shows-column-${column.replace(/\s+/gu, '-')}`, example.includes(column),
        `the template's summary mandates a ${column} column and the example omits it, so the example teaches a shape the renderer does not produce`);
    }
  }
}

// Sixth review pass. The output schema types an object nobody had ever built, which is why four
// separate findings all landed here: a plan could invent a prerequisite, rewrite a knowledge base
// row, flip a blocker to non-blocking, confirm a row with an evidence id naming nothing, contradict
// its own counts, and still declare itself ready. A schema cannot express any of that. The
// validator can, and until now there was no plan to run it against, so nothing exercised the rules
// the output contract had been stating all along.
{
  const { validate } = await import('../tools/validate-plan.mjs');
  const good = JSON.parse(read('tests', 'plans', 'valid-p10.json'));
  const clone = () => JSON.parse(JSON.stringify(good));
  check('exemplar-plan-is-valid', validate(good).length === 0,
    `the exemplar plan does not satisfy its own contract: ${validate(good).join('; ')}`);

  // Each mutation is one of the ways a plan was free to lie. The check is not that something
  // failed, but that the right thing failed: a validator that rejects everything proves nothing.
  const mutations = [
    ['an invented prerequisite id', plan => { plan.prerequisites[0].id = 'P99-999'; }, 'not a prerequisite the knowledge base defines'],
    ['a duplicated prerequisite id', plan => { plan.prerequisites.push(JSON.parse(JSON.stringify(plan.prerequisites[0]))); }, 'appears more than once'],
    ['a rewritten row title', plan => { plan.prerequisites[0].title = 'Something else entirely'; }, 'in the knowledge base'],
    ['a reclassified obligation', plan => { plan.prerequisites[0].requirementType = 'recommended'; }, 'may not reclassify an obligation'],
    ['a blocker flipped to non-blocking', plan => { plan.prerequisites[0].blocking = false; }, 'flipping that bit is how a blocker stops counting'],
    ['evidence naming no record', plan => { plan.prerequisites[0].acceptedEvidence = ['EV-999']; }, 'source register does not contain'],
    ['the same evidence cited twice', plan => { const id = plan.prerequisites[0].acceptedEvidence[0]; plan.prerequisites[0].acceptedEvidence = [id, id]; }, 'lists the same evidence id twice'],
    ['a confirmation resting on nothing', plan => { plan.prerequisites[0].acceptedEvidence = []; }, 'that is a reported claim, not a confirmation'],
    ['a summary count that contradicts the rows', plan => { plan.summary.confirmed += 3; }, 'and the rows give'],
    ['ready declared over a missing blocker', plan => { plan.prerequisites[0].status = 'missing'; plan.overallStatus = 'ready'; }, 'the rows derive blocked'],
    ['a blocker missing from the blockers list', plan => { plan.prerequisites[0].status = 'missing'; plan.prerequisites[0].acceptedEvidence = []; }, 'the blockers list does not name it'],
    ['a target variant the path does not offer', plan => { plan.selectedPath.targetVariant = 'SQL Server in a container'; }, 'which it does not offer'],
    ['a refusal carrying a plan field', plan => { plan.overallStatus = 'unresolved_path'; }, 'a refusal is not a plan with fields missing']
  ];
  for (const [label, mutate, expected] of mutations) {
    const plan = clone();
    mutate(plan);
    const problems = validate(plan);
    check(`plan-validator-rejects-${label.replace(/\s+/gu, '-')}`,
      problems.some(problem => problem.includes(expected)),
      `${label} was accepted, or rejected for the wrong reason: ${problems.join('; ') || 'no problem reported'}`);
  }
}

// Sixth review pass. knownFacts carried one open union: the readiness enum, any non-empty string,
// any number, any integer, a boolean and any object. So `tde_status: true`, `database_count: -5`
// and `mi_link_ports_status: "BANANA"` all validated, and a value that validates is a typed fact
// that can confirm a prerequisite. The vocabulary each question accepts was in questions.json the
// whole time; nothing connected the two. This derives the shape again and compares, so the schema
// cannot drift away from the questions it is supposed to be typing.
{
  const SCREAMING = /^[A-Z][A-Z0-9_]*$/u;
  const expectedShape = question => {
    if (question.allowedValues) return { enum: [...question.allowedValues] };
    const effectKeys = Object.keys(question.effects || {});
    // An effect key in SCREAMING_SNAKE_CASE is an answer the user gives; a lowercase one is the
    // verdict the answer produces. Only the first kind is a vocabulary, which is why
    // azure_migrate_discovery_mode types as its allowedValues and source_edition does not type as
    // supported/unsupported/unknown.
    if (effectKeys.length && effectKeys.every(key => SCREAMING.test(key))) return { enum: effectKeys };
    if (question.answerType === 'positive_integer') return { type: 'integer', minimum: 1 };
    if (question.answerType === 'non_negative_number') return { type: 'number', minimum: 0 };
    return { type: 'string', minLength: 1, pattern: '\\S' };
  };
  const knownFacts = inputSchema.$defs?.knownFacts
    || inputSchema.properties?.knownFacts
    || Object.values(inputSchema.$defs || {}).map(entry => entry?.properties?.knownFacts).find(Boolean);
  check('known-facts-is-closed', knownFacts?.additionalProperties === false,
    'knownFacts accepts properties it does not declare, so an unrecognised field can still carry a fact');
  const declared = knownFacts?.properties || {};
  check('known-facts-covers-every-question', Object.keys(declared).length === questions.questions.length,
    `knownFacts declares ${Object.keys(declared).length} field(s) for ${questions.questions.length} question(s)`);
  for (const question of questions.questions) {
    const expected = expectedShape(question);
    const actual = declared[question.id];
    check(`known-facts-typed-${question.id}`, actual && JSON.stringify(actual) === JSON.stringify(expected),
      `knownFacts types ${question.id} as ${JSON.stringify(actual)} where questions.json says ${JSON.stringify(expected)}`);
    if (!expected.enum) continue;
    // Absence means the question was never asked. Without an explicit unknown value, "asked and
    // not answered" has no representation and collapses into absence, which reads as an answer.
    check(`known-facts-unknown-expressible-${question.id}`, expected.enum.includes('UNKNOWN'),
      `${question.id} is enumerated and offers no UNKNOWN value, so an unanswered question cannot be told apart from one never asked`);
  }
  for (const field of Object.keys(declared)) {
    check(`known-facts-field-is-a-question-${field}`, definedQuestionIds.has(field),
      `knownFacts declares ${field}, which questions.json does not define`);
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

const knownFactNames = Object.keys(inputSchema.properties.knownFacts.properties);
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
// The expected vocabulary used to be hard-coded here, so the gate could only ever confirm that the
// schema still said what this file said in the past. It now reads the row the output contract
// publishes, which is the document a reader is pointed at, so adding a status means changing the
// contract rather than changing the test.
const contractStatuses = (outputContract.match(/\|\s*Individual prerequisite\s*\|([^|]+)\|/) || [, ''])[1]
  .split('·').map((s) => s.replace(/`/g, '').trim()).filter(Boolean);
check('output-schema-statuses-declared', contractStatuses.length >= 4, 'the output contract no longer publishes a prerequisite status row to check against');
check('output-schema-statuses',
  JSON.stringify(outputSchema.properties.prerequisites.items.properties.status.enum) === JSON.stringify(contractStatuses),
  `output prerequisite status vocabulary drifted: schema has ${JSON.stringify(outputSchema.properties.prerequisites.items.properties.status.enum)}, output-contract.md publishes ${JSON.stringify(contractStatuses)}`);

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

// The interview must be able to ask, and it must be able to read what it ships: Agent Skills load
// SKILL.md alone, so a policy under references/ that nothing can open is a policy the model
// reconstructs from memory. Both halves are checked, and the exact-match anchor is gone because it
// made "ask_user and nothing else" the passing condition.
check('skill-ask-user', /^allowed-tools:.*\bask_user\b/mu.test(skill), 'the guided interview must declare ask_user');
check('skill-can-read-its-policy', /^allowed-tools:.*\b(view|read|grep|glob)\b/mu.test(skill),
  'the skill bundles contracts, schemas and a knowledge base, so it must declare a tool that can open them');
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
