# Output contract — `generate-migration-prerequisite-plan`

> **Schema version:** `1.0`
> **Prerequisite knowledge-base line:** `v1.3`

The skill produces one normalized prerequisite-plan object. Markdown is the default rendering; JSON
is available on request. Both formats must represent exactly the same state.

## 1. Status vocabulary

| Scope | Allowed values |
| --- | --- |
| Individual prerequisite | `confirmed` · `missing` · `unknown` · `not_applicable` |
| Overall plan | `ready` · `ready_with_conditions` · `blocked` · `unknown_requires_assessment` |
| Requirement type | `required` · `conditional` · `recommended` |
| Evidence status | `reported` · `verified` |

Overall status is derived:

- `blocked` when at least one applicable blocking prerequisite is `missing`;
- `unknown_requires_assessment` when no blocker is known missing but at least one applicable
  blocking prerequisite is `unknown`;
- `ready_with_conditions` when all blocking prerequisites are confirmed but a required
  non-blocking prerequisite is missing/unknown;
- `ready` when every applicable required prerequisite is confirmed.

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
selectedPath
  id, title, target, method, tier, supportStatus
overallStatus
summary
  confirmed, missing, unknown, notApplicable, blockingMissing, blockingUnknown
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
| 1 | The target/method resolves to exactly one of the 28 catalog paths, or the output is `unresolved_path` and contains no invented prerequisite plan. |
| 2 | Every prerequisite has a stable ID, applicability statement, requirement type, blocking flag, evidence requirement, official public source and `lastVerified` date. |
| 3 | `confirmed` rests on a typed fact or verified evidence; free-text confidence language is never enough. |
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
| 14 | `P22` is present only after an explicit, informed user opt-in that names its archived, out-of-support status; when the tooling answer is unknown the output resolves to `P20` (`bcp`) or returns the shortlist, never to `P22`. |
| 15 | A refusal and a plan never mix: `unresolved_path` carries `unresolvedReason`, `candidatePaths` and `disambiguation` and no plan fields, while any other status carries the plan fields and none of the refusal fields. |
| 16 | An `advisor_handoff` run carries `inheritedAdvisorFacts`; a handoff without it is a contract failure, not an empty list. |

If an invariant fails, expose the invariant and stop before rendering a readiness verdict. Do not
repair the plan silently.

## 5. Markdown rendering

Use the bundled [`templates/prerequisite-plan.md`](../templates/prerequisite-plan.md). The detailed
table uses this column order:

| Area | Prerequisite | Status | Blocking | Owner | Evidence required | Official source |
| --- | --- | --- | --- | --- | --- | --- |

Status markers:

- `✅ confirmed`
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
