# Output contract — `generate-migration-prerequisite-plan`

> **Schema version:** `1.0`
> **Prerequisite knowledge-base line:** `v1.11`

The skill produces one normalized prerequisite-plan object. Markdown is the default rendering; JSON
is available on request. Both formats must represent exactly the same state.

## 1. Status vocabulary

| Scope | Allowed values |
| --- | --- |
| Individual prerequisite | `confirmed` · `reported` · `missing` · `unknown` · `not_applicable` |
| Overall plan | `ready` · `ready_with_conditions` · `blocked` · `unknown_requires_assessment` · `unresolved_path` |
| Requirement type | `required` · `conditional` · `recommended` |
| Evidence status | `reported` · `verified` |

Overall status is derived, in this order, and the first branch that matches wins:

- `blocked` when at least one applicable blocking prerequisite is `missing`;
- `unknown_requires_assessment` when no blocker is known missing but at least one applicable
  blocking prerequisite is `unknown`;
- `ready_with_conditions` when all blocking prerequisites are settled but at least one of them is
  `reported` rather than `confirmed`, **or** a required non-blocking prerequisite is missing,
  unknown or `reported`, **or** an applicable conditional prerequisite is missing, unknown or
  `reported`. **`reported` caps readiness here and can never reach `ready`**: the skill
  makes no network calls, so a stated fact is not a verified one, and a plan read as a go/no-go
  artefact must not present an assertion as clearance. The non-blocking case matters because most
  evidence-only rows are non-blocking: without it, a plan whose every blocker is confirmed and
  whose one required non-blocking row is `reported` matched no branch at all. The conditional case
  matters for the same reason and was missing for longer: a conditional row is an obligation once
  its condition holds, so a plan could reach `ready` with a known-unmet conditional row on it.
  Conditional rows whose condition does not hold are `not_applicable` and are ignored here, which
  is the whole difference between conditional and recommended;
- `ready` when every applicable required prerequisite is `confirmed` and every applicable
  conditional prerequisite is `confirmed` or `not_applicable`, meaning each one that still applies
  carries an evidence record.

Recommended items never block readiness.

## 2. JSON object

```text
metadata
  schemaVersion
  prerequisiteKnowledgeBaseVersion
  pathCatalogVersion
  evaluatedAt
  mode
  language
  sourceAdvisor                  present only in advisor_handoff mode
selectedMethodPath
  id, title, target, targetVariant, method, tier, supportStatus
appliedOverlays[]                one entry per overlay the route also requires
  id, title, role, why
selectedPath                     deprecated alias for selectedMethodPath, emitted for readers
                                 written against the single-path shape
overallStatus
summary
  confirmed, reported, missing, unknown, notApplicable, blockingMissing, blockingUnknown, blockingReported
prerequisites[]
  id
  area
  title
  requirementType
  applicability
  status
  blocking
  owner
  basis
  evidenceRequired
  acceptedEvidence[]
  officialSources[]
  lastVerified
blockers[]
unknowns[]
assumptions[]
inheritedAdvisorFacts[]
questionsAsked[]
nextActions[]
sourceRegister[]
evidenceRegister[]
```

Two registers, two jobs. `sourceRegister[]` holds the official citations the plan rests on
(`title`, `url`, `verifiedAt`). `evidenceRegister[]` holds the evidence records a row can accept, in
the shape the input contract carries them. An `acceptedEvidence` id names a record in
`evidenceRegister[]`, never a citation: a citation cannot be the artefact that settles a row.

Every prerequisite carries a stable ID from
[`docs/sql-server-to-azure-migration-prerequisite.md`](../../../docs/sql-server-to-azure-migration-prerequisite.md).

## 3. Basis rules

`basis` explains why a status was assigned:

- `typed_answer:<field>`
- `advisor_handoff:<field>`
- `verified_evidence:<evidence-id>`
- `known_missing:<field>`
- `applicability_false:<condition>`
- `not_assessed:<field>`

Free text cannot produce `typed_answer` or `verified_evidence`.

## 4. Self-check before rendering

