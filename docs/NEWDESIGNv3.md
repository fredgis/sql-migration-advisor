# Why there is a v3

A design note about a defect that took three releases to see clearly, and about what changed
because of it.

This is the companion to [`NEWDESIGNv2.md`](NEWDESIGNv2.md). That document explained why the rules
became a versioned, addressable policy. This one explains why the *decision* had to become as
traceable as the rules, and why the handoff between the two skills had to be able to carry what the
recommendation already knew.

Written for someone deciding whether to trust the tool, or about to change it.

---

## 1. The question that started it

> *"What do I answer so the engine recommends Azure DMS?"*

A demo question. It should have taken two minutes.

The honest answer was: **nothing**. There was no set of interview answers that reached Azure DMS
for Managed Instance or for SQL VM. The knowledge base declared it supported for both, the
prerequisite catalog carried its prerequisites under `P23`–`P26`, the decision rules named it as
the path that survives when MI Link is unavailable — and no profile could reach it.

That is not a missing feature. It is a claim the repository was making and could not honour.

---

## 2. What was actually wrong

The tool had two halves that looked alike and behaved differently.

**Choosing a target** evaluated all eight families, gave each a status, a reason and the ID of the
rule that decided it, and an invariant refused to let a family vanish from the trace. The wording
in the output contract is unusually direct about why:

> *A family that silently disappears cannot be argued with.*

**Choosing a method** did none of that. It was a hand-written `if` cascade that jumped straight to
one answer.

```js
if (has(inputs.downtime, 'minimal')) return 'LRS';
return 'Native backup/restore';
```

The asymmetry matters more than it looks. A method that is never enumerated is **never rejected
either**. There is no gate output saying it failed, no line in a trace saying it lost, nothing for a
reviewer to disagree with. Its absence is indistinguishable from its non-existence.

So the defect was invisible by construction. Every gate was green. 112 golden scenarios passed. The
matrix declared 56 supported cells; a sweep of 400 000 generated profiles reached **16 distinct
(target, method) pairs**. Nothing in the repository could have told you that, because nothing was
looking at the gap between what was declared and what was reachable.

### The gap it was hiding

Two profiles carrying `SQL Agent` and `linked servers` were routed to **Azure SQL Database**, which
can host neither.

That is the part worth pausing on. The missing method was not merely an unavailable option — it was
concealing a **wrong recommendation**. When the only online path to Managed Instance was blocked,
the cascade left the target family rather than trying the next method, and landed on a target the
dependencies ruled out. A reader would have seen a confident card with a rule ID on every line.

---

## 3. Three releases, because the first two fixed the wrong layer

| Release | What it did | Why it was not enough |
| --- | --- | --- |
| **v2.11.0** | Made every supported method a **candidate**: `methodCandidates[]`, roles, reasons, and a gate holding the rules to the matrix | Candidates were enumerated but the winner was still chosen by the cascade. DMS could be *listed* and never *selected*. |
| **v2.12.0** | Made them **selectable**, and split the Log Replay Service gate by control plane | The recommendation now knew things the handoff could not carry. |
| **v3.0.0** | Made the handoff carry them | — |

The middle row is the interesting failure. v2.11.0 looked like a fix and shipped with 31 green
gates. It surfaced the candidates a reader could see, which was real progress, but the ranking
underneath was unchanged. An external audit caught that, and it was right to.

---

## 4. What v3 changes

### 4.1 A route can need more than one path

`advisor-coverage.json` requires a method path **and** `P27` for the eight AVS routes that move a
database. The prerequisite skill accepted exactly one path, with an invariant saying so.

Those two statements cannot both be satisfied. `P27` alone describes a platform nobody migrates to.
The method path alone describes a generic SQL Server rather than an AVS-hosted one. Whichever was
emitted, the other was silently dropped — so seven of the eight AVS routes could not produce a
correct plan, and the shape of the contract was what prevented it.

```
selectedMethodPath   the path that moves the data
appliedOverlays[]    what the route also needs, with a role and a reason
```

`selectedPath` is still emitted as an alias, so an existing reader keeps working. It simply cannot
express a composite route, which is why it is deprecated rather than kept.

A gate now holds every AVS candidate that moves a database to carrying `P27`, **and** holds
HCX — which moves the machine rather than the database — to *not* carrying it. Both directions,
because a rule that only catches omissions invites over-application.

### 4.2 The control plane is part of the answer

The card printed *Assess / orchestrate: Arc · DMS · SSMS · Azure Migrate*. The JSON had no field
for it. So a native restore orchestrated through the Azure Arc portal was indistinguishable from a
standalone one, and the Arc extension, identity, batch and connectivity prerequisites disappeared
at the handoff.

It is not presentation. **It decides which support matrix governs a method** — and that is what
made the worst defect of v2.12 possible.

### 4.3 Inherited facts need a crosswalk, including the ones that do not convert

The prerequisite skill is told not to ask again for a fact the Advisor established. But the two
skills name and type their facts differently, so the rule could not be applied consistently:
`size` is a band on one side and a number of gigabytes on the other; `downtime` is
`downtime_tolerance`; `mi_link_ports` is free text against a status.

