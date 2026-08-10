# NEWDESIGN v2.0.0 — refactor plan

> **Status: implemented, released as `v2.0.0`.** Baseline at approval: `v1.18.0`, commit `fbd72f6`, 18 gates, 90 golden scenarios.
> Delivered: **21 gates**, 90 golden scenarios. Progress is tracked in §10; departures from the plan are recorded in §11 with the reason.

---

## 1. Why a v2

An external audit made one central charge: *the repository optimised what is easy to test rather than what makes the decision*.

Reproducing its counter-examples confirmed almost all of them. Waves 0 to 2, shipped in `v1.18.0`, dealt with the urgent findings: a factual error the repository was defending with its own gate, an input contract whose displayed labels reached no rule, gates that accepted the unverified, and a `validated` status resting on four self-declared booleans.

What remains is the structural defect those fixes do not address:

> **The tests exercise a mirror of the rules. They never exercise the agent that reads them in a session.**

v2 attacks that. It does not make the skill deterministic — that was option A, and it was rejected. It reduces what the model has to interpret, makes the model check its own output, and **measures** what it actually does.

### What does not change

| Item | Decision |
|---|---|
| **The knowledge base** | 🔒 **Untouched.** No fact, rule, floor, source or verification date. The partner sections stay. Only the version stamp and possibly one path reference move |
| **The weekly check** | 🔒 **Kept**, all four jobs. See §6: it needs work to survive |
| **The 19 interview questions** | None removed. Two enriched, the option catalogue moves out |
| **The output card** | Same structure, same emoji rows. Two discreet additions |
| **Option A** | Rejected: no executable engine in production |

---

## 2. The interview questions

**Nothing is removed.** Two questions gain an option, for concrete reasons:

| Question | Change | Why |
|---|---|---|
| **Q8** size | ➕ `> 128 TB` | Today there is no way to express a database above the Hyperscale ceiling, so the rule that handles it can never fire |
| **Q10** network | ➕ `ports confirmed open in both directions` | A user can declare "blocked" but not "confirmed open". MI Link can therefore never be *confirmed*, only un-refuted |
| All 19 | The option catalogue **moves** to `reference/input-contract.md` | `SKILL.md` orchestrates; it no longer stores the vocabulary |
| ➕ new | **Compact profile mode** before the interview | The audit counts 20 to 26 turns. Let the user paste a profile and ask only for what is missing |

---

## 3. The output

The card keeps its structure. Two additions:

```
Phase A eligibility
• SQL MI — eligible_with_remediation: SQL Server 2016 is LRS-compatible…   ← already there
                                                           [MI-LINK-HOST]  ← added
• SQL DB — unknown_requires_assessment: dependencies not confirmed          ← already there

🔁 Method gate — LRS: passed (source 2016 within 2008-2022, window ≤30 days) ← added
```

**The self-check is invisible when it passes.** It runs before the card is rendered: the primary target is eligible, the method passes its own gate, hard-gate unknowns are surfaced, an `unsupported` target is never primary. It only becomes visible when an invariant breaks, and then it exposes the inconsistency instead of quietly repairing it.

The detailed trace stays **on request**. The readable card remains the default.

---

## 4. The six lots

### Lot A — Self-check and trace 🔴 *the only one that acts during a session*

| # | Task | Files | Difficulty |
|---|---|---|---|
| A1 | Write the output consistency invariants | `decision-rules.md` | 🟠 |
| A2 | Make the self-check mandatory before rendering | `SKILL.md` §Operations | 🟠 |
| A3 | Visible trace: Phase A table, rule ID, method-gate result | `SKILL.md` §Output | 🟠 |
| A4 | Gate: every scenario produces a coherent trace | `run-tests.mjs` | 🟠 |
| A5 | Update the worked example | `examples/` | 🟢 |

### Lot B — Contracts

