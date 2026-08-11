# NEWDESIGN v2.0.0 — refactor plan

> **Status: implemented, released as `v2.0.0`.** Baseline at approval: `v1.18.0`, commit `fbd72f6`, 18 gates, 90 golden scenarios.
> Delivered: **21 gates**, 90 golden scenarios. Progress is tracked in §10; departures from the plan are recorded in §11 with the reason.
>
> **A second audit of `v2.0.0` has been received and verified. Its findings and plan are in §13; delivery status is §13.5. Released as `v2.1.0`.**
> **A third audit, of `v2.1.0`, asked for four coherence corrections and no new features. They are done — see §14.**

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
- [x] Manual dispatch: all four jobs green — dispatched after the tag: `consistency`, `evidence`, `review`, `decide` all green
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
- [x] E4 `docs/…developer-pitch.md` — a correction pass, not the rewrite it looked like: ~20 lines of 789 were false. §7 taught the removed `validated` promotion, four uses of "deterministic" including the strongest form of the claim, `18 gates`, the pre-move paths. §3 gains the contracts and §5 the ordered ranking, rule IDs and self-check
- [ ] E6 the three diagram triples — deferred, cosmetic; regenerate only if the pitch diagrams change materially

### Unplanned, and necessary

- [x] Gate `confidence-vocabulary`, the twenty-first — see §11
- [x] `.claude-plugin/plugin.json`: the repository installs as a Copilot CLI plugin
- [x] `.claude-plugin/marketplace.json`: the repository is its own marketplace, so the deprecated repo-install form is no longer the only route
- [x] Six mixed path references in `SKILL.md` corrected, which is what made the installed copy work
- [x] `ci(artifacts)`: the job rebuilt the poster and then failed verification on it, because `--fix-prose` rewrote `poster.html` after the PNG was rendered

### Lot F — B2 runtime eval

- [ ] Not started. It is the last lot by design: it measures, it does not improve. Tracked separately.

---

## 11. Departures from the plan, and why

**C1, atomic rules — not done as written.** The plan called for rewriting each hard gate as a block with a heading, a consumed-fields list and an unsupported-when list. §6 explains why that breaks `extractGate`, and the fix C4-a was to parse by `### RULE-ID` block. Doing both would have meant rewriting the rules and the parser that guards them in one change, with no independent check left standing while the work was in flight.

What shipped instead is a rule index: 26 entries naming each gate, the fields it consumes and its behaviour on an unknown, appended to `decision-rules.md` while the one-line gate rows stay exactly where the weekly check reads them. That delivers what the atomic format was for — addressability, declared inputs, explicit unknown handling — at a fraction of the risk. The full prose restructure and C4-a remain available if the format ever proves limiting; they are not needed to make a rule addressable, which was the goal.

**A twenty-first gate that was not in the plan.** Aligning the documentation turned up `confidence: high|medium|low` and `recommendationStatus: provisional|validated` still published in `decision-rules.md`, an explanation of what *High* meant in `SKILL.md`, and two golden scenarios asserting the old wording. v1.18 had announced both values removed three versions earlier. Nothing was watching the vocabulary, so the suite was protecting the words it was supposed to have deleted. `confidence-vocabulary` now reads the four policy documents line by line and fails on the recommendation vocabulary while leaving ordinary English such as *high IOPS* alone. It is proved by sabotage.

This is the audit's own charge appearing inside the response to it: a claim was announced, tested nowhere, and quietly stopped being true.

**Installation was broken by the move, and only testing it revealed that.** `SKILL.md` mixed `reference/…` and `../../reference/…`. The installed copy placed `reference/` beside `SKILL.md`, so `../../reference/` pointed outside the skill folder and neither contract was reachable. The layout `skills/<name>/SKILL.md` beside a root `reference/` is the Copilot CLI plugin convention, so the repository now ships `.claude-plugin/plugin.json`, and `copilot skill list --plugin-dir .` was used to confirm the skill is discovered rather than assumed to be.

**E4 was deferred, then done, and the deferral was the wrong call.** It was postponed on the assumption that 789 lines describing a runtime v2 had changed underneath it needed a rewrite. Measuring instead of assuming showed roughly twenty false lines. The worst taught the `validated` promotion v1.18 had removed, and four used "deterministic" — one in its strongest form, *same inputs, same versions, same result*, which is simply not true of a prompt-driven skill. A public document contradicting the release it documents was never worth the deferral.

