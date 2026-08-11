# Regression tests

This suite is the only thing standing between the prompt-only skill and silent drift.

## Layers

1. **Executable mirror** (`engine/evaluate.mjs`) — a small dependency-free Node ESM implementation of the rules in `reference/decision-rules.md`. It imports machine-checkable constants and gates from `reference/decision-rules.data.json`. It makes golden scenarios genuinely executable, but it is **not** the production engine; in production Copilot reads the markdown skill and reference rules.
2. **Golden scenarios** (`golden-scenarios.json`) — realistic input profiles and machine-comparable expected target/method/tier/status outcomes. Each scenario also names rule anchors that must exist in `reference/decision-rules.md`. Their shape is described by `golden-scenarios.schema.json` and validated by `validate-scenarios.mjs`, because a mistyped key would otherwise leave a scenario in the file but out of the run: it would look covered and never be.
3. **Gates** (`run-tests.mjs`) — dependency-free Node checks for forbidden regressions, canonical data / markdown consistency, KB/rules/README version consistency, rule presence, branch reachability from `SKILL.md`, unknown-input handling, contract wiring, the rule index, the confidence vocabulary, and retired-tool replacements.
4. **Rules data checker** (`tools/rules/check-rules-data.mjs`) — verifies that every machine-checkable constant in `reference/decision-rules.data.json` is still stated in `reference/decision-rules.md`, failing on hard mismatches and warning when prose cannot be located reliably. It also enforces `kbGuardsMirroredInRules`: a guard the knowledge base states must exist as a rule, matched by a pattern anchored to the method row so the same string appearing elsewhere in the file does not satisfy it.
5. **Engine branch coverage** — the scenarios can all pass while a branch of the engine is never exercised, so CI measures branch coverage of `engine/` and fails below 85%. This is how a gate can exist and protect nothing.
6. **Optional LLM eval** — manual replay against actual Copilot models. This is intentionally not in CI: the layers above verify the executable rule mirror and repository consistency, not runtime LLM behaviour.

## Drift risk

Audited high-risk constants are now single-sourced in `reference/decision-rules.data.json`: the executable mirror imports them, and CI checks them against `reference/decision-rules.md`. Drift on values such as ports, source-version floors/ranges, capacities, batch limits, size thresholds, method availability, and retired tooling is therefore structurally prevented in JavaScript and detected against the markdown.

Rule **logic** still exists twice: markdown prose for the LLM and JavaScript branches in the mirror. `assertRulePresent` proves textual presence, not semantic equivalence. v2 narrowed the gap rather than closing it — the rule index names the fields each rule consumes, so a rule that reads an undeclared field now fails a gate. The intended end state is a canonical structured source that also generates the prose and tables in `decision-rules.md` and `SKILL.md`, making both value and logic drift structurally impossible.

## Run

```powershell
node --check tests\run-tests.mjs
node --check tests\engine\evaluate.mjs
node --check tools\rules\check-rules-data.mjs
node tools\rules\check-rules-data.mjs
node tools\rules\check-rules-data.mjs --strict
node tests\validate-scenarios.mjs
node tests\run-tests.mjs
node tests\run-tests.mjs --json
```

Branch coverage of the engine, as CI measures it:

```powershell
node --experimental-test-coverage --test-coverage-include='tests/engine/**' --test-coverage-branches=85 --test tests\run-tests.mjs
```

## Optional multi-model LLM evaluation

For each model and each scenario, start a fresh Copilot session with the skill available. Paste this prompt, replacing the JSON block with one scenario from `golden-scenarios.json`:

```text
You are evaluating sql-migration-advisor. Use skills/recommend-migration-path/SKILL.md, reference/input-contract.md, reference/decision-rules.md and reference/output-contract.md only.
Replay this scenario exactly. Ask no follow-up questions; treat missing fields as unknown.
Return only JSON with: primary_target, method, recommendationStatus, eligibility, mustNotRecommendObserved, rationaleRuleCitations.

SCENARIO:
<scenario JSON>

EXPECTED:
<scenario.expect JSON>

Compare your output to EXPECTED and set pass=true only if target, method class, status, eligibility, and must-not-recommend constraints match.
```

Repeat across the selected Copilot models, record pass/fail per scenario/model, and investigate any mismatch by checking whether the model ignored a rule or the golden expectation is stale.