| # | Task | Files | Difficulty |
|---|---|---|---|
| B1 | `reference/input-contract.md`: 30 IDs, ~35 fields, types, consumers, unknown behaviour | new | 🔴 |
| B2 | `reference/output-contract.md` | new | 🟠 |
| B3 | Slim `SKILL.md`: the catalogue leaves, the links stay | `SKILL.md` | 🟠 |
| B4 | Q8 and Q10 enriched, compact profile mode | `SKILL.md` | 🟢 |
| B5 | Gate: every field has a question, a type, a consumer and a scenario | `run-tests.mjs` | 🔴 |

### Lot C — Atomic rules

| # | Task | Files | Difficulty |
|---|---|---|---|
| C1 | Rewrite the hard gates in atomic form: ID, consumed fields, unknown behaviour, evidence, source | `decision-rules.md` | 🔴 |
| C2 | The 10-step ordered ranking, replacing "compare cost, compatibility, resilience" | `decision-rules.md` | 🟠 |
| C3 | Gate: every rule declares its fields, every field exists in the contract | `run-tests.mjs` | 🟠 |
| C4 | 🔴 **Adapt the weekly check to the new format** | `check-consistency.mjs` | 🔴 |

### Lot D — Rename and move

| # | Task | Scope | Difficulty |
|---|---|---|---|
| D1 | `git mv SKILL.md skills/get-migration-assessment/SKILL.md` | history preserved | 🟢 |
| D2 | `name: get-migration-assessment` | frontmatter | 🟢 |
| D3 | **Path** references | ~8 of the 20 files | 🟠 |
| D4 | 🔴 **`check-consistency.mjs` reads `SKILL.md` at the repository root** | weekly check | 🟠 |
| D5 | Reinstall locally, remove the old folder | `~/.copilot/skills/` | 🟢 |
| D6 | Teams message to Travis and Jyotika | — | 🟢 |

### Lot E — Documentation, v2.0.0 alignment

| # | File | Size | Difficulty |
|---|---|---|---|
| E1 | 🔴 **`README.md` — full review** | 289 lines | 🔴 |
| E2 | `howto/how-the-skill-works.md` | 377 lines | 🟠 |
| E3 | `blume/docs/index.mdx` | 221 lines | 🟠 |
| E4 | `docs/…developer-pitch.md` | 789 lines | 🔴 |
| E5 | `CONTRIBUTING.md`, `tests/README.md` | 69 + 40 lines | 🟢 |
| E6 | Diagrams `runtime-loop`, `skill-architecture`, `quality-gate` | 3 × 4 files | 🟠 |

#### E1 — what the README review must cover

| Section | State in v1.18 | v2.0.0 target |
|---|---|---|
| Badges | KB v1.18 | v2.0.0, 18 → N gates, 90 → N scenarios |
| Opening pitch | "regression-tested" | Position v2: readable policy, self-checked, measured |
| Why it is trustworthy | 5 bullets | Add the self-check, the trace, the runtime measurement |
| Audit response | 5 rows, 2025 audit | ➕ the new audit and what it produced |
| What's inside | file table | ➕ `input-contract`, `output-contract`, `evals/`, new skill path |
| Install | `~/.copilot/skills/assessment-advisor` | ⚠️ new name **and** the full repository is now required, not `SKILL.md` alone |
| How it works | 3 steps | ➕ the self-check phase |
| Confidence callout | 3 levels | ⚠️ `high` no longer exists; rewrite |
| Coverage callout | 92.02% branches | ➕ separate mirror coverage from runtime measurement |
| Poster / PDF | v1.18 | rebuilt by CI |
| Changelog | v1.18 on top | ➕ the v2.0.0 row |

**Watch out:** installation changes in nature. Today the repository is cloned into `~/.copilot/skills/assessment-advisor`. With the new layout the skill references `../../reference/…`, so installing `SKILL.md` alone will no longer work. The README has to say so plainly.

### Lot F — B2, the runtime eval