`advisor-fact-mappings.json` covers all 15 fields. The valuable half is what **cannot** convert:

| Producer | Consumer | Why it cannot convert |
| --- | --- | --- |
| `size` | `largest_database_size_gb` | A band cannot become a measurement without inventing precision the user never gave |
| `performance` | `performance_baseline_status` | A qualitative note is not a captured baseline |
| `feature_dependencies` | `feature_inventory_status` | A list the user happened to mention is not a completed inventory |
| `network_ports` | `network_path_status` | One port says nothing about DNS, private endpoints, or the rest of the path |

Without those four rows, "do not ask twice" would quietly promote an opinion into evidence. The
prerequisite that exists to catch *the dependency nobody thought of* would be satisfied by the
dependencies someone did think of.

### 4.4 A transport is not a migration method

The summary matrix is not the whole inventory. Routes described only in narrative prose — Azure
Migrate replication, Striim, detach/attach, Dataflow Gen2, Data Box seed — had no canonical
identity, so nothing could say whether their absence from the matrix was deliberate or an oversight.

`reference/migration-methods.json` types all 26 routes: `migration`, `assessment`, `transport`,
`overlay`, `out_of_scope`. A gate refuses to let a transport or an assessment be marked
recommendable.

This is the answer to an audit finding the project **did not accept**. The audit counted 28
`documentary` cells as unreachable methods and read that as incomplete coverage. They are not
methods. `bcp`, Data Factory Copy and Smart Bulk Copy move rows; they carry no schema, no
dependencies and no cutover. Azure Migrate assesses. SSMA converts non-SQL-Server sources. Counting
them as recommendable would promote a bulk-copy utility to a migration method, which is worse than
the gap it would close.

What changed instead is the **wording** that let *supported* be read as *recommendable*, and the
manifest that now makes the distinction machine-checkable rather than a matter of tone.

---

## 5. The principle underneath all four

Every one of these was the same shape of defect:

> **The system knew something it could not say.**

The matrix knew DMS was supported; the cascade could not express it. The coverage data knew AVS
needed two paths; the contract could only hold one. The card knew the control plane; the JSON had
no field. The Advisor knew the user's size band; the consumer could not tell whether that counted
as an answer.

A recommendation engine is only as trustworthy as the things it can be argued with about. Every
fix here has the same form: **make the thing sayable, then require it to be said.**

That is why each one shipped with a gate rather than a fix alone:

| Gate | What it makes impossible |
| --- | --- |
| `b3-offers-every-recommendable-method` | A supported method absent from the guidance; a winner absent from its own candidate list; an AVS route missing its overlay |
| `documented-json-matches-its-schema` | A documented example its own schema would reject |
| `method-manifest-types-every-route` | A transport marked recommendable |
| `advisor-fact-crosswalk-is-wired` | A field pair with no declared conversion |
| `normalized-profile-matches-input-schema` | A profile field that exists on one side of the handoff only |
| `coverage-prose-matches-coverage-data` | A count in prose drifting from the data it describes |
| `policy-tables-are-well-formed` | A rule table row that parses into the wrong number of columns |

---

## 6. What is still not true

Honesty about the limits, in the same spirit as `ARCHITECTURE.md` §5.

- **The mirror is not the model.** `evaluate.mjs` re-implements the rules in JavaScript so scenarios
  can be replayed. Nothing mechanically ties it to the prose a session actually reads. A green suite
  proves the *re-implementation* behaves; it does not prove the model reading the same rules agrees.
  This is the deepest gap in the design and v3 does not close it.
- **Two Microsoft pages still contradict each other.** Standalone LRS is documented for SQL Server
  2008-2022; the Arc migration path lists 2025. Both are current. The rules record **both**, split
  by control plane and dated, rather than arbitrating on Microsoft's behalf. The registry now
  watches both pages so a change becomes a question for a person.
- **`documentary` is a judgement.** Reasonable people could argue Data Factory Copy is a migration
  method for some estates. The manifest makes the judgement explicit and challengeable, which is the
  most that can honestly be claimed for it.
- **Reachability is measured, not proven.** The 400 000-profile sweep is a sampling of a space with
  far more combinations. It found what it found.

---

## 7. If you are changing this

Three habits, learned the hard way in this cycle.

**Enumerate before you rank.** If a decision picks one thing, ask what it did not pick and whether
that is visible. An option that was never a candidate cannot appear in a rejection list, and its
absence will not fail a test.

**When you widen a claim, widen the thing that checks it.** Adding the log shipping row to the
matrix silently invalidated a paragraph two documents away that counted the cells, and no gate
noticed for a day. Counts in prose should be generated, not typed.

**A gate written to catch your own mistake will catch it.** Three of the gates above failed on the
first run against the code that had just been "fixed": the JSON example was still invalid, a regex
broke on CRLF, and a method name in the manifest did not match the matrix. That is the gate working,
not the gate being wrong.

---

*Companion documents: [`ARCHITECTURE.md`](ARCHITECTURE.md) for how the pieces fit,
[`WEEKLYCHECK.md`](WEEKLYCHECK.md) for how the facts stay current, and
[`NEWDESIGNv2.md`](NEWDESIGNv2.md) for why the rules became versioned policy.*
