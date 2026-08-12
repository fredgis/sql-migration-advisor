# Output contract — `get-connection-details`

> **Draft, v0.6.** This contract belongs to `get-connection-details` only. The
> `recommend-migration-path` contracts live at [`reference/output-contract.md`](../../../reference/output-contract.md)
> and are not affected by anything here.

What an answer must look like, and the invariants the skill checks against its own draft before
showing it. An answer that fails an invariant is corrected, not shipped with a caveat.

---

## 1. Shape

Two modes, two cards. They are not interchangeable: composing states what to do, diagnosing states
what is wrong and — just as importantly — what is not.

### Composing

| Element | Rule |
| --- | --- |
| Verdict line | Target, endpoint, **port**, connection policy. Before any prose |
| Connection string | Placeholders only |
| Requirements table | Ports, DNS, identity. Each row actionable as written |
| What will break it | Only when a documented trap applies to this combination |
| Verification command | Runnable, so the answer is falsifiable |
| Stamp | `KB v<version> · sourced and quoted` |

### Diagnosing

| Element | Rule |
| --- | --- |
| Verdict line | Symptom and **probable cause**, named as probable |
| Reasoning | Why the symptom points elsewhere than the cause |
| Check table | First, then, and an explicit **Not this** row |
| Verification command | Runnable |
| Stamp | Same |

The **Not this** row is mandatory in diagnosis mode. Without it the reader follows the symptom,
which in the cases this skill exists for points at the wrong layer.

---

## 2. Invariants

Checked against the draft answer before it is shown.

| # | Invariant |
| --- | --- |
| 1 | **No credential appears.** No password, key, SAS token or client secret, in any field or example |
| 2 | **Every value traces to the matrix.** A port, keyword or FQDN not present in `connectivity-matrix.json` is not emitted |
| 3 | **The port appears in the verdict line**, before any prose |
| 4 | **`UNKNOWN` is reported, never defaulted.** A missing input is a stated gap |
| 5 | **An open-research item returns "not researched"**, with the page to read — never an inferred value |
| 6 | **A `CONFLICT` fact states both readings** and the safe recommendation, never one side silently |
| 7 | **The Fabric FQDN is never composed.** Both Fabric targets are portal-derived |
| 8 | **A verification command is present**, or the reason it could not be produced |
| 9 | **A check is only reported as run if it ran.** Proposing is not running |
| 10 | **The knowledge-base version is stated**, so the answer is reproducible |
| 11 | **The draft status is visible** while the knowledge base is under review |
| 12 | **Driver syntax is never ported between drivers.** SqlClient spells with spaces, JDBC and ODBC without |
| 13 | **A version-gated answer states its version condition** — Entra on SQL Server 2022+, Redirect on JDBC 9.4+, ODBC service principal on 17.7+ |

---

## 3. The stamp, and what it promises

```text
KB v0.6 · sourced and quoted
```

It promises exactly this: every value in the card has a Microsoft page and a matched sentence
behind it.

It does **not** promise the claim is correctly scoped. Three external audits found rows where a
quote proving one cell had been read as proving a whole row. That is why the wording is *sourced
and quoted* and not *verified* — the earlier stamp, `all rows VERIFIED`, claimed more than the
evidence supported.

---

## 4. Machine-readable form

When a consumer asks for structured output:

```json
{
  "mode": "compose | diagnose",
  "target": "<target_id>",
  "networkPath": "<network_path>",
  "endpoint": { "fqdn": "<string | PORTAL_DERIVED>", "port": 0, "connectionPolicy": "<string>" },
  "connectionString": "<string with placeholders>",
  "requirements": [{ "kind": "port | dns | identity | driver", "statement": "<string>", "source": "<url>" }],
  "diagnosis": { "probableCause": "<string>", "notThis": ["<string>"], "checkFirst": "<string>" },
  "verification": { "command": "<string>", "executed": false, "result": null },
  "unknowns": ["<field or open-research item>"],
  "conflicts": [{ "id": "<contradiction id>", "readings": ["<string>"], "guidance": "<string>" }],
  "knowledgeBase": { "version": "v0.6", "status": "draft" }
}
```

`executed` is `false` unless the command actually ran. `unknowns` and `conflicts` are emitted even
when empty, so a consumer can tell the difference between *nothing was uncertain* and *the field
was omitted*.

---

## 5. Refusals

The skill declines rather than guessing when:

- the target is outside the five in the input contract;
- the question is about migration method, sizing, pricing or tuning — that is
  `recommend-migration-path` or the migration knowledge base;
- the answer would require `pyodbc` or `go-mssqldb` syntax, which has no verified row;
- the user asks for a credential to be generated or stored.

A refusal names what would be needed to answer, so it is a next step rather than a dead end.
