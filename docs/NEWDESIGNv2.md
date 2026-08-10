# NEWDESIGN v2.0.0 — refactor plan

> **Status: proposal, awaiting approval.** Nothing here is implemented.
> Current baseline: `v1.18.0`, commit `fbd72f6`, 18 gates, 90 golden scenarios.

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

- [ ] `check-consistency.mjs` reads the new `SKILL.md` path
- [ ] The four Arc gates, MI Link ports, MI Link capacity and the Arc batch limit are still extracted
- [ ] **Sabotage test:** introduce a deliberate divergence and confirm the weekly check sees it
- [ ] Manual dispatch: all four jobs green
- [ ] `decide.mjs` still detects a substantive diff
- [ ] `apply-update.mjs` still writes the version stamp

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

## 10. Open

- [ ] Approve the six-step sequence
- [ ] Decide whether the developer pitch (789 lines) is deferred until after v2.0.0
- [ ] Go for step 1
