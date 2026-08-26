# Contributing

Thanks for looking at this repository. It is small, but it has strong opinions about
correctness, so this page explains the three things a contributor actually needs to do.

## What this repository is

A GitHub Copilot skill that recommends a SQL Server to Azure migration target and method,
plus the machinery that keeps its content true:

| Path | Role |
| --- | --- |
| `skills/recommend-migration-path/SKILL.md` | the skill the agent runs |
| `skills/recommend-migration-path/schemas/` | the input and output contracts in machine-checkable form, shared with the prerequisite skill |
| `reference/input-contract.md` | what the interview may produce: option IDs, canonical fields, and the three answer states |
| `reference/output-contract.md` | what an answer must look like, and the invariants the skill checks against its own draft |
| `reference/decision-rules.md` | the decision policy the skill applies, and the index of every addressable rule |
| `reference/decision-rules.data.json` | the same constants in machine-readable form |
| `docs/sql-server-to-azure-migration.md` | the knowledge base the rules are distilled from |
| `reference/claims-registry.json` | high-risk claims tracked by source content hash |
| `tests/` | the executable mirror and 116 golden scenarios |

## Prerequisites

Node 24 or later. Nothing else for the tests.

The PDF and poster pipelines additionally need pandoc, texlive-xetex, poppler-utils and a
Chrome binary, but you only need those if you are changing `docs/` output or `tools/diagram/`.

## Running the checks

Run all four before opening a pull request. They are the same four CI runs.

```bash
node tests/run-tests.mjs                        # 35 gates over 116 scenarios
node tools/rules/check-rules-data.mjs --strict  # constants agree between JSON and markdown
node tools/weekly-check/check-consistency.mjs   # versions and freshness stamps agree
node tools/artifacts/check-artifacts.mjs        # derived artifacts are not stale
```

CI additionally measures branch coverage of the decision engine and fails below 85%, because
every scenario can pass while a branch is never exercised:

```bash
node --experimental-test-coverage --test-coverage-include='tests/engine/**' \
     --test-coverage-branches=85 --test tests/run-tests.mjs
```

`check-artifacts.mjs --fix-prose` repairs sentences that quote an artifact, such as the
README line giving the PDF page count and version.

## Adding a golden scenario

Scenarios live in `tests/golden-scenarios.json`. Each one is inputs plus the expected outcome.

1. Add an entry with a descriptive kebab-case `id`, the `inputs` the interview would collect,
   and the `expect` block: `eligibility`, `primary_target`, `method`, `tier`,
   `targetAvailabilityDuringSync`, `businessCutoverDowntime`, `recommendationStatus`,
   `confidence`, and `mustNotRecommend` where a wrong answer must be named explicitly.
   `tests/golden-scenarios.schema.json` describes the exact shape and is enforced in CI, so a
   mistyped key fails the build instead of quietly dropping your scenario from the run.
2. Add `assertRulePresent` entries quoting the sentence in `reference/decision-rules.md` that
   justifies the outcome. Prefer plain text over regular expressions: escaping mistakes are the
   most common way to make an anchor silently match nothing.
3. Run `node tests/run-tests.mjs`. If the engine disagrees with your expectation, decide which
   one is wrong. Changing the expectation to match a wrong engine is how bad guidance ships.
4. If the scenario covers a mistake that was actually made, also register it in
   `tests/required-scenarios.json` with a one-line reason, so it cannot be quietly deleted.

## Updating a claim

`reference/claims-registry.json` stores a content hash for the source section behind each
high-risk claim. When Microsoft edits a page, the weekly check reports drift.

1. Read the source and decide whether the fact we depend on actually changed.
2. If it did, correct the knowledge base **and** the decision rules. They drift apart easily:
   two findings came back a cycle later because only the knowledge base was updated. The
   `kbGuardsMirroredInRules` check in `check-rules-data.mjs` now catches that class of gap, and
   new guards should be registered there.
3. Rebaseline with `node tools/weekly-check/verify-claims.mjs --update-hashes`.
4. If the source moved, repoint `source_url` rather than rebaselining a page that no longer
   carries the claim.

## Version discipline

A version bump requires a substantive content change and green checks. A model verdict, a
broken link or claim drift alone never justifies one. When you do bump, the knowledge base,
the rules, `skills/recommend-migration-path/SKILL.md` and the README must all move together, and the artifacts must be
regenerated. `check-consistency.mjs` enforces the first part; `check-artifacts.mjs` the second.

## Pull requests

`main` requires a pull request. Keep changes to the knowledge base and the rules in the same
commit as the tests that cover them, so a reviewer can see the claim, its source and its proof
in one place.
