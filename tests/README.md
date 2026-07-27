# Regression tests

This suite gives the prompt-only skill a deterministic gate.

## Layers

1. **Executable mirror** (`engine/evaluate.mjs`) — a small dependency-free Node ESM implementation of the rules in `reference/decision-rules.md`. It makes golden scenarios genuinely executable, but it is **not** the production engine; in production Copilot reads the markdown skill and reference rules.
2. **Golden scenarios** (`golden-scenarios.json`) — realistic input profiles and machine-comparable expected target/method/tier/status outcomes. Each scenario also names rule anchors that must exist in `reference/decision-rules.md`.
3. **Deterministic checks** (`run-tests.mjs`) — dependency-free Node checks for forbidden regressions, KB/rules/README version consistency, rule presence, branch reachability from `SKILL.md`, unknown-input handling, and retired-tool replacements.
4. **Optional LLM eval** — manual replay against actual Copilot models. This is intentionally not in CI: Layers 1–3 verify the executable rule mirror and repository consistency, not runtime LLM behaviour.

## Drift risk

The executable mirror and the markdown can drift. The suite mitigates that by keeping `assertRulePresent` checks for every scenario: each executable expectation must remain tied to concrete wording in `reference/decision-rules.md`. When the markdown changes, update the mirror and the scenario anchors together.

## Run

```powershell
node --check tests\run-tests.mjs
node --check tests\engine\evaluate.mjs
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
