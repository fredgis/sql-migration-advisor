# Regression tests

This suite gives the prompt-only skill a deterministic gate.

## Layers

1. **Executable mirror** (`engine/evaluate.mjs`) — a small dependency-free Node ESM implementation of the rules in `reference/decision-rules.md`. It imports machine-checkable constants and gates from `reference/decision-rules.data.json`. It makes golden scenarios genuinely executable, but it is **not** the production engine; in production Copilot reads the markdown skill and reference rules.
2. **Golden scenarios** (`golden-scenarios.json`) — realistic input profiles and machine-comparable expected target/method/tier/status outcomes. Each scenario also names rule anchors that must exist in `reference/decision-rules.md`.
3. **Deterministic checks** (`run-tests.mjs`) — dependency-free Node checks for forbidden regressions, canonical data / markdown consistency, KB/rules/README version consistency, rule presence, branch reachability from `SKILL.md`, unknown-input handling, and retired-tool replacements.
4. **Rules data checker** (`tools/rules/check-rules-data.mjs`) — verifies that every machine-checkable constant in `reference/decision-rules.data.json` is still stated in `reference/decision-rules.md`, failing on hard mismatches and warning when prose cannot be located reliably.
5. **Optional LLM eval** — manual replay against actual Copilot models. This is intentionally not in CI: Layers 1–4 verify the executable rule mirror and repository consistency, not runtime LLM behaviour.

## Drift risk

Machine-checkable constants are now single-sourced in `reference/decision-rules.data.json`: the executable mirror imports them, and CI checks them against `reference/decision-rules.md`. Drift on values such as ports, source-version floors, capacities, batch limits, method availability, and retired tooling is therefore structurally prevented in JavaScript and detected against the markdown.

Rule **logic** still exists twice: markdown prose for the LLM and JavaScript branches for deterministic tests. `assertRulePresent` proves textual presence, not semantic equivalence. The intended end state is a canonical structured source that also generates the prose and tables in `decision-rules.md` / `SKILL.md`, making both value and logic drift structurally impossible.

## Run

```powershell
node --check tests\run-tests.mjs
node --check tests\engine\evaluate.mjs
node --check tools\rules\check-rules-data.mjs
node tools\rules\check-rules-data.mjs
node tests\run-tests.mjs
node tests\run-tests.mjs --json
```

## Optional multi-model LLM evaluation

For each model and each scenario, start a fresh Copilot session with the skill available. Paste this prompt, replacing the JSON block with one scenario from `golden-scenarios.json`:

```text
You are evaluating sql-migration-advisor. Use SKILL.md and reference/decision-rules.md only.
Replay this scenario exactly. Ask no follow-up questions; treat missing fields as unknown.
Return only JSON with: primary_target, method, recommendationStatus, eligibility, mustNotRecommendObserved, rationaleRuleCitations.

SCENARIO:
<scenario JSON>

EXPECTED:
<scenario.expect JSON>

Compare your output to EXPECTED and set pass=true only if target, method class, status, eligibility, and must-not-recommend constraints match.
```

Repeat across the selected Copilot models, record pass/fail per scenario/model, and investigate any mismatch by checking whether the model ignored a rule or the golden expectation is stale.