**E6 remains open and is cosmetic.** The three diagram triples change only if the pitch diagrams change materially, which they did not.

---

## 12. Open

- [x] Approve the six-step sequence
- [x] Decide whether the developer pitch is deferred until after v2.0.0 — deferred
- [x] Go for step 1
- [x] Release `v2.0.0`, then dispatch the weekly check and confirm four green jobs — **4/4 green**
- [x] E4 developer pitch — done after the release; **E6 diagrams** remain, and are cosmetic
- [ ] Lot F, when there is appetite to measure

### Found by using v2.0.0, awaiting a decision

The first real session run on a non-standard profile — a single SQL Server 2016 on AWS EC2, SQL CLR, offline cutover, unknown Blob path — behaved well where v2 changed things. It refused to pick an MI tier and said so, surfaced the unverified Blob path instead of assuming it open, held confidence at `low`, and asked the fail-closed follow-ups for OS, edition and CLR permission set. It also exposed two defects that v2 does not cover.

**The eligibility trace was incomplete, and no invariant catches that.** `SKILL.md` requires all eight target families in the Phase A trace. The run listed four, merged containers with Arc-enabled MI, and dropped AVS, Fabric SQL DB and Arc in-place without a word. A reader cannot see why Fabric was ruled out because Fabric never appears. The 9 invariants check that the *chosen* target is eligible; none checks that every family was *considered*. Options disappearing silently is the audit's own complaint pattern, reappearing one layer up.

Proposed: a tenth invariant requiring all eight families in the trace.

**`unsupported` was used for a preference rather than an incompatibility.** The run marked containers and Arc-enabled MI `unsupported` because they "conflict with the fully managed PaaS preference". Nothing is technically incompatible; the user stated a preference. `unsupported` is a hard eligibility status, and `MANAGEMENT-MODEL` is a family-split rule. A reader returning to this card in three months would believe Arc was technically excluded when it never was.

Proposed: a distinct status for *excluded by stated preference*, so a preference can be revisited without re-litigating feasibility.

Minor, from the same run: `Target availability during sync` rendered as *not present* where *not applicable* is meant, an offline method having no sync phase; and the **Microsoft program** row the README advertises was absent from the card.

---

## 13. Second audit, of `v2.0.0` — verified findings and plan

> **Status: implemented, released as `v2.1.0`.** Waves 1 to 3 are complete and most of wave 4; what remains is listed in §13.5.
> Audited at commit `2157c97`. The auditor scored `v2.0` at **8/10**: credible for an assisted
> pre-assessment, not yet closed on its own contracts.

### 13.1 Verdict on the audit

It is right on every finding I was able to check, and I checked the load-bearing ones rather than
taking them on trust. Two of the defects are mine, introduced by v2 itself.

Its central charge is sharper than the first audit's and worth stating in its own words: **v2 wrote
the contracts but never proved the interview obeys them.** The gate I added checks that every *rule*
consumes a documented field. Nothing checks the reverse — that every field the *interview collects*
is documented, or that every option it displays exists. So the contract could be perfectly consistent
with the rules while the live interview spoke a different language entirely. It does.

| Finding | Verified | Evidence |
|---|---|---|
| Option IDs are not canonical | ✅ confirmed | `BLOB_PORTS_UNKNOWN`, `UNDER_150_GB`, `EU_DATA_BOUNDARY`, `WINDOWS_SERVER_2012_OR_LATER`, `LIST_FEATURES`, `TDE_NOT_ENABLED` exist in neither `input-contract.md` nor the engine. Six of ten IDs sampled from the session are unknown to the contract |
| Tier 2 fields are not canonical | ✅ confirmed | `rpo`, `rto`, `clr_permission_set`, `tde_status`, `source_permissions`, `authentication`, `target_region` — none in `input-contract.md`. 8 of 11 sampled fields absent |
| Method gate declared `passed` on an unknown | ✅ confirmed | Blob path unknown, gate reported passed. Invariant 3 lists version, ports, source type, capacity, permissions — blob reachability is in none of them, so the self-check had nothing to fail on |
| `CLR-PERMISSION` has no normative logic | ✅ confirmed | The rule index points at §A2, which says only *"SQL CLR/cross-DB usually compatible but assess"*. No SAFE/EXTERNAL_ACCESS/UNSAFE rule exists. **The index I added in v2 advertises a rule that is not written** |
| Size classes overlap | ✅ confirmed | Q8 offers `> 4 TB` and `> 128 TB`; a 200 TB database matches both. **Introduced by me in v2 step 2** |
| Raw KB link is invalid | ✅ confirmed, worse than reported | `raw.githubusercontent.com/.../blob/v2.0.0/...` returns **404**; without `/blob/` it returns 200. **The live knowledge-base fetch has never worked at this pin** |
| README and skill disagree on fetch policy | ✅ confirmed | README: *"fetches the knowledge base live on every run"*. `SKILL.md`: *"The bundled copy is the default"* |
| No CLR or Windows-logins scenario | ✅ confirmed | 0 occurrences of either across the 90 golden scenarios |
| `normalizedProfile` absent from output | ✅ confirmed | Required by `output-contract.md`; the session card does not show it |