| # | Task | Difficulty |
|---|---|---|
| F1 | 8 to 12 customer cards, including "I don't know" answers | 🟠 |
| F2 | Advisor ⟷ simulated-customer loop, 15 to 25 turns | 🔴 |
| F3 | Comparator: policy conformance, cross-model stability, self-consistency | 🔴 |
| F4 | Metamorphic invariants: label = ID, FR = EN, monotonicity | 🟠 |
| F5 | First measurement published, **no threshold** | 🟢 |

---

## 5. Sequence and parallelisation

```
D  pure move                    ← mechanical commit on its own, reviewable diff
        ↓
B + A  one pass                 ← both edit SKILL.md
        ↓
C  atomic rules  ──────────┐
        ↓                   │
E1 E2 E3 E4 E5 E6           │    ← ✅ genuinely parallel, disjoint files
        ↓                   │
      gates ←───────────────┘    ← C4 and D4 must pass here
        ↓
   release v2.0.0
        ↓
        F                        ← measures, validates the whole
```

**Parallelisable:** lot E only. Six disjoint files, concurrent sub-agents, an estimated 40% saving on that lot.

**Not parallelisable, and worth saying rather than promising speed:** A and B both edit `SKILL.md`, so running them concurrently would produce conflicts; they are merged into one pass. C depends on B by construction. Gates run in sequence.

| Step | Content | Commits |
|---|---|---|
| 1 | D — move, rename, zero content change | 1 |
| 2 | B + A — contracts and self-check | 1 |
| 3 | C — atomic rules **and the weekly-check adaptation** | 1 |
| 4 | E — documentation, 6 sub-agents | 1 |
| 5 | Gates, artifacts, Blume, **release v2.0.0** | artifacts PR |
| 6 | F — B2, first measurement | 1 |

---

## 6. 🔴 Weekly-check impact

**The weekly check is kept. Lot C threatens it, and the fix has to travel in the same lot.**

### What the weekly check reads

| Script | Reads | v2 impact |
|---|---|---|
| `check-consistency.mjs` | KB, `decision-rules.md`, **`SKILL.md`**, README | 🔴 **breaks twice** |
| `decide.mjs` | KB, `decision-rules.md` | 🟡 substantive diff, re-verify |
| `apply-update.mjs` | KB, `decision-rules.md`, README | 🟡 version stamp |
| `verify-claims.mjs` | `claims-registry.json` | 🟢 none |
| `classify-links.mjs`, `gather-news.mjs`, `ai-review.mjs`, `build-prompt.mjs` | — | 🟢 none |

### Break 1 — the `SKILL.md` move

`check-consistency.mjs` opens `SKILL.md` at the repository root. After `git mv` the file is not there: the script throws and **job 1 fails**, which blocks the three that follow.

**Fix:** one line, the new path. It must ship **in the same commit as D**, otherwise the weekly check is broken between two commits.

### Break 2 — atomic rules, the serious one

`extractGate` works like this:

```js
const candidates = text.split(/\r?\n/)
  .filter(line => terms.every(term => line.toLowerCase().includes(term)));
```

**It looks for a single line containing every search term.** This is the parser that misread the Arc MI Link floor earlier: it takes the first line containing both "arc" and "mi link", and reordering the `SKILL.md` sections made it read 2017 instead of 2016.

Today a rule fits on one table row:

```
| Near-zero / online | **MI Link** | SQL Server 2016+, Enterprise…, Windows Server 2012 or later… |
```

In atomic form it spreads out:

```
### MI-LINK-HOST — Host OS and edition
**Consumes:** source.os, source.osVersion, source.edition
**Unsupported when**
- Windows Server below 2012
```

**The terms are no longer on one line, so `extractGate` finds nothing.** It falls back to `extractWithPatterns(text)`, which scans the whole document and may return the wrong value, or none.

The consequence is `compareAcrossDocs` reporting *"could not find gate in KB, decision-rules, or SKILL"* every week until nobody reads the issue any more. **A check people ignore is worse than no check.**

### Proposed fix — C4

