# Output contract — `generate-migration-prerequisite-plan`

> **Schema version:** `1.0`
> **Prerequisite knowledge-base line:** `v1.6`

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
  unknown or `reported`. **`reported` caps readiness here and can never reach `ready`**: the skill
  makes no network calls, so a stated fact is not a verified one, and a plan read as a go/no-go
  artefact must not present an assertion as clearance. The non-blocking case matters because most
  evidence-only rows are non-blocking: without it, a plan whose every blocker is confirmed and
  whose one required non-blocking row is `reported` matched no branch at all;
- `ready` when every applicable required prerequisite is `confirmed`, meaning each one carries an
  evidence record.

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
```

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
| 19 | A prerequisite that **no question in `questions.json` feeds** cannot be `confirmed` without a matching `acceptedEvidence` entry; a typed claim about it is `reported`. A prerequisite that a question **does** feed is settled by the typed answer, exactly as invariant 3 and the input contract say. The discriminator is the question mapping, not the `evidenceRequired` column: that column is required on all 291 rows, so keying on it made `confirmed` unreachable and `ready` impossible, which is a rule no plan could ever satisfy. 122 rows are answerable and 169 are evidence-only, and the gate derives both counts rather than trusting this sentence. |

If an invariant fails, expose the invariant and stop before rendering a readiness verdict. Do not
repair the plan silently.

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