### 13.2 Where I would nuance it

**Shortening the interview is not simply pruning.** The audit is right that MI Link and LRS
prerequisites stopped mattering once an offline cutover was chosen. But questions must be skipped on
the *current* provisional path and re-asked when the path changes, otherwise the first answer quietly
locks the estate out of near-zero options. Conditional, not deleted.

**`SAFE` deserves stronger wording than the audit gives it.** It says SAFE is not sufficient. Under
`clr strict security`, introduced in SQL Server 2017 and on by default, the engine treats SAFE and
EXTERNAL_ACCESS assemblies **as if they were UNSAFE**: they need a signature or a trusted hash.
So SAFE is not merely weak evidence, it is close to no evidence at all, and the card called it
*favorable*.

**Runtime evals still measure agreement, not correctness.** Worth doing, and it is lot F. But the
Windows Server 2012 error would have scored 100% for five versions. What changes my view is that we
now have a real transcript to replay, which is a better seed than invented profiles.

**Slimming `SKILL.md` to routing is the atomic-rewrite trap again.** Correct in direction, high risk
in one pass, and it touches the file the weekly check parses. It goes last, or not at all.

### 13.3 Plan

Ordered by what protects a user first, not by what is easiest to test — the charge both audits made.

#### Wave 1 — close the interview-to-contract gap (the P0s)

| # | Task | Files | Difficulty |
|---|---|---|---|
| W1-1 | Give every displayed option a canonical ID, not only the 30 already there | `input-contract.md`, `SKILL.md` | 🟠 |
| W1-2 | Add the missing canonical fields: `rpo`, `rto`, `clr_permission_set`, `tde_status`, `source_permissions`, `authentication`, `target_region` | `input-contract.md` | 🟠 |
| W1-3 | **Gate `interview-conforms-to-contract`**: every option and field the interview collects must exist in the contract, and CI fails otherwise. This is the missing direction of the check | `run-tests.mjs` | 🔴 |
| W1-4 | Split the network question into `network_bandwidth`, `mi_link_ports`, `blob_https_reachability` | `SKILL.md`, `input-contract.md` | 🟠 |
| W1-5 | Rule `BACKUP-BLOB-PATH` consuming `blob_https_reachability`, with `unknown_requires_assessment` | `decision-rules.md`, rule index | 🟠 |
| W1-6 | Invariant 10: a method gate may not report `passed` while any input it consumes is unknown | `output-contract.md`, `SKILL.md` | 🟠 |

#### Wave 2 — the defects v2 introduced

| # | Task | Files | Difficulty |
|---|---|---|---|
| W2-1 | Fix the raw KB URL, drop `/blob/`. **The live fetch is currently 404** | `SKILL.md` | 🟢 |
| W2-2 | Gate: every URL in the policy documents resolves, so a dead pin cannot ship again | `run-tests.mjs` | 🟠 |
| W2-3 | Settle one fetch policy — recommendation: **bundled copy by default**, live fetch on request — and align README, skill, howto and site | 5 files | 🟠 |
| W2-4 | Non-overlapping size classes: `< 150 GB`, `150 GB – 4 TB`, `> 4 TB – 128 TB`, `> 128 TB` | `SKILL.md`, rules, engine | 🟠 |
| W2-5 | Write `CLR-PERMISSION` normatively, with the `clr strict security` behaviour and a Microsoft source. **Never treat SAFE as validation** | `decision-rules.md`, KB § if needed | 🟠 |
| W2-6 | Gate: every rule-index entry resolves to normative text in the section it names | `run-tests.mjs` | 🟠 |