| Option | Principle | Cost | Robustness |
|---|---|---|---|
| **C4-a** | Parse **by rule block**: split on `### RULE-ID`, search the terms within the block | 🟠 medium | 🟢 good, a block is a semantic unit |
| C4-b | Read the values from `decision-rules.data.json` instead of the markdown | 🟢 low | 🔴 removes the check: the data/prose gap is exactly what it exists to catch |

**C4-a is the recommendation.** C4-b would turn the check into a tautology.

**Side benefit:** the atomic format makes parsing *more* reliable than today. A `### RULE-ID` block is an explicit boundary, whereas line-proximity parsing is an accident that has already produced one bug.

### Required verification before release

- [x] `check-consistency.mjs` reads the new `SKILL.md` path — fixed in the same commit as the move (`4f26c41`)
- [x] The four Arc gates, MI Link ports, MI Link capacity and the Arc batch limit are still extracted
- [x] **Sabotage test:** introduce a deliberate divergence and confirm the weekly check sees it
- [ ] Manual dispatch: all four jobs green — after the release tag
- [x] `decide.mjs` still detects a substantive diff
- [x] `apply-update.mjs` still writes the version stamp

**Break 2 did not happen, because the atomic rewrite was not carried out as specified.** See §11.

---

## 7. Out of scope

| Topic | Why it is excluded |
|---|---|
| **Knowledge-base restructuring** (audit WP4) | 531 lines, 83 URLs, 187 constants and 4 gates depend on it. Mixed into this work the review becomes impossible and the risk of breaking a sourced fact is real. It needs its own change and its own review |
| **Option A**, executable engine | Rejected. It also depends on something outside our control: the destination repository would have to accept a skill that executes code |
| **Divergence threshold** | Measure over two or three releases first, then set an informed value rather than an arbitrary one |

---

## 8. What v2 will not fix

Stated plainly, because v1 went wrong by promising more than it could show:

- **B2 measures agreement, not correctness.** If the policy is wrong, 100% conformance means everyone agrees on the same error. The Windows Server 2012 floor would have scored 100% for five versions.
- **It is sampling.** Eight to twelve profiles against an enormous input space.
- **61 of 142 constants remain unread by the mirror.** Lot C recovers some, not all.
- **The skill stays a scoping assistant.** No lot turns it into an architecture authority, and that is deliberate.

---

## 9. Decisions taken

| Item | Decision |
|---|---|
| Name | `get-migration-assessment` |
| Option | **B** — readable, measured policy; no executable engine |
| Threshold | Measure first, set later |
| Knowledge base | Untouched |
| Weekly check | Kept, adapted in lot C |
| README | Full review for the v2.0.0 alignment |

## 10. Delivery status

Every lot below is complete unless marked otherwise. Commits are on `main`.

### Lot D — rename and move · `4f26c41`

- [x] D1 `git mv` to `skills/get-migration-assessment/SKILL.md`, rename detected, history preserved
- [x] D2 frontmatter `name: get-migration-assessment`
- [x] D3 13 path references across 6 files
- [x] D4 `check-consistency.mjs` path fix, deliberately in the same commit
- [x] D5 reinstalled locally, old `assessment-advisor` folder removed
- [ ] D6 Teams message to Travis and Jyotika — for the repository owner to send

### Lot B — contracts and self-check · `6833537`

- [x] B1 `reference/input-contract.md`: 30 option IDs, 20 canonical fields, `NONE_CONFIRMED` / `UNKNOWN` / `NOT_APPLICABLE`
- [x] B2 `reference/output-contract.md`: status vocabulary, structure, 9 self-check invariants
- [x] B3 `SKILL.md` defers to both contracts rather than restating them
- [x] B4 the self-check runs as step 8 of Operations, and exposes a failure instead of repairing it
- [x] B5 gate `contracts-wired`, proved by sabotage
- [x] Q8 gains `> 128 TB`; Q10 gains the both-directions port confirmation

### Lot C — rules · `c7cfa06`