| # | Invariant |
| --- | --- |
| 1 | The target/method resolves to exactly one of the 28 catalog paths as `selectedMethodPath`, or the output is `unresolved_path` and contains no invented prerequisite plan. **A route may additionally require overlays**, which appear in `appliedOverlays[]` and never replace the method path |
| 1b | **An AVS-hosted SQL Server carries both**: the method path that moves the data, and `P27` for the platform that hosts it. Emitting only one loses the other, which is what the single-path shape forced — `P27` alone describes a platform nobody migrates to, and the method path alone describes a generic SQL Server target rather than AVS. |
| 2 | Every prerequisite has a stable ID, applicability statement, requirement type, blocking flag, evidence requirement, official public source and `lastVerified` date. |
| 3 | `confirmed` rests on a typed fact drawn from the declared vocabulary, or on an inherited Advisor fact; free-text confidence language is never enough. This skill makes no network calls, so `confirmed` records a stated fact, not an independently verified one, and the plan must never present it as Azure-side verification. |
| 4 | Every unanswered or ambiguous hard-gate fact remains `unknown` and appears in `unknowns`. |
| 5 | A known unmet blocking prerequisite is `missing`, appears in `blockers`, and makes the overall plan `blocked`. |
| 6 | `not_applicable` is used only when the applicability condition is demonstrably false. |
| 7 | A fact inherited from the Advisor is not asked again; conflicts are exposed rather than silently resolved. |
| 8 | Every question asked is defined in `questions.json`, is consumed by an applicable prerequisite and has at least two distinct documented status effects. |
| 9 | Preview, third-party, composed-pattern and official-sample paths keep that support label in both output formats. |
| 10 | Smart Bulk Copy is described as an official Azure sample, not as a supported Azure migration service or product SLA. |
| 11 | The Markdown table and JSON arrays are renderings of the same object and have identical counts and statuses. |
| 12 | No output chooses a different target/method, provisions resources, executes migration, or claims architect approval. |
| 13 | Every blocking prerequisite is represented in the summary counts. |
| 14 | `P22` is present only after an explicit, informed user opt-in that names its archived, out-of-support status. When the tooling answer is unknown the output is `unresolved_path` carrying both candidates, never `P22` and never a silent fall back to `P20`. This used to allow resolving to `P20`, which handed the user a tool they never chose while three other documents said the answer was unresolved. |
| 15 | A refusal and a plan never mix: `unresolved_path` carries `unresolvedReason`, `candidatePaths` and `disambiguation` and no plan fields, while any other status carries the plan fields and none of the refusal fields. |
| 16 | An `advisor_handoff` run carries `inheritedAdvisorFacts` and `metadata.sourceAdvisor`; a handoff without either is a contract failure, not an empty list. |
| 17 | `selectedMethodPath.targetVariant` names which target family was selected. It is one of the method path's `targetVariants`, **or** of an applied overlay's, because an AVS-hosted SQL Server takes its data-movement method from a path that names the underlying platform and its target name from `P27`. When the variant comes from an overlay, that overlay is in `appliedOverlays[]`. Six method paths cover several families under one slash-separated target string, and their prerequisite rows are already conditioned per family, so a plan without this field applies the wrong publisher floors, connectivity requirements and role assignments while looking complete. |
| 18 | Every `prerequisites[].id` exists in the bundled prerequisite knowledge base, and every `officialSources` entry is one of the documented hosts. The ID pattern admits `P10-999` and a generic URI admits any public page, so a fabricated row with a plausible citation satisfied the shape while inventing a requirement. Membership is the check, not the shape. |
| 19 | A prerequisite that **no question in `questions.json` feeds** cannot be `confirmed` without a matching `acceptedEvidence` entry; a typed claim about it is `reported`. A prerequisite that a question **does** feed is settled by the typed answer, exactly as invariant 3 and the input contract say. The discriminator is the question mapping, not the `evidenceRequired` column: that column is required on all 291 rows, so keying on it made `confirmed` unreachable and `ready` impossible, which is a rule no plan could ever satisfy. 122 rows are fed by a question and 169 are evidence-only; of the 122, only **102** can reach `confirmed`, because 20 of those questions are applicability selectors whose effects name a path rather than a status. The gate derives all three counts rather than trusting this sentence. |
| 20 | `summary` is a reading of `prerequisites[]`, never a separate assertion about it, and `overallStatus` is the first branch of §1 that those same rows match. A count that disagrees with the rows, or a verdict that disagrees with the counts, is a contract failure rather than a rounding difference. The schema holds the blocking counts against the verdict; the row-level reading, which depends on `requirementType` and applicability, is derived by [`tools/validate-plan.mjs`](../../../tools/validate-plan.mjs). |
| 21 | A plan may not rewrite the knowledge base row it cites. `title`, `requirementType` and `blocking` come from the bundled knowledge base and are carried unchanged, and no id appears twice. Flipping `blocking` to `false` is the one that matters: it removes a prerequisite from every count and every blocker list while leaving the row visible and apparently answered. |
| 22 | Every `acceptedEvidence` entry names a record in the plan's own `evidenceRegister`, and no entry appears twice on a row. An evidence id pointing at nothing is not weaker evidence, it is none, and one record cited twice is one record. This invariant used to name `sourceRegister`, which types citations and cannot hold an evidence record, so a plan that followed this line produced output the schema then rejected. |

If an invariant fails, expose the invariant and stop before rendering a readiness verdict. Do not
repair the plan silently.

### Checking a plan

[`tools/validate-plan.mjs`](../../../tools/validate-plan.mjs) is the reference implementation of the
invariants a schema cannot express: it derives the counts and the status from the rows, checks every
id against the knowledge base, compares the carried row against its source, and resolves every
evidence id against the source register. Run it on any plan:

```text
node tools/validate-plan.mjs plan.json
```

This skill declares no execution tool, so it cannot run that file itself. The derivation above is
what binds the skill; the validator is what proves the derivation on every plan the repository
ships, and what a consumer can run on a plan they were handed.

## 5. Markdown rendering

Use the bundled [`../templates/prerequisite-plan.md`](../templates/prerequisite-plan.md). The detailed
table uses this column order:

| Area | Prerequisite | Status | Blocking | Owner | Evidence required | Official source |
| --- | --- | --- | --- | --- | --- | --- |

Status markers:

- `✅ confirmed`
- `🗣 reported`
- `❌ missing`
- `❓ unknown`
- `➖ not applicable`

The output must lead with the readiness verdict and the blocking count, then show the detailed
table, blocking actions, remaining unknowns, assumptions, and source register.

## 6. JSON/Markdown parity

JSON is authoritative for structure, not for conclusions. Markdown may abbreviate source titles and
evidence descriptions for readability, but it may not omit a blocking item, alter a status or add a
new assumption. When `requestedOutput = both`, build JSON first and render Markdown from it.

## 7. Data minimization

Use shareable placeholders. Do not echo server names, database names, usernames, tenant IDs,
subscription IDs, IP addresses, credentials, tokens, connection strings or private certificate
material. Evidence references should be hashes or sanitized document locations.