#### Wave 3 — cover what the transcript exposed

| # | Task | Difficulty |
|---|---|---|
| W3-1 | The session as a golden scenario, with its exact answers | 🟢 |
| W3-2 | Metamorphic pairs: blob unknown → gate unknown; blob confirmed → gate passed | 🟠 |
| W3-3 | SAFE → EXTERNAL_ACCESS → UNSAFE: remediation must escalate | 🟠 |
| W3-4 | `MANAGED_PAAS` → `OS_CONTROL`: SQL VM becomes primary | 🟢 |
| W3-5 | offline → near-zero: MI Link and LRS re-enter, and only then are their prerequisites asked | 🟠 |
| W3-6 | TDE off → on: certificate added, target unchanged | 🟢 |
| W3-7 | ID, English label and French label produce the same decision | 🟠 |
| W3-8 | Same profile with IOPS and latency supplied: a tier becomes selectable | 🟢 |
| W3-9 | Negative: output without `normalizedProfile` fails; method `passed` with an unknown fails | 🟠 |

#### Wave 4 — the remaining P1/P2, in order

| # | Task | Difficulty |
|---|---|---|
| W4-1 | `unsupported` split: technically ineligible vs excluded by stated preference (from the previous run) | 🟠 |
| W4-2 | Invariant: all eight target families appear in the Phase A trace (from the previous run) | 🟠 |
| W4-3 | SSMS 22 recommendation states the `sysadmin` prerequisite on the source | 🟢 |
| W4-4 | Claims registry: add CLR, SSMS 22, Windows logins, MI tier; add `rule_ids` checked by CI | 🟠 |
| W4-5 | Conditional interview: skip questions the current path cannot use, re-ask when the path changes | 🔴 |
| W4-6 | Lot F runtime evals, seeded with the real transcript, across two models | 🔴 |
| W4-7 | Slim `SKILL.md` to routing and interaction rules — **last, and only if the rest is stable** | 🔴 |

### 13.4 What this will not fix

- It closes the gap between the interview, the contract and the gates. It does not make the skill
  correct; it makes it consistent with itself and honest about what it has not checked.
- Runtime evals measure agreement across models. A shared error still scores well.
- The knowledge base stays untouched, except where W2-5 needs a sourced CLR fact.

### 13.5 Delivery status

Released as `v2.1.0`. **23 gates, 106 scenarios.**

| # | Task | State |
|---|---|---|
| W1-1 | Canonical IDs for every option | ✅ 72 IDs, up from 30 |
| W1-2 | Missing canonical fields | ✅ `rpo`, `rto`, `target_region`, `clr_permission_set`, `tde_status`, `source_permissions`, `authentication`, `blob_https_reachability` |
| W1-3 | Gate `interview-conforms-to-contract` | ✅ proved by sabotage with `BLOB_PORTS_UNKNOWN`, the exact ID from the audited session |
| W1-4 | Split the network question | ✅ `network_bandwidth`, `mi_link_ports`, `blob_https_reachability`; the mirror still reads the old composite so 90 scenarios did not need rewriting |
| W1-5 | Rule `BACKUP-BLOB-PATH` | ✅ written **and implemented**. It covers LRS, which stages backups in Blob — the first version missed that because the method is not called backup/restore |
| W1-6 | Invariant: no gate passes on an unknown | ✅ invariant 10 |
| W2-1 | Fix the 404 KB pin | ✅ |
| W2-2 | Gate on dead URLs | ⚠️ partial: `version-manifest-current` checks the manifest wiring, not every URL. See below |
| W2-3 | One fetch policy | ✅ bundled by default, live on request, aligned across five documents |
| W2-4 | Non-overlapping size classes | ✅ |
| W2-5 | `CLR-PERMISSION` normative | ✅ written **and implemented**: UNSAFE or unstated returns a shortlist, and SAFE is not a clearance |
| W2-6 | Gate: index entries resolve | ⚠️ partial: entries are checked for consumed fields and unknown behaviour, not for the presence of normative text |
| W3-1..9 | Scenarios from the transcript | ✅ 16 added, including the metamorphic pairs and six that keep the distribution honest |
| W4-1 | `excluded_by_preference` | ✅ invariant 12 and the status vocabulary |
| W4-2 | Eight families in the trace | ✅ invariant 11 |
| W4-3 | SSMS 22 `sysadmin` prerequisite | ✅ stated in Tier 2 and covered by a scenario |
| W4-4 | Claims registry `rule_ids` | ⬜ not done |
| W4-5 | Conditional interview | ⬜ not done — the risk noted in §13.2 stands |
| W4-6 | Lot F runtime evals | ⬜ not started |
| W4-7 | Slim `SKILL.md` to routing | ⬜ deliberately not attempted |

