# Regression tests

This suite gives the prompt-only skill a deterministic gate.

## Layers

1. **Golden scenarios** (`golden-scenarios.json`) — realistic input profiles and expected target/method/status outcomes. Each scenario also names rule anchors that must exist in `reference/decision-rules.md`.
2. **Deterministic checks** (`run-tests.mjs`) — dependency-free Node checks for forbidden regressions, KB/rules/README version consistency, rule presence, branch reachability from `SKILL.md`, unknown-input handling, and retired-tool replacements.
3. **Optional LLM eval** — manual replay against actual Copilot models. This is intentionally not in CI: Layers 1–2 verify the engine rules and repository consistency, not runtime LLM behaviour.

## Run

```powershell
node tests/run-tests.mjs
node tests/run-tests.mjs --json
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
