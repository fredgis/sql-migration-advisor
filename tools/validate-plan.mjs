#!/usr/bin/env node
// Validates a prerequisite plan against the things the output schema cannot express.
//
// A JSON Schema types shapes. It cannot say that a count matches the rows it counts, that a
// prerequisite id exists in the knowledge base, that a row's title is still the one the knowledge
// base gives it, or that an accepted-evidence id names a record the plan actually carries. Every
// one of those was described in the output contract and enforced nowhere, so a plan could invent a
// prerequisite, flip a blocker to non-blocking, confirm a row with an evidence id naming nothing,
// and declare itself ready.
//
// Usage:  node tools/validate-plan.mjs <plan.json> [more.json ...]
// Exit 0 when every plan passes, 1 otherwise.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = (...parts) => path.join(root, ...parts);
const readJson = (...parts) => JSON.parse(fs.readFileSync(rel(...parts), 'utf8'));

const SKILL = ['skills', 'generate-migration-prerequisite-plan'];
const catalog = readJson(...SKILL, 'reference', 'path-catalog.json');
const coverage = readJson(...SKILL, 'reference', 'advisor-coverage.json');
const questionBank = readJson(...SKILL, 'reference', 'questions.json');
const kb = fs.readFileSync(rel('docs', 'sql-server-to-azure-migration-prerequisite.md'), 'utf8');

const questionsById = new Map((questionBank.questions || []).map(entry => [entry.id, entry]));

// A status is a claim about a row, and an answer is what the claim rests on. The validator read
// whether a question fed the row and never what the question returned, so `UNKNOWN` justified
// `confirmed`. These are the severities the effects tables produce, ordered by how much they stop:
// a row may be as severe as its answers require, never milder.
const STATUS_SEVERITY = { confirmed: 0, reported: 1, unknown: 2, missing: 3 };

// The knowledge base is the source for every row a plan may carry, and for what that row says.
// Reading it here rather than trusting the plan is the whole point: a plan that rewrites a row is
// a plan whose citations no longer lead anywhere.
const kbRows = new Map();
for (const line of kb.split(/\r?\n/)) {
  const cells = line.split('|').map(cell => cell.trim());
  if (cells.length < 6) continue;
  const id = cells[1];
  if (!/^(COM|P[0-9]{2})-[0-9]{3}$/.test(id)) continue;
  kbRows.set(id, { title: cells[2], requirementType: cells[3], blocking: /^yes$/i.test(cells[4]) });
}

const pathIds = new Set(catalog.paths.map(entry => entry.id));
const variantsById = new Map(catalog.paths.map(entry => [entry.id, new Set(entry.targetVariants || [entry.target])]));
const BLOCKING_TYPES = new Set(['required', 'conditional']);

// One plan has one path, under two names. `selectedPath` drove the owed rows and
// `selectedMethodPath` was checked for shape and then ignored, so a plan that kept the second and
// dropped the first had its path rows quietly removed from what it owed: omitting an optional alias
// deleted seven obligations without a word. Both names resolve here, and disagreeing is an error
// rather than a silent preference for whichever one the code happened to read.
function selectedPathOf(plan, say) {
  const named = plan.selectedPath;
  const alias = plan.selectedMethodPath;
  if (named && alias && named.id !== alias.id) {
    say(`selectedPath names ${named.id} and selectedMethodPath names ${alias.id}; one plan has one path, and the rows it owes cannot depend on which field a reader looks at`);
  }
  if (named && alias && named.targetVariant && alias.targetVariant && named.targetVariant !== alias.targetVariant) {
    say(`selectedPath names targetVariant "${named.targetVariant}" and selectedMethodPath names "${alias.targetVariant}"; the prerequisite rows are conditioned per family, so the two cannot differ`);
  }
  return named || alias || null;
}

