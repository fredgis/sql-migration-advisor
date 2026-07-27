---
name: sql-migration-advisor
description: "Preliminary SQL Server to Azure migration disposition and recommended assessment path. Runs a short guided interview, then applies the FY27 SQL knowledge base to pre-select candidate targets (SQL VM, AVS, SQL MI, SQL DB, Fabric SQL DB, Arc SQL MI, container or Arc in-place), migration methods (MI Link, LRS, backup/restore, DAG/AG, modern DMS, transactional replication, BACPAC, Fabric Migration Assistant), blockers, evidence gaps, cost levers and Microsoft program fit. Trigger when the user wants to migrate or modernize SQL Server to Azure, asks for the best or recommended migration path, target or tool, or says 'migrer SQL Server', 'migrate SQL Server', 'SQL to Azure' or 'SQL in a Day'."
license: MIT
---

# SQL Migration Advisor — preliminary disposition for SQL Server → Azure

Help the user get a **preliminary recommendation / recommended assessment path** for a SQL Server migration to Azure. This skill is a **discovery and pre-selection assistant**, not a final architecture decision. Every recommendation remains **provisional** until validated by assessment tooling and an architect.

The skill is sourced from the knowledge base [`docs/sql-server-to-azure-migration.md`](https://github.com/fredgis/sql-migration-advisor/blob/main/docs/sql-server-to-azure-migration.md) and the bundled `reference/decision-rules.md`.

## Source of truth and determinism

At session start, fetch the live knowledge-base document:

- Raw URL: `https://raw.githubusercontent.com/fredgis/sql-migration-advisor/main/docs/sql-server-to-azure-migration.md`
- Use the live doc when available. If offline, use `reference/decision-rules.md` and tell the user that the offline fallback may lag.
- Current coordinated knowledge-base line: **v1.6**, dated **2026-07-27**.
- Display the **knowledge-base version** in every recommendation and, when available, the **commit SHA** and **fetch timestamp**.
- Determinism contract: **same inputs + same KB version + same engine version ⇒ same result**.

Apply `reference/decision-rules.md` by name:

1. **Phase A — Eligibility**: classify each target as `eligible`, `eligible_with_remediation`, `unsupported`, or `unknown_requires_assessment`.
2. **Phase B — Ranking**: rank remaining targets by refactoring effort, downtime, operational burden, compatibility, resilience, cost, reversibility, and sovereignty.
3. Apply the explicit **tier-selection rules** and **confidence model**.

## Core principles

- **Interview first, recommend second.** Ask one question at a time with `ask_user`, multiple-choice where possible.
- **Ask in the user's language.** If the user writes in French, ask in French.
- **Separate three layers**: target/runtime, control plane/assessment, and migration method.
- **Do not overstate certainty.** Say “preliminary recommendation”, “recommended assessment path”, or “migration disposition”; do not promise the “best path” before assessment.
- **No retired tools.** Do not recommend DMA, Azure Data Studio SQL Migration extension, DMS classic SQL scenarios, or SQL Data Sync. Use SSMS 22 Migration Component, SQL Server migration in Azure Arc, modern Azure DMS, Azure Migrate, and `Az.DataMigration` as appropriate.
- **Do not emit a cost estimate unless explicitly sized/priced.** By default the skill emits **cost levers, not an estimate**. Sizing/pricing requires assessment data and Azure pricing assumptions.
- **One recommendation per distinct profile.** For estates, group similar servers/databases, lead with discovery, then expand the non-obvious profiles.

## Correct factual gates to enforce

| Topic | Gate / consequence |
| --- | --- |
| Transactional replication → Azure SQL Database | Source **SQL Server 2016 and later** (includes 2022 and 2025); **push subscriber only**; snapshot + one-way transactional only; replicated tables need a **primary key**. |
| Log Replay Service (standalone) | Supports source **SQL Server 2008 through 2022** for Azure SQL MI migration. Target is **unavailable** during sync (RESTORING/NORECOVERY); business cutover is typically **minutes** on GP with a small final backup, but can be **hours** on Business Critical while replicas seed. |
| Azure Arc migration floors | Overall Arc migration experience for SQL MI and SQL VM targets: **SQL Server 2014 (12.x)+**. Arc → Azure SQL MI via **MI Link**: **2016+** and Windows Server 2016+. Arc → Azure SQL MI via **LRS**: Microsoft documents a **2012+** method floor but the same Arc page states **2014+** overall; treat this as a documented Microsoft inconsistency and apply the conservative **2014+** Arc floor. Arc → **SQL Server on Azure VM**: **2014+**. Standalone LRS outside Arc remains **2008–2022**. |
| MI Link | Source **2016+**; needs source **sysadmin**, distributed AGs, AG endpoint permission, and VNet connectivity. Ports are mandatory for all tiers/update policies/VPN/ExpressRoute/peering and MI-side ports are not customisable: MI subnet NSG inbound **5022** + **11000–11999** from SQL Server IP and outbound **5022**; SQL host/corporate firewall inbound **5022** from MI subnet /24 and outbound **5022 and 11000–11999** to MI. **11000–11999** is the dynamic MI-side distributed-AG HADR data channel. If **5022 or 11000–11999** cannot be opened in required directions, MI Link is `unsupported`; use LRS. [MI Link preparation](https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/managed-instance-link-preparation). Links: **100** on GP/BC, **500** on Next-gen GP, one link/database; Arc portal's **10 databases per batch** is only a wizard selection limit. AWS RDS/GCP Cloud SQL cannot use MI Link because they lack sysadmin/custom AG endpoints. |
| Managed cloud sources | AWS RDS / GCP Cloud SQL: **MI Link and transactional replication are out**. LRS/DMS work by backup upload to Blob. Native restore is indirect: export/S3/backup → Blob → restore. |
| FILESTREAM / FileTable | Hard block on Azure SQL MI and Azure SQL Database → SQL VM, AVS, or container. |
| PolyBase | Ask which kind. MI supports data virtualization over Blob/ADLS Gen2 for Parquet/CSV, with no Delta Lake, no pushdown, and no S3. MI does **not** support PolyBase connectors to external RDBMS such as Oracle, Teradata, MongoDB, or another SQL Server. |
| DTC | Ask which kind. MI supports T-SQL distributed transactions **MI↔MI** and **MI↔SQL Server**. MI does **not** support distributed transactions to third-party RDBMS or linked servers to third-party RDBMS. |
| TDE restore | Migrate/install the TDE server certificate in destination `master` before restoring encrypted databases. |
| Performance validation | Capture workload with **Extended Events**; replay with **RML Utilities / OStress**; analyse with **Query Store** and DMVs. Distributed Replay is unavailable in SQL Server 2022+. |

## Workflow

1. **Load KB** and record `knowledgeBase.version`, optional `commit`, `verifiedAt` / fetch timestamp.
2. **Frame honestly**: “I’ll ask a short triage set, then produce a provisional disposition and the assessment evidence needed to validate it.”
3. **Tier 1 triage**: ask the short interview. Pre-fill from user context; skip irrelevant branches.
4. **Tier 2 confirmation**: ask only the questions that can change the answer for candidate targets still in play, or when the user wants a validated recommendation.
5. **Apply Phase A then Phase B**, tier-selection rules, and confidence model.
6. **Output** the Markdown card and, on request or alongside it, the JSON object.
7. **Offer follow-ups**: estate table, validation checklist, runbook, or one-slide summary.

## Interview structure

### Tier 1 — Triage (provisional recommendation)

Ask one at a time. “Not sure” is allowed, but decision-driving unknowns must be surfaced; do not silently default them.

**Asking rules — how to call `ask_user` (these prevent a real UX failure):**

- **Never require a minimum number of selections.** Do not set `minItems` on a multi-select and never render “Select at least 1 item”. The user must always be able to answer nothing.
- **Ask each question at most once.** If the answer comes back empty, or the user declines or cancels, **do not re-ask it, and never re-ask it in a stricter form.** Re-prompting a question the user already answered is a bug.
- **An empty multi-select is an answer, not a failure.** Treat it as `Not sure` for that field: record the field as an **unknown**, continue the interview, and carry it into `unknowns[]` / `evidenceRequired[]` so the recommendation stays `provisional`. Do not treat it as `None`, and do not treat it as a reason to interrogate the user again.
- If the user explicitly selects `None`, that is a definite answer meaning “no such dependencies” — accept it and move on.
- If a decision-driving field ends up unknown, say so once in the output (“feature dependencies not confirmed — run a dependency discovery”), rather than blocking the interview to chase it.

1. **Scope** — “How big is this migration?”
   - `Single database` · `A few databases (2–10)` · `Large estate (10+ servers/DBs)`
   - Large estate ⇒ Azure Migrate discovery/business case + `Az.DataMigration` automation; then profile representative groups.

2. **Source location** — “Where does the source SQL Server run today?”
   - `On-prem` · `AWS EC2` · `AWS RDS for SQL Server` · `GCP Compute Engine` · `GCP Cloud SQL`
   - Managed sources ⇒ MI Link and transactional replication are out; LRS/DMS via backup upload to Blob; native restore only indirectly.

3. **Source version** — “Which SQL Server version is the source?”
   - `2008/2008 R2` · `2012` · `2014` · `2016` · `2017/2019` · `2022` · `2025`
   - Drives MI Link, LRS, native restore, replication, Arc portal, and ESU choices.

4. **Migration intent / readiness** — “What outcome do you need now?”
   - `Move to Azure now` · `Modernize in place / not ready to move yet (assess first)` · `Assessment only` · `Rehost first, modernize later`
   - In-place / assessment-only unlocks **SQL Server enabled by Azure Arc** as the control-plane path.

5. **Primary driver** — “What is the main reason?”
   - `End-of-support / ESU pressure` · `Cost optimization` · `App modernization` · `Data-center exit (VMware estate)` · `Analytics / Fabric unification` · `Sovereignty / edge`

6. **Management model** — “How much control do you need?”
   - `Fully managed PaaS` · `Need OS / file-system / engine control` · `Need Kubernetes on-prem / edge / multi-cloud`
   - If Kubernetes/edge: ask unlock question **6a**.

6a. **Kubernetes engine model** — only if Q6 = Kubernetes/edge — “Do you want Microsoft to run the engine on your cluster, or do you want to own it end to end?”
   - `Managed engine (Arc data controller: auto patch/backup/HA)` · `Full DIY container (we own HA/patch/backup)`
   - Decides Arc-enabled SQL MI vs SQL Server container.

7. **Feature dependencies** (multi-select) — “Does the workload use any of these?”
   - `FILESTREAM / FileTable` · `PolyBase` · `DTC / distributed transactions` · `Cross-DB queries` · `SQL CLR` · `Linked servers` · `SQL Agent jobs` · `Service Broker` · `None` · `Not sure`
   - If PolyBase: ask **7a**. If DTC: ask **7b**. If CLR is selected or unknown and MI/SQL DB remain candidates, ask Tier 2 CLR permission set.

7a. **PolyBase qualifier** — only if PolyBase is used — “What does PolyBase actually query — files in Azure/cloud storage, or an external database like Oracle or Teradata?”
   - `Cloud files only (Blob/ADLS Gen2 Parquet/CSV)` · `External RDBMS connector` · `S3 / Delta / pushdown required` · `Not sure`

7b. **DTC qualifier** — only if DTC/distributed transactions are used — “Are those distributed transactions only between SQL Servers, or do they span a non-SQL database?”
   - `SQL-to-SQL only (MI↔MI or MI↔SQL Server)` · `Heterogeneous / third-party RDBMS` · `Not sure`

8. **Largest DB size** — “How large is the biggest database?”
   - `< 150 GB` · `150 GB – 4 TB` · `> 4 TB` · `Not sure`

9. **Downtime tolerance** — “How much cutover downtime can the business accept?”
   - `Near-zero (minutes)` · `Minimal (tens of minutes to a couple of hours)` · `Offline planned window` · `Not sure`

10. **Network path and ports** — “What is the network path to Azure, and can MI Link ports 5022 and 11000–11999 be opened in the required directions?”
    - `Good ExpressRoute/high bandwidth` · `Limited WAN` · `Very large multi-TB move` · `5022 or 11000–11999 blocked` · `1433/443 blocked or unknown` · `Not sure`

11. **Compliance / sovereignty** — “Any data residency, sovereign, or edge constraints?”
    - `Standard commercial` · `EU data boundary` · `Government / sovereign` · `Edge / air-gapped` · `Not sure`

12. **Ancillary services and security** (multi-select) — “Anything around the database to bring along?”
    - `SSIS packages` · `SSRS reports` · `SSAS models` · `TDE-encrypted DBs` · `Many SQL Agent jobs` · `Windows logins` · `None` · `Not sure`

13. **Tier-selection inputs** — ask compactly when SQL MI or SQL DB remains eligible:
    - “Any tier drivers: `low-latency writes`, `high IOPS/log throughput`, `strict SLA / zone redundancy`, `read-scale replicas`, `intermittent usage`, `many tenants / variable demand`, or `none/unknown`?”
    - Consumed by GP vs Business Critical vs Hyperscale vs Serverless vs Elastic Pool.

### Tier 2 — Confirmation (only when decision-driving)

Ask only questions that can change candidates still in play, or when the user wants a validated recommendation. Do not ask about elastic-pool tenancy if SQL DB is already eliminated.

| Confirmation input | Ask when | Consumed by |
| --- | --- | --- |
| Source edition and OS | VM/AVS/Arc/container or licensing/ESU are in play | compatibility, HA/DR support, AHB/ESU, patching responsibility |
| Compatibility level | SQL DB, Fabric SQL DB, or modernization candidate | refactoring effort and compatibility scoring |
| Current HA/DR topology: FCI, AG, log shipping, none | near-zero/minimal downtime or VM/AVS/MI Link in play | method feasibility, rollback, resilience |
| RPO and RTO separately | any production migration | method ranking and DR design |
| Peak log generation / change rate | MI Link, LRS, replication, log shipping, Data Box seed | catch-up feasibility and downtime risk |
| CPU, memory, IOPS, and latency peaks | any PaaS target or tier choice | sizing and tier-selection rules |
| Authentication: Windows, Entra ID, SQL | SQL DB/MI or cross-domain source | login remediation, AD/Entra dependencies |
| SQL CLR permission set: SAFE, EXTERNAL_ACCESS, UNSAFE | CLR present/unknown and PaaS remains possible | eligibility/remediation |
| Network, DNS, Active Directory dependencies | MI Link, AG/DAG, linked servers, Windows auth, VM/AVS | connectivity, identity, failover feasibility |
| Backup retention and restore requirements | native restore/LRS/SQL DB tiers | operational burden and compliance |
| Target region and actual feature availability | any Azure target | regional eligibility and sovereignty |
| DR architecture and rollback plan | any production cutover | reversibility and resilience scoring |
| Software Assurance / AHB entitlement | SQL DB/MI/VM cost comparison | cost lever eligibility |
| Maintenance/patching restrictions | VM/AVS/container vs managed PaaS | operational burden and target ranking |

### Structured inputs (capture as typed values, never as prose)

These four are **not** free-text answers. Record them as typed values, because rules read them directly and
a wrong guess silently changes the recommendation.

| Field | Ask when | Type | Consumed by |
| --- | --- | --- | --- |
| `database_count` | more than one database is in scope | integer | MI Link capacity (100 General Purpose / Business Critical, 500 Next-gen General Purpose) and the estate-discovery branch. Never infer it from a free-text size answer. |
| `migration_batch_size` | the Azure Arc portal migration is being used | integer | Arc wizard per-batch limit — a different limit from MI Link capacity |
| `arc_extension_version` | the Azure Arc portal migration is being used | version string, e.g. `1.1.3348.364` | Gates the Arc wizard batch limit. **Unknown is not treated as recent** — it yields `unknown_requires_assessment`. |
| `evidence` | the user wants a **validated** (not provisional) recommendation | four booleans: `dependenciesToolConfirmed`, `performanceMeasured`, `regionAvailabilityConfirmed`, `architectSignedOff` | `recommendationStatus` and `confidence`. All four must be `true` for `validated`; free text mentioning these phrases never substitutes for the typed values. |

### Never contradict your own eligibility result

The recommended target and method must agree with the eligibility table produced in the same run:

- The primary target must be `eligible` or `eligible_with_remediation` — **never** one just marked `unsupported`.
- The method must be viable for that target and pass its own gates (source-version range, ports, source type, capacity).
- If nothing survives with a viable method, return a **provisional shortlist** with the exclusion reasons and the assessment to run next. Do not invent a fallback.
- Worked case: a SQL Server **2025** source with MI Link blocked and Azure SQL Database incompatible ⇒ LRS is **not** legal (standalone LRS covers 2008–2022), so answer **SQL Server on Azure VM** or a provisional shortlist — never "SQL MI via LRS".

## Uncertainty and confidence model

Decision-driving unknowns are: linked servers, SQL Agent, FILESTREAM/FileTable, PolyBase kind, DTC kind, CLR permission set, TDE, largest DB size, downtime tolerance, source location, source version, and source permissions for MI Link.

If any decision-driving input is unknown, do **not** use a silent “safe default”. The output must include:

- `recommendationStatus: provisional`
- `Blocking evidence: <missing input>`
- `Next action: run assessment and dependency discovery`

Every recommendation carries:

- `confidence: high | medium | low`
- `recommendationStatus: provisional | validated`
- `assumptions[]`
- `unknowns[]`
- `hardBlockers[]`
- `evidenceRequired[]`

Confidence rules:

- **High**: measured/tool-confirmed evidence is present for dependencies, performance/sizing, regional features, and cutover feasibility; interview-only answers can never exceed **medium**.
- **Medium**: triage answers are complete and internally consistent, but dependency/performance evidence is not yet tool-confirmed.
- **Low**: one or more decision-driving unknowns remain, answers conflict, or a candidate depends on unverified remediation.

`provisional` is the default and the only possible `recommendationStatus` from interview answers alone. `validated` requires **all** of:

- tool-confirmed dependency inventory / assessment run;
- measured performance and sizing data;
- confirmed target-region feature availability;
- explicit architect sign-off.

If any checklist item is missing, keep `recommendationStatus: provisional`.

## Scoring and ranking

1. **Phase A — Eligibility trace**: list target status and one-line reason.
   - SQL VM, AVS, SQL MI, SQL DB, Fabric SQL DB, Arc-enabled SQL MI, SQL Server container, Arc in-place/control plane.
2. **Phase B — Ranking**: for `eligible` / `eligible_with_remediation` targets, compare refactoring effort, downtime, operational burden, compatibility, resilience, cost levers, reversibility, and sovereignty.
3. **Tier selection**:
   - SQL MI **General Purpose**: default managed lift-and-shift when latency/IOPS are moderate and no BC-only HA/latency/read-scale requirement is known.
   - SQL MI **Business Critical**: low-latency storage, high IOPS/log throughput, strict HA/SLA posture, readable secondary needs, or memory/IO-sensitive OLTP.
   - SQL DB **Hyperscale**: >4 TB, high scale-out/read needs, or heavy write/HTAP pattern.
   - SQL DB **Serverless**: intermittent/dev/workload with acceptable cold-start/auto-pause behavior.
   - SQL DB **Elastic Pool**: many tenants/databases with variable aggregate demand.
   - SQL DB **Business Critical**: low-latency/high-availability single DB requirements.
4. **Method selection** uses target, source location/version/permissions, downtime, size, network, log rate, HA topology, and TDE.

Migration method availability semantics:

| Method | `targetAvailabilityDuringSync` | `businessCutoverDowntime` |
| --- | --- | --- |
| MI Link | `read-only` (secondary queryable) | `< 1 minute` |
| LRS | `unavailable` (RESTORING/NORECOVERY) | `minutes` on GP with a small final backup; **`hours` on Business Critical** while replicas seed |
| Native backup/restore | `not-present` | full restore time |
| Transactional replication | `read-write` | `near-zero` |
| DMS offline | `not-present` | total migration execution time |

Do not call LRS “offline”; call it online migration with expected cutover downtime. Reserve “minimal downtime” for MI Link. For SQL MI Business Critical + LRS, warn that cutover can take hours and prefer MI Link when its prerequisites are satisfiable.

## Output contract — Markdown card

Render readable Markdown, not a code block. The Markdown card is a rendering of the JSON object below.

---

> **Preliminary recommendation — `<profile>`**
> **`<PRIMARY TARGET>`** via **`<METHOD>`** · status **`<provisional|validated>`** · confidence **`<high|medium|low>`**
> KB **`<version>`** · commit **`<sha or n/a>`** · fetched **`<timestamp or n/a>`**

One sentence explaining why this is the recommended assessment path.

**📋 Primary recommendation**

| | Recommendation |
| --- | --- |
| 🎯 **Target / tier** | `<target and tier>` |
| 🔁 **Migration method** | `<method>` |
| 👁️ **Target availability during sync** | `<read-only|unavailable|not-present|read-write>` |
| ⏱️ **Business cutover downtime** | `<near-zero|< 1 minute|minutes|hours|full restore time|total migration execution time>` |
| 🧭 **Assess / orchestrate** | `<SSMS 22|Arc migration|Azure Migrate|modern DMS|Az.DataMigration>` |
| 💰 **Cost view** | `Cost levers only: <AHB/ESU/reservations>; no estimate until sizing/pricing assessment` |

**🥈 Best alternative** — `<target/method>`; wins if `<condition>`.

**🚫 Excluded or constrained targets (Phase A eligibility)**
- **SQL DB** — `<unsupported / eligible_with_remediation / unknown_requires_assessment>: <reason>`
- **SQL MI** — `<status>: <reason>`
- **SQL VM / AVS / Arc / container / Fabric SQL DB** — include only meaningful lines.

**🚧 Blockers & required evidence**
- **`<blocker or unknown>`** → `<remediation or assessment>`

**✅ Assumptions**
- `<assumption>`

**❓ Missing information that could change the decision**
- `<unknown>` → `<why it matters>`

**🔌 Ancillary / remediations** — SSIS → Azure-SSIS IR · SSRS → Power BI paginated · SSAS → AAS/Power BI · SQL Agent → native on MI / Elastic Jobs on SQL DB · linked servers → MI/VM only. Omit if empty.

**⚠️ Biggest risk** — `<single most likely derailment>` and how to defuse it.

**🔗 Evidence links** — Microsoft Learn links used; include caveats for previews/limits.

---

For an **estate**, lead with “Estate strategy”, then a compact table: `Profile · Primary · Alternative · Status/confidence · Key evidence gap`, and expand only the non-obvious profiles.

## Machine-readable JSON contract

Emit this object on request or alongside the card. Unknown values are `null` or arrays in `unknowns`; do not invent data.

```json
{
  "profile": {
    "source": {},
    "workload": {},
    "dependencies": {},
    "businessContinuity": {},
    "security": {},
    "network": {},
    "commercial": {}
  },
  "recommendation": {
    "status": "provisional",
    "primary": {
      "targetAvailabilityDuringSync": null,
      "businessCutoverDowntime": null
    },
    "alternative": {},
    "confidence": "medium",
    "assumptions": [],
    "unknowns": [],
    "hardBlockers": [],
    "requiredAssessments": [],
    "evidence": []
  },
  "knowledgeBase": { "version": "1.6", "commit": "…", "verifiedAt": "…" }
}
```

Field definitions:

- `profile.source`: location, version, edition, OS, compatibility level, permissions/sysadmin status, source HA topology.
- `profile.workload`: scope, largest DB size, workload profile, CPU/memory/IOPS/latency peaks, log generation/change rate, read-scale, tenant variability, intermittent usage.
- `profile.dependencies`: SQL Agent, linked servers, cross-DB, FILESTREAM/FileTable, PolyBase kind, DTC kind, CLR permission set, Service Broker, SSIS/SSRS/SSAS.
- `profile.businessContinuity`: downtime tolerance, RPO, RTO, DR architecture, rollback plan, backup retention/restore requirements.
- `profile.security`: TDE, authentication model, Entra/AD dependencies, sovereignty/compliance.
- `profile.network`: ExpressRoute/WAN, VNet connectivity, DNS, AD, MI Link ports **5022 and 11000–11999** in required directions, app/Blob ports such as 1433/443, Blob reachability.
- `profile.commercial`: Software Assurance, AHB, ESU, reservations, program fit.
- `recommendation.primary`: target, tier, method, `targetAvailabilityDuringSync`, `businessCutoverDowntime`, control plane, rationale, blockers, remediations, cost levers; use the method-semantics table above.
- `recommendation.alternative`: target, tier, method, condition where it wins, trade-offs.
- `recommendation.status`: `provisional` by default; `validated` only after tool-confirmed dependency inventory, measured sizing/performance, confirmed regional feature availability, and explicit architect sign-off.
- `recommendation.hardBlockers`: facts that make a target/method impossible.
- `recommendation.requiredAssessments`: SSMS 22, Azure Migrate, Arc migration assessment, modern DMS, dependency discovery, Extended Events + RML/OStress validation, Query Store/DMV analysis.
- `recommendation.evidence`: KB rules, Microsoft Learn links, assessment artifacts, measured baselines.
- `knowledgeBase`: version, commit SHA if known, and fetch/verification timestamp.

## Guardrails

- State the honest positioning: this skill is a **discovery and pre-selection assistant** for SQL Server → Azure migration paths and requires mandatory validation by assessment tooling and an architect.
- If answers conflict, show the conflict and the trade-off instead of forcing a target.
- Never treat “not sure” as permission to ignore a decision-driving blocker.
- Always include Phase A exclusion reasons and the missing information that could change the decision.
- Always state the biggest risk, commonly ports, TDE certificate order, network throughput, Business Critical LRS replica-seeding cutover duration, or dependency-map gaps. Keep the risk; do not cite unsupported statistics.
- Use Microsoft Learn evidence links where possible.
- For performance-sensitive workloads, recommend capture with Extended Events, replay with RML Utilities / OStress, and analysis with Query Store + DMVs.