**Unplanned, and found while doing the work.** The weekly check bumps the knowledge base but never
stamped `version.json` or the coordinated line in `SKILL.md`, so the next automated bump would have
left every installed copy believing it was current — the one failure mode a version check must not
have. `apply-update.mjs` now stamps both and a gate keeps that wiring in place.

**Applying `CLR-PERMISSION` in `finalizeStatus` was wrong, and a gate caught it.** The target had
already been selected, so eligibility went to `unknown` while the card still recommended it. It runs
in phase A now, where it can change the answer.

**The distribution gate flagged the new scenarios**, because sixteen from one session over-weighted
Managed Instance. Raising the threshold would have been the exact behaviour both audits complained
about, so six scenarios were added instead, covering AVS, Arc on Kubernetes, Fabric as a driver,
Windows logins, limited source rights and a blocked Blob path.

---

## 14. Third audit, of `v2.1.0` — four coherence corrections

> **Status: done.** Audited at commit `dc560e8`. The auditor's verdict: *"on est vraiment bien"*, no
> new features, four coherence gaps to close. All four are closed; released work is on `main`.

The audit added no findings about facts or design. Every item was a gap between what a document
promised and what the mirror produced — the class of defect this project keeps finding one layer
further out each time.

| Finding | Correction | Verified |
|---|---|---|
| The real scenario expected LRS while the rules map offline to native backup/restore, and the audited session had chosen the native restore | `chooseMiMethod` returns **native backup/restore** for an offline window. LRS exists to shorten a cutover that cannot be long | ✅ nine scenario expectations realigned |
| Templates offered `passed \| refused` only, and the mirror emitted no gate status at all | **`methodGateStatus` with three states**, emitted, rendered, schema-constrained, asserted by both Blob scenarios | ✅ unknown when unverified, passed when confirmed |
| `excluded_by_preference` existed only in `output-contract.md` — a contractual status nobody could produce | Implemented in the mirror, the rules and the skill, wherever the stated management model removes a family | ✅ scenarios assert it |
| The README still said the knowledge base is fetched live on every run | Bundled by default, pinned live on explicit request, stated in both places that claimed otherwise | ✅ |

**Two smaller finds while doing the work.** The scenario schema still permitted `validated` and
`high`, three versions after both were removed, so the suite would have accepted the vocabulary its
own gate forbids elsewhere. And a guard check depended on offline mapping to LRS in order to force a
fallback rejection; it now uses SQL Server 2025 with a short window, where MI Link needs unconfirmed
ports and LRS stops at 2022.

### Smoke test — the audited AWS profile

Single SQL Server 2016 on AWS EC2, SQL CLR with `CLR_SAFE`, Windows logins, offline cutover, EU data
boundary, Blob path unverified. Six checks, all passing:

| Check | Result |
|---|---|
| Managed Instance recommended | ✅ |
| Method is native backup/restore | ✅ |
| Blob gate `unknown_requires_assessment` | ✅ |
| Confidence `low` | ✅ |
| Status `provisional` | ✅ |
| SAFE presented as remediation with a signing requirement, never as validation | ✅ |

The first two Blob scenarios now assert `methodGateStatus`, so the original defect is locked rather
than merely documented.

### Also delivered

[`docs/ARCHITECTURE.md`](ARCHITECTURE.md) — a deep dive on what the plugin is, how a session runs end
to end, what the 23 gates defend, and where it can still be wrong.

### Still open, and deliberately so

- `rule_ids` in the claims registry
- The conditional interview: skip what the current path cannot use, re-ask when the path changes
- Lot F, runtime evaluation across models — the only work that would measure whether a session
  reaches the mirror's answer, and the gap no gate closes
- Two partial gates: no check that every URL in the policy documents resolves, and none that each
  rule-index entry has normative text behind it
