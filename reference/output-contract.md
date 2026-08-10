# Output contract

The single source of truth for what a recommendation contains, how it is rendered, and what the skill must verify about its own answer before showing it.

---

## 1. Status vocabulary

| Field | Allowed values |
|---|---|
| `recommendationStatus` | `provisional` — **the only value this skill produces** |
| `confidence` | `low` · `medium` |
| Eligibility, per target | `eligible` · `eligible_with_remediation` · `unsupported` · `unknown_requires_assessment` |

`validated` and `high` are not in this contract. The skill reads no assessment artefact: it opens no report, runs no tool and queries no service, so it cannot certify one. Four self-declared booleans used to promote a recommendation to `validated` and `high`, which turned an unverified statement into an assurance and moved responsibility onto a flag nobody had checked.

Promoting a recommendation to validated means reading real artefacts and recording, for each one, its type, its URI or hash, the tool and version that produced it, its date, the target region and the approver. That belongs to a workflow that can open them.

### Confidence

| Level | Meaning |
|---|---|
| `medium` | Triage is complete and internally consistent. The ceiling for this skill |
| `low` | At least one decision-driving unknown remains, or two answers conflict |

---

## 2. Structure

```text
metadata
  knowledgeBaseVersion
  decisionRulesVersion
  sourceCommit            (when known)
  evaluatedAt
  recommendationStatus    = provisional
  confidence              = low | medium
normalizedProfile
eligibilityTrace[]        one entry per target: status, rule ID, reason
recommendation
  target, tier, method
alternative
  target, method, the condition under which it wins
methodGateTrace           the gate result for the selected method
blockers[]
unknowns[]
assumptions[]
evidenceRequired[]
largestRisk
nextActions[]
evidenceLinks[]
```

Markdown is the default rendering. JSON is produced on request. **The card is a faithful rendering of this object**: an example may not introduce a field that does not exist here.

---

## 3. Self-check, before rendering

Run every invariant below **before** showing the card. This is the only mechanism in the skill that protects a live answer, so it is not optional.

| # | Invariant |
|---|---|
| 1 | The primary target is `eligible` or `eligible_with_remediation`, never one just marked `unsupported` |
| 2 | The alternative target is also `eligible` or `eligible_with_remediation` |
| 3 | The selected method passes its own gate: source version range, ports, source type, capacity, permissions |
| 4 | The selected tier violates no capacity or feature limit |
| 5 | Every hard-gate unknown appears in both `unknowns` and `evidenceRequired` |
| 6 | An `unsupported` target never appears as primary or alternative |
| 7 | Refusing a preview **method** never removes a generally available **target** when another viable method exists |
| 8 | No cost figure appears without measured sizing and stated pricing assumptions |
| 9 | `recommendationStatus` is `provisional` and `confidence` is at most `medium` |

**When an invariant fails, do not repair the output silently.** Expose the inconsistency, return a provisional shortlist or name the missing evidence, and say which invariant broke. A card that quietly corrects itself hides the fact that the rules disagreed.

**When every invariant passes, show nothing about the check.** The user sees the normal card.

---

## 4. Markdown rendering

In the user's language.

```markdown
> **Preliminary recommendation — <profile>**
> **<PRIMARY TARGET>** via **<METHOD>** · status **provisional** · confidence **<medium|low>**
> KB **<version>** · rules **<version>** · commit **<sha or n/a>** · evaluated **<timestamp>**

One sentence on why this is the recommended assessment path.

**📋 Primary recommendation**

| | Recommendation |
| --- | --- |
| 🎯 **Target / tier** | … |
| 🔁 **Migration method** | … |
| 👁️ **Target availability during sync** | read-write · read-only · unavailable · not-present |
| ⏱️ **Business cutover downtime** | near-zero · < 1 minute · minutes · hours · full restore time · total migration execution time · unknown_requires_assessment |
| 🧭 **Assess / orchestrate** | … |
| 💰 **Cost view** | Cost levers only; no estimate until sizing and pricing are done |

🥈 **Alternative** — <target> via <method>; wins when <condition>.

**Phase A eligibility**

- **SQL MI** — `<status>`: `<reason>` `[RULE-ID]`
- **SQL DB** — `<status>`: `<reason>` `[RULE-ID]`
- … one line per relevant target

🔁 **Method gate** — <method>: passed | refused (<reason>)

🚧 **Blockers and required evidence**
- **<blocker>** → <remediation or assessment>

**Unknowns** — <unknown> → why it can change the decision

**Assumptions** — …

**Largest risk** — one sentence.

**Next action** — the single assessment to run first.

**Evidence links** — first-party sources used, with preview or limit caveats.
```

### Rule IDs in the trace

Each eligibility line carries the ID of the rule that decided it, in brackets. It is one short token, not a paragraph: enough for a reader to look the rule up in `reference/decision-rules.md` and challenge it.

The full reasoning stays **on request**. The readable card is the default.

---

## 5. Estate output

For `scope = LARGE_ESTATE`, lead with an estate strategy, then a compact table:

| Profile | Primary | Alternative | Status / confidence | Key evidence gap |

Expand only the non-obvious profiles. The per-database card is for a single profile.

---

## 6. What the output must never do

- Claim a status or confidence outside §1.
- Present a cost estimate. Cost levers only.
- Recommend a retired tool: DMA, the Azure Data Studio migration extension, DMS *classic*, DEA, Distributed Replay. Naming them as history or as something replaced is fine.
- Echo customer names, tenant details, server names or subscription identifiers. Answer using them if supplied, write the card so it can be shared without them.
- Contradict its own eligibility table. That is what §3 exists to prevent.