function validate(plan) {
  const problems = [];
  const say = message => problems.push(message);
  const rows = plan.prerequisites || [];

  if (plan.overallStatus === 'unresolved_path') {
    for (const field of ['selectedPath', 'prerequisites', 'summary', 'blockers', 'nextActions', 'sourceRegister', 'unknowns', 'assumptions', 'selectedMethodPath', 'appliedOverlays']) {
      if (field in plan) say(`a refusal carries \`${field}\`; a refusal is not a plan with fields missing`);
    }
    return problems;
  }

  // Every row must be a row the knowledge base defines, once, and unchanged.
  const seen = new Set();
  for (const row of rows) {
    if (seen.has(row.id)) say(`${row.id} appears more than once; two rows with one id cannot both be the prerequisite`);
    seen.add(row.id);
    const source = kbRows.get(row.id);
    if (!source) { say(`${row.id} is not a prerequisite the knowledge base defines`); continue; }
    if (row.title !== source.title) say(`${row.id} is titled "${row.title}" here and "${source.title}" in the knowledge base`);
    if (row.requirementType !== source.requirementType) say(`${row.id} is ${row.requirementType} here and ${source.requirementType} in the knowledge base; a plan may not reclassify an obligation`);
    if (row.status !== 'not_applicable' && row.blocking !== source.blocking) {
      say(`${row.id} is marked ${row.blocking ? 'blocking' : 'non-blocking'} here and ${source.blocking ? 'blocking' : 'non-blocking'} in the knowledge base; flipping that bit is how a blocker stops counting`);
    }
  }

  // An evidence id has to name a record the plan carries, or the row is confirmed by nothing.
  const evidenceIds = new Set((plan.evidenceRegister || []).map(record => record.id).filter(Boolean));
  for (const row of rows) {
    const accepted = row.acceptedEvidence || [];
    if (new Set(accepted).size !== accepted.length) say(`${row.id} lists the same evidence id twice; one record cited twice is one record`);
    for (const id of accepted) {
      if (!evidenceIds.has(id)) say(`${row.id} accepts evidence \`${id}\`, which the plan's own evidence register does not contain`);
    }
    // Invariant 19: a row no question feeds cannot be confirmed on a bare assertion.
    const fedByQuestion = (plan.questionsAsked || []).some(question => (question.consumedBy || question.prerequisites || []).includes(row.id));
    if (row.status === 'confirmed' && !fedByQuestion && accepted.length === 0) {
      say(`${row.id} is confirmed with no question feeding it and no accepted evidence; that is a reported claim, not a confirmation`);
    }
  }

  // The counts are a reading of the rows, not a separate assertion about them.
  // But a reading of the wrong rows is still wrong: the validator checked what the plan carried and
  // never what it owed. A P10 plan reduced to one row, with the counts recalculated to match, came
  // back valid and `ready` — nineteen obligations replaced by one, and the arithmetic agreed.
  // The catalog knows which rows a path owes. It is asked now.
  const chosen = selectedPathOf(plan, say);
  const owed = new Set([
    ...[...kbRows.keys()].filter(id => id.startsWith('COM-')),
    ...(chosen ? [...kbRows.keys()].filter(id => id.startsWith(`${chosen.id}-`)) : [])
  ]);
  for (const id of owed) {
    if (!seen.has(id)) say(`${id} applies to this path and the plan does not carry it; a plan that drops an obligation reads as one that met it`);
  }

  // An answer settles a row, or it does not. The check above asks whether a question fed the row;
  // it never asked what the question returned, so an `UNKNOWN` answer could sit under `confirmed`.
  // questions.json already states the status each answer produces, per consumer where the rule
  // differs, and that table is the one the interview follows.
  const rowsById = new Map(rows.map(row => [row.id, row]));
  const worstByRow = new Map();
  for (const asked of plan.questionsAsked || []) {
    const question = questionsById.get(asked?.id);
    if (!question) { say(`questionsAsked names \`${asked?.id}\`, which questions.json does not define`); continue; }
    // The answer belongs to the question, not to whichever rows this path happens to carry. Scoping
    // this check to rows in the plan let a made-up answer pass whenever its rows were out of scope.
    const tables = [question.effects || {}, ...Object.values(question.effectsByConsumer || {})];
    if (!tables.some(table => asked.answer in table)) {
      say(`${asked.id} is answered \`${asked.answer}\`, which is not an answer that question defines`);
      continue;
    }
    for (const rowId of question.consumedBy || []) {
      const row = rowsById.get(rowId);
      if (!row || row.status === 'not_applicable') continue;
      const table = (question.effectsByConsumer || {})[rowId] || question.effects || {};
      const effect = table[asked.answer];
      if (!(effect in STATUS_SEVERITY)) continue;
      worstByRow.set(rowId, Math.max(worstByRow.get(rowId) ?? 0, STATUS_SEVERITY[effect]));
    }
  }
  for (const [rowId, required] of worstByRow) {
    const row = rowsById.get(rowId);
    const held = STATUS_SEVERITY[row.status];
    if (held === undefined || held < required) {
      const name = Object.keys(STATUS_SEVERITY).find(key => STATUS_SEVERITY[key] === required);
      say(`${rowId} is ${row.status} and the answers it rests on produce ${name}; a status milder than the answer under it is a claim the interview contradicts`);
    }
  }

  // `not_applicable` removes a row from every count and every blocker list. Invariant 6 has always
  // said it is used only when the applicability condition is demonstrably false, and nothing asked
  // which condition: marking all nineteen obligations not_applicable, with no reason anywhere,
  // still derived `ready`. The basis vocabulary already has the shape for it.
  for (const row of rows) {
    if (row.status !== 'not_applicable') continue;
    const basis = String(row.basis ?? '');
    const condition = basis.startsWith('applicability_false:') ? basis.slice('applicability_false:'.length).trim() : '';
    if (!condition) {
      say(`${row.id} is not_applicable and its basis names no false condition; an obligation dismissed without saying what makes it inapplicable is an obligation dropped`);
    }
  }
  const applicable = rows.filter(row => row.status !== 'not_applicable');
  const derived = {
    confirmed: rows.filter(row => row.status === 'confirmed').length,
    missing: rows.filter(row => row.status === 'missing').length,
    unknown: rows.filter(row => row.status === 'unknown').length,
    reported: rows.filter(row => row.status === 'reported').length,
    notApplicable: rows.filter(row => row.status === 'not_applicable').length,
    blockingMissing: applicable.filter(row => row.blocking && row.status === 'missing').length,
    blockingUnknown: applicable.filter(row => row.blocking && row.status === 'unknown').length,
    blockingReported: applicable.filter(row => row.blocking && row.status === 'reported').length
  };
  for (const [key, value] of Object.entries(derived)) {
    if ((plan.summary || {})[key] !== value) say(`summary.${key} says ${(plan.summary || {})[key]} and the rows give ${value}`);
  }

  // The status is the first branch of the contract that matches, applied to those same rows.
  const nonBlockingUnsettled = applicable.some(row => !row.blocking
    && BLOCKING_TYPES.has(row.requirementType)
    && ['missing', 'unknown', 'reported'].includes(row.status));
  let expected;
  if (derived.blockingMissing > 0) expected = 'blocked';
  else if (derived.blockingUnknown > 0) expected = 'unknown_requires_assessment';
  else if (derived.blockingReported > 0 || nonBlockingUnsettled) expected = 'ready_with_conditions';
  else expected = 'ready';
  if (plan.overallStatus !== expected) say(`overallStatus is ${plan.overallStatus} and the rows derive ${expected}`);

  // Every blocker the rows carry has to be named where a reader looks for it.
  const named = new Set((plan.blockers || []).map(entry => (typeof entry === 'string' ? entry : entry.id)));
  for (const row of applicable) {
    if (row.blocking && ['missing', 'unknown'].includes(row.status) && !named.has(row.id)) {
      say(`${row.id} is a ${row.status} blocker and the blockers list does not name it`);
    }
  }

  // A path and a variant the catalog does not offer cannot be the one that was selected.
  const selected = chosen;
  if (selected) {
    if (!pathIds.has(selected.id)) say(`selectedPath ${selected.id} is not a path the catalog defines`);
    else if (!variantsById.get(selected.id).has(selected.targetVariant)) {
      say(`selectedPath ${selected.id} names targetVariant "${selected.targetVariant}", which it does not offer`);
    }
  } else {
    say('the plan names no path in either `selectedPath` or `selectedMethodPath`; without one, nothing can say which rows it owes');
  }
  const overlayIds = new Set(coverage.dispositions.flatMap(cell => cell.paths || []));
  for (const overlay of plan.appliedOverlays || []) {
    if (!pathIds.has(overlay.id)) say(`applied overlay ${overlay.id} is not a path the catalog defines`);
    if (overlay.id && !overlayIds.has(overlay.id) && !pathIds.has(overlay.id)) say(`applied overlay ${overlay.id} is referenced by no coverage disposition`);
  }

  return problems;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error('usage: node tools/validate-plan.mjs <plan.json> [more.json ...]');
    process.exit(2);
  }
  let failed = 0;
  for (const file of files) {
    const plan = JSON.parse(fs.readFileSync(file, 'utf8'));
    const problems = validate(plan);
    if (problems.length) {
      failed++;
      console.error(`${path.basename(file)}: ${problems.length} problem(s)`);
      for (const problem of problems) console.error(`  - ${problem}`);
    } else {
      console.log(`${path.basename(file)}: valid`);
    }
  }
  process.exit(failed ? 1 : 0);
}

export { validate };