- [x] C2 the 10-step ordered ranking replaces the unweighted criteria table
- [x] C3 gate `rule-index-consistent`: every rule consumes only documented fields, every rule declares an unknown behaviour, no rule treats an unknown as a pass
- [x] C1 **delivered as a rule index rather than an atomic rewrite** — see §11
- [x] C4 **not required**, because the one-line gate rows the weekly check parses were left in place

### Lot E — documentation · `9ec2802`

- [x] E1 `README.md` full v2.0.0 review: install section rewritten, contracts and self-check added, gate count, confidence callout, changelog row
- [x] E2 `howto/how-the-skill-works.md`
- [x] E3 `blume/docs/index.mdx` — builds clean
- [x] E5 `CONTRIBUTING.md`, `tests/README.md`
- [ ] E4 `docs/…developer-pitch.md`, 789 lines — **deferred**, see §11
- [ ] E6 the three diagram triples — deferred with E4

### Unplanned, and necessary

- [x] Gate `confidence-vocabulary`, the twenty-first — see §11
- [x] `.claude-plugin/plugin.json`: the repository installs with `copilot plugin install`
- [x] Six mixed path references in `SKILL.md` corrected, which is what made the installed copy work

### Lot F — B2 runtime eval

- [ ] Not started. It is the last lot by design: it measures, it does not improve. Tracked separately.

---

## 11. Departures from the plan, and why

**C1, atomic rules — not done as written.** The plan called for rewriting each hard gate as a block with a heading, a consumed-fields list and an unsupported-when list. §6 explains why that breaks `extractGate`, and the fix C4-a was to parse by `### RULE-ID` block. Doing both would have meant rewriting the rules and the parser that guards them in one change, with no independent check left standing while the work was in flight.

What shipped instead is a rule index: 26 entries naming each gate, the fields it consumes and its behaviour on an unknown, appended to `decision-rules.md` while the one-line gate rows stay exactly where the weekly check reads them. That delivers what the atomic format was for — addressability, declared inputs, explicit unknown handling — at a fraction of the risk. The full prose restructure and C4-a remain available if the format ever proves limiting; they are not needed to make a rule addressable, which was the goal.

**A twenty-first gate that was not in the plan.** Aligning the documentation turned up `confidence: high|medium|low` and `recommendationStatus: provisional|validated` still published in `decision-rules.md`, an explanation of what *High* meant in `SKILL.md`, and two golden scenarios asserting the old wording. v1.18 had announced both values removed three versions earlier. Nothing was watching the vocabulary, so the suite was protecting the words it was supposed to have deleted. `confidence-vocabulary` now reads the four policy documents line by line and fails on the recommendation vocabulary while leaving ordinary English such as *high IOPS* alone. It is proved by sabotage.

This is the audit's own charge appearing inside the response to it: a claim was announced, tested nowhere, and quietly stopped being true.

**Installation was broken by the move, and only testing it revealed that.** `SKILL.md` mixed `reference/…` and `../../reference/…`. The installed copy placed `reference/` beside `SKILL.md`, so `../../reference/` pointed outside the skill folder and neither contract was reachable. The layout `skills/<name>/SKILL.md` beside a root `reference/` is the Copilot CLI plugin convention, so the repository now ships `.claude-plugin/plugin.json`, and `copilot skill list --plugin-dir .` was used to confirm the skill is discovered rather than assumed to be.

**E4 and E6 deferred.** The developer pitch is 789 lines describing a runtime that v2 changed underneath it; a careful rewrite is a piece of work in its own right, and a half-corrected 789-line document is worse than one clearly marked as trailing. The diagrams depend on it.

---

## 12. Open

- [x] Approve the six-step sequence
- [x] Decide whether the developer pitch is deferred until after v2.0.0 — deferred
- [x] Go for step 1
- [ ] Release `v2.0.0`, then dispatch the weekly check and confirm four green jobs
- [ ] Lot F, when there is appetite to measure
