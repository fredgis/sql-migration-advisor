# Decision rules — SQL Server → Azure (deterministic fallback)

Apply Steps **A → D** in order. Steps map to the two engine phases:
- **Phase A — Eligibility filter:** Step A only. Classify every target as `eligible`, `eligible_with_remediation`, `unsupported`, or `unknown_requires_assessment`.
- **Phase B — Ranking and plan:** Steps B → D. Rank only surviving targets, then choose method, tier, blockers, cost, and assessment.

Determinism contract: **same inputs + same KB version + same engine version ⇒ same result**. Every recommendation must carry the KB version, engine version, and, when available, the source commit SHA and fetch timestamp.
Source of truth: `docs/sql-server-to-azure-migration.md` (sql-migration-advisor), **v1.12**, verified August 2026.

Three layers, never mixed:
- **Target** = where the DB ends up (runtime).
- **Control plane** = how you assess/orchestrate (Azure Migrate, Arc, SSMS 22, DMS).
- **Method** = the data-movement vehicle (MI Link, LRS, backup/restore, replication, ...).

---

## Step A — Phase A eligibility filter, then target shortlist

### A0. Required input normalization

Normalize questionnaire/free-form answers into these fields before filtering:

| Field | Values used by rules |
| --- | --- |
| `intent` | migrate now · modernize in place / not ready · assessment-only |
| `driver` | end-of-support/ESU · cost · app modernization · data-center exit · analytics/Fabric · sovereignty/edge · modernize in place / not ready |
| `source_location` | on-prem / Azure VM · AWS EC2 · AWS RDS for SQL Server · GCP Compute Engine · GCP Cloud SQL for SQL Server |
| `source_version` | 2008/2008 R2 · 2012 · 2014 · 2016 · 2017/2019 · 2022 · 2025 |
| `source_os` | Windows Server · Linux · unknown. Gates MI Link only through the host rule below: MI Link runs on **Windows Server for every supported version, and on Linux from SQL Server 2017 onwards**; SQL Server 2016 is **Windows Server only**. Microsoft publishes no Windows Server version floor of its own for MI Link, so do not invent one: the host OS simply has to be supported by that SQL Server version. |
| `source_edition` | Enterprise · Standard · Developer · Express · Web · unknown. Gates MI Link, which requires **Enterprise, Standard or Developer**. |
| `management_model` | fully managed PaaS · need OS/file-system/engine control · Kubernetes on-prem/edge/multicloud |
| `kubernetes_model` | managed engine via Arc data controller · full DIY container · unknown |
| `feature_dependencies` | FILESTREAM/FileTable · PolyBase/cloud files · PolyBase/external RDBMS · PolyBase/unknown · homogeneous SQL↔SQL DTC · heterogeneous DTC · DTC/unknown · linked servers · SQL Agent · SQL CLR · Service Broker/intra-instance · Service Broker/cross-instance · Service Broker/unknown · cross-DB queries |
| `fabric_constraints` | DACPAC size, Private Link need, on-prem gateway acceptable, preview acceptable |
| `database_count` | integer — total databases in scope. Drives MI Link capacity (100 GP/BC, 500 Next-gen GP) and the estate-discovery branch. Never inferred from free-text size. |
| `migration_batch_size` | integer — databases selected per Azure Arc portal migration batch. Checked against the Arc wizard limit, not against MI Link capacity. |
| `arc_extension_version` | Azure Extension for SQL Server version (e.g. `1.1.3348.364`). Gates the Arc wizard batch limit; **unknown is not treated as recent** — it yields `unknown_requires_assessment`. |
| `evidence` | typed booleans: `dependenciesToolConfirmed` · `performanceMeasured` · `regionAvailabilityConfirmed` · `architectSignedOff`. All four `true` are required for `validated`; free text never substitutes. |
| `downtime`, `network_ports`, `size`, `tenant_count`, `performance`, `compliance` | used in Steps B→D; engine outputs include `targetAvailabilityDuringSync`, `businessCutoverDowntime`, and cost flags such as `ahbEligible` |

If a selected feature lacks a subtype needed for a hard rule (for example `PolyBase` with no source type, or `DTC` with no participant type), mark the affected candidate `unknown_requires_assessment`; do **not** silently pick the safer target.

For `ahbEligible`, derive the flag in Step D from the selected target, SQL DB purchasing model, compute tier, and whether Hyperscale is a new database or the documented qualifying existing provisioned-compute exception; do not treat every vCore SQL DB as eligible.

**Output consistency rule (must always hold).** The recommended target and method must never contradict the
eligibility table the engine just produced:
- The `primaryTarget` must be `eligible` or `eligible_with_remediation`. Never recommend a target that the
  same run marked `unsupported`.
- The chosen `method` must be viable for that target *and* satisfy its own gates (source version range,
  ports, source type, capacity). A method whose gates fail is not selectable, even as a fallback.
- If no target survives with a viable method, do **not** invent one: return a **provisional shortlist**
  with `recommendationStatus: provisional`, the reason each candidate was excluded, and the assessment to
  run next.
- Worked case: SQL Server **2025** source, MI Link blocked (ports or prerequisites) and Azure SQL Database
  incompatible ⇒ LRS is **not** a legal fallback (standalone LRS supports 2008–2022 only), so the answer is
  **SQL Server on Azure VM** — or a provisional shortlist — never "Azure SQL MI via LRS".

### A1. Candidate target eligibility states

Classify each target independently. Only `eligible` and `eligible_with_remediation` survive to Phase B. `unknown_requires_assessment` may be shown as provisional but cannot be the final validated recommendation.

| Candidate target | `unsupported` hard blockers | `eligible_with_remediation` examples | Notes |
| --- | --- | --- | --- |
| **SQL Server enabled by Azure Arc** *(control plane, in-place)* | none for assessment/control-plane use | Arc onboarding, agent/network prerequisites, paid on-prem ESU | Not a runtime migration target. Use when intent is assess/modernize in place/not ready. |
| **SQL Server on Azure VM** | none of these rules eliminate it | right-size VM/storage, HA design, patch/backup operations, TDE cert migration | Maximum compatibility and OS/engine control; free ESU only for SQL Server 2014 and earlier; SQL Server 2016 ESU is paid even on Azure VM. |
| **Azure VMware Solution (AVS)** | not a VMware estate or no need to keep VMware operational model | HCX/vMotion readiness, AVS capacity/networking | Rehost VMware estate with minimal refactor; keeps FCI/AG patterns. |
| **Azure SQL Managed Instance (MI)** | FILESTREAM/FileTable; PolyBase to external RDBMS; heterogeneous DTC to third-party RDBMS; need OS/file-system access; unsupported third-party linked server dependency | SQL Agent jobs usually native; **Service Broker intra-instance is eligible**; **Service Broker cross-instance is in public preview** and therefore gated on `previewAcceptable`; SQL CLR/cross-DB usually compatible but assess; cloud-file PolyBase eligible; homogeneous SQL↔SQL DTC eligible | PaaS lift-and-shift for instance features. Service Broker within a single instance is fully supported. Cross-instance message exchange, MI-to-MI and SQL Server-to-MI, is in **public preview**: `CREATE ROUTE`/`ALTER ROUTE` must specify port 4022, transport security only (`CREATE REMOTE SERVICE BINDING` unsupported). Treat it exactly like the Fabric Migration Assistant: preview refusal removes the capability, never the MI target. Unknown scope still requires a topology assessment. |
| **Azure SQL Database** | FILESTREAM/FileTable; linked servers; cross-database three-part-name dependency; instance-level CLR/Service Broker dependency; native restore requirement; DTC dependency | refactor SQL Agent jobs to Elastic Jobs/Automation, refactor cross-DB/linked-server patterns, use contained DB model | Use for cloud-native DB-scoped workloads after dependencies are removed. |
| **SQL database in Fabric** *(GA target; Migration Assistant in Preview)* | complex enterprise OLTP dependency set that the Fabric SQL surface does not support; no viable ingestion path at all | use T-SQL, transactional replication, Fabric pipelines / Data Factory copy jobs, Dataflow Gen2, or TDS-capable tools; if using the Fabric Migration Assistant Preview specifically, its limits are DACPAC > 20 MB, requires Private Link, or cannot use the required on-prem gateway | The target is GA — do **not** apply a target-level preview blocker. Preview acceptance is a *method* gate on the Fabric Migration Assistant only: when preview is unacceptable, keep evaluating the non-assistant ingestion paths. Rank it ahead of general SQL DB when the driver/profile is Fabric analytics; a non-analytics driver lowers its ranking but does not make it `unsupported`. |
| **Arc-enabled SQL Managed Instance** | no Kubernetes/edge/sovereign requirement; Kubernetes model = full DIY container | Arc data controller prerequisites, storage class, network, HA sizing | Managed engine on Kubernetes: auto patch/backup/HA through Arc data services. |
| **SQL Server in a container** | requires managed PaaS/managed engine and will not operate DIY | backup/HA/patch/runbook must be built by customer | Dev/test/edge or full DIY containerized SQL Server. |

### A2. Hard compatibility rules (Phase A only)

These are filters, not preferences:

| Dependency / answer | MI | SQL DB | SQL VM / AVS / container | Rule |
| --- | --- | --- | --- | --- |
| FILESTREAM / FileTable | `unsupported` | `unsupported` | `eligible` | Hard MI/SQL DB incompatibility. Do not bundle with PolyBase/DTC. |
| PolyBase over Blob / ADLS Gen2 cloud files using `OPENROWSET(BULK)`, external tables or CETAS; CSV/Parquet | `eligible` | assess separately | `eligible` | SQL MI supports cloud-file virtualization. Delta Lake, pushdown, and S3 are not supported. |
| PolyBase connector to Oracle, Teradata, MongoDB, another SQL Server, or other external RDBMS | `unsupported` | `unsupported` unless refactored | `eligible` | MI does not support PolyBase external RDBMS connectors. |
| PolyBase selected but source type unknown | `unknown_requires_assessment` | `unknown_requires_assessment` | `eligible` | Evidence required: list external data sources/connectors. |
| Homogeneous SQL↔SQL T-SQL DTC (MI↔MI or MI↔SQL Server) | `eligible` | `unsupported` for DTC to SQL DB | `eligible` | MI managed DTC supports SQL-to-SQL distributed transactions; port 135 **inbound and outbound**, 14000–15000 inbound, 49152–65535 outbound. Prefer native elastic transactions for all-MI cross-DB work. |
| Heterogeneous DTC to third-party RDBMS | `unsupported` | `unsupported` | `eligible` | Use SQL VM or refactor the transaction boundary. |
| DTC selected but participants unknown | `unknown_requires_assessment` | `unknown_requires_assessment` | `eligible` | Evidence required: transaction participants and linked-server map. |
| Linked servers | `eligible_with_remediation` for supported SQL/OLE DB patterns; third-party RDBMS must be assessed | `unsupported` unless refactored | `eligible` | Hard SQL DB blocker; possible MI blocker when third-party RDBMS is mandatory. |
| SQL Agent jobs | `eligible` | `eligible_with_remediation` | `eligible` | SQL DB requires Elastic Jobs/Automation; this is ranking/remediation, not a hard blocker unless jobs cannot be refactored. |
| Need OS/file-system/exact engine control/third-party agents | `unsupported` | `unsupported` | `eligible` | Target SQL VM, AVS, or full DIY container. |

### A3. Reachable target selection order after filtering

Use this order to produce the target shortlist; it prevents masked branches.

1. **Arc in-place / assess first** → SQL Server enabled by Azure Arc control plane.
   Trigger when **any** condition is true:
   - `intent = assessment-only`;
   - `intent = modernize in place / not ready`;
   - `driver = modernize in place / not ready`;
   - user says they are **not ready to move**, want to **assess first**, need **ESU while staying**, or want an **Arc assessment** before choosing a target.
   Output as a control-plane recommendation, not a runtime target.

2. **VMware data-center exit with VMware continuity required** → AVS, if the source is VMware and `driver = data-center exit`. Otherwise keep SQL VM in the shortlist for rehost.

3. **Kubernetes / edge / sovereign-multicloud**:
   - `management_model = Kubernetes on-prem/edge/multicloud` + `kubernetes_model = managed engine via Arc data controller` → Arc-enabled SQL MI.
   - `management_model = Kubernetes on-prem/edge/multicloud` + `kubernetes_model = full DIY container` → SQL Server in a container.
   - `management_model = Kubernetes on-prem/edge/multicloud` + `kubernetes_model = unknown` → `unknown_requires_assessment`; ask/record evidence. Safe default: do **not** silently pick Arc MI or container.

4. **Fabric analytics branch before generic SQL DB**:
   If `driver = analytics/Fabric` or workload profile = BI/analytics-first, evaluate **SQL database in Fabric** before Azure SQL Database. The target is **GA**, so `previewAcceptable=false` does not eliminate it — it only rules out the Fabric Migration Assistant, and the target survives whenever another ingestion path fits (T-SQL, transactional replication, Fabric pipelines / Data Factory copy jobs, Dataflow Gen2, TDS-capable tools). Apply the DACPAC ≤ 20 MB, no-Private-Link and on-prem-gateway checks only when the selected path is the Migration Assistant. Mark Fabric `unsupported` or `eligible_with_remediation` only on an actual target-surface or ingestion blocker, then continue to SQL DB/MI/VM.

5. **Maximum compatibility / OS control**:
   If Phase A leaves only VM-class targets, choose SQL VM unless AVS or container criteria above are stronger.

6. **Managed lift-and-shift**:
   If MI is eligible and the workload has instance dependencies (SQL Agent, cross-DB queries, linked servers, SQL CLR, Service Broker, homogeneous SQL DTC), shortlist **Azure SQL MI**.

7. **Cloud-native DB-scoped**:
   If SQL DB is eligible and there are no unresolved instance dependencies, shortlist **Azure SQL Database**.

### A4. Cross-cloud source capability matrix

| Source | MI Link | LRS | DMS | Native backup/restore | Txn replication | BACPAC/bcp/ADF |
|---|---|---|---|---|---|---|
| On-prem / Azure VM | ✅ 2016+ + 5022 + 11000–11999 + networking | ✅ 2008–2022 | ✅ | ✅ direct `BACKUP TO URL` (2012 SP1 CU2+) | ✅ 2016+ | ✅ |
| AWS EC2 | ✅ if sysadmin + AG + 5022 + 11000–11999 + networking | ✅ via Blob upload | ✅ | ✅ via Blob upload | ✅ if sysadmin | ✅ |
| **AWS RDS for SQL Server** | ❌ no sysadmin / no AG endpoints | ✅ via S3→Blob upload | ✅ offline to Azure SQL DB / MI / VM; ✅ online only to MI / VM (not Azure SQL DB) | ⚠️ indirect (S3→Blob→restore) | ❌ not practical — requires sysadmin/distributor rights the platform does not grant | ✅ |
| GCP Compute Engine | ✅ if sysadmin + AG + 5022 + 11000–11999 + networking | ✅ via Blob upload | ✅ | ✅ via Blob upload | ✅ if sysadmin | ✅ |
| **GCP Cloud SQL for SQL Server** | ❌ no sysadmin / no AG endpoints | ✅ via export→Blob | ✅ | ⚠️ indirect | ❌ not practical — requires sysadmin/distributor rights the platform does not grant | ✅ |

MI Link prerequisites: SQL Server 2016+, Enterprise / Standard / Developer edition, a host OS supported by that SQL Server version (Windows Server throughout, Linux from SQL Server 2017 onwards, SQL Server 2016 being Windows Server only), sysadmin on source, distributed availability groups, ability to create AG endpoints, VNet connectivity, and documented MI Link ports. Required ports are: MI subnet NSG inbound **5022** and **11000–11999** from the SQL Server IP; MI subnet NSG outbound **5022** to the SQL Server IP (Microsoft's table states MI NSG allows 5022 + 11000–11999 both directions); SQL Server host OS/corporate firewall inbound **5022** from the MI subnet /24; SQL Server host OS/corporate firewall outbound **5022** and **11000–11999** to the MI subnet. Ports **11000–11999** carry the MI-side distributed-AG HADR data-replication channel; the MI-side HadrPort is dynamically assigned in that range and visible in `sys.dm_hadr_fabric_config_parameters`. MI-side ports cannot be customized; the SQL Server-side endpoint port can. If **5022** or **11000–11999** cannot be opened in the required directions, set MI Link `unsupported`. The fallback is **LRS only when LRS itself qualifies**: source SQL Server 2008–2022, all LRS prerequisites met, and the migration able to complete inside the 30-day maximum window. For a SQL Server 2025 source, or a window that cannot be met, evaluate another supported method or target, or return a provisional shortlist — never fall through to LRS unconditionally. This gate is always required, independent of tier, update policy, VPN, ExpressRoute, or peering. Therefore MI Link is impossible from AWS RDS for SQL Server and GCP Cloud SQL for SQL Server.

---

## Step B — Phase B ranking, tier, and migration method

### B1. Ranking criteria for surviving targets

Score/rank only candidates whose Phase A state is `eligible` or `eligible_with_remediation`. Use named criteria; do not reintroduce hard blockers here.

| Criterion | Prefer higher score when... |
| --- | --- |
| Refactoring effort | fewer app/schema/job/security changes are required |
| Downtime fit | method output `businessCutoverDowntime` meets the requested window; `targetAvailabilityDuringSync` is acceptable |
| Operational burden | managed service reduces patch/backup/HA work the customer does not want |
| Compatibility | target preserves required features and version behavior |
| Resilience | SLA, HA, zone redundancy, read-scale and DR needs are met |
| Cost | AHB/reservations/ESU/sizing lower total cost without violating constraints |
| Reversibility | rollback/failback path is practical, e.g., MI Link reverse failback |
| Sovereignty constraints | target/control plane fits residency, disconnected, edge, or sovereign needs |

Soft preferences live here: prefer MI over SQL DB when SQL Agent/cross-DB/linked-server patterns exist; prefer SQL DB over MI for simple cloud-native DB-scoped apps; prefer VM/Arc for strict sovereignty or OS control.

### B2. Tier selection rules

If a tier-driving input is missing, emit `unknown_requires_assessment` for tier and list the evidence. Do not default to General Purpose just because nothing else is known.

#### Azure SQL Managed Instance tier

| Inputs | Tier result |
| --- | --- |
| Low-latency storage required, high IOPS/log throughput, heavy tempdb, in-memory OLTP, read-scale secondary, highest HA/resilience, or SLA/latency target cannot tolerate remote storage | **MI Business Critical** |
| 101–500 databases or MI Links on a single instance, up to 128 vCores, up to 32 TB, or configurable IOPS/memory required — and Business Critical-only features and its latency floor are not required | **MI Next-gen General Purpose** *(GA)* |
| Moderate latency/IO, general enterprise workload, cost-sensitive, no read-scale secondary, no high log throughput requirement | **MI General Purpose** |
| More than 500 databases or links on one instance | Next-gen General Purpose is still capped at 500 — plan **multiple instances** |
| `performance.latency`, `performance.iops`, `performance.log_throughput`, and `resilience.read_scale/SLA` unknown | `unknown_requires_assessment` — require Perfmon/DMV baseline, wait stats, log generation rate, HA/read-scale requirement |

#### Azure SQL Database service tier/model

| Inputs | Tier/model result |
| --- | --- |
| Database size > 4 TB and ≤ 128 TB, very fast scale-out storage, large OLTP, HTAP, rapid backup/restore needs | **Hyperscale**. The 128 TB ceiling is per single database; inside a Hyperscale elastic pool the per-database maximum is **100 TB** |
| Single database > 128 TB (the Hyperscale maximum) | Hyperscale is **not** selectable. SQL MI is **not** an as-is destination either: its per-instance storage ceiling is far below 128 TB. Require a sharding plan across databases or instances, or shortlist **SQL VM** subject to its storage design; otherwise the workload needs redesign |
| Strict lowest-latency IO, high transaction log rate, zone-redundant high SLA target, read-scale replica need, in-memory OLTP | **Business Critical** |
| General steady workload, moderate IO/latency, cost-sensitive, size within GP limits | **General Purpose** |
| Intermittent/dev/test/seasonal usage with idle periods and auto-pause acceptable | **Serverless** |
| Many tenants/databases with variable utilization and shared budget | **Elastic Pool**; large/noisy tenants may use Hyperscale or single DB |
| Tier-driving inputs unknown: size, latency, IOPS/log rate, SLA, read-scale, usage pattern, tenant count/variability | `unknown_requires_assessment` — require performance baseline and tenancy profile |

### B3. Pick the method (given target + downtime + version + source + network)

#### → SQL Server on Azure VM

| Downtime wanted | Method | Gate |
| --- | --- | --- |
| Near-zero | **Distributed AG** or **Always On AG** | Distributed AG: source **2016+**. Always On AG: source **2012+**. Both: AD DS or workgroup AG + certs, AG endpoints, ports open, planned failover window |
| Minimal | **Log shipping** | Windows source and log backup chain feasible |
| Offline | **Native backup/restore** — direct `BACKUP TO URL` from **2012 SP1 CU2+**, or local backup + upload below that build or when URL prerequisites are unavailable; detach/attach for special large-file cases | Confirm the build for SQL Server 2012 (SP1 CU2 or later). 2012/2014 use page blob + storage-account credential, 1 TB max; 2016+ use block blob + SAS, up to 12.8 TB striped. TDE cert installed first when encrypted |
| Whole VM/instance | **Azure Migrate** replication | use for rehost/business case; validate SQL consistency |
| Multi-TB / limited WAN | **Data Box** seed → sync delta | test one full backup/AzCopy/Data Box run |

Arc-enabled source: SQL migration in Azure Arc can orchestrate offline native backup/restore lift-and-shift to SQL VM and can be a phased on-ramp to MI/SQL DB later.

#### → AVS

- **VMware HCX / vMotion**. No DMS/MI Link; preserve VMware operational model and existing SQL HA patterns.

#### → Azure SQL Managed Instance

| Downtime wanted | Method | Gate |
| --- | --- | --- |
| Near-zero / online | **MI Link** | SQL Server 2016+, **Enterprise / Standard / Developer edition**, and a host OS supported by that SQL Server version: Windows Server on every supported version, plus **Linux from SQL Server 2017** onwards (SQL Server 2016 is Windows Server only). Also sysadmin, distributed AG, AG endpoint creation, required 5022 + 11000–11999 ports, VNet connectivity; not possible from AWS RDS/GCP Cloud SQL. Unknown OS or edition makes the method `unknown_requires_assessment`; an unsupported edition, or a Linux host below SQL Server 2017, eliminates **MI Link only**, never the MI target. When the migration is driven from the **Azure Arc portal**, that path is documented as Windows Server only, so a Linux host keeps MI Link but loses the Arc-portal orchestration |
| Online migration / planned cutover | **Log Replay Service (LRS)** standalone | SQL Server 2008–2022 (**not 2025**); sources include SQL on VMs, AWS EC2, AWS RDS, GCP Compute Engine, GCP Cloud SQL; public endpoint/storage access; **the initial restore and log replay must complete inside the 30-day maximum window**; target is `unavailable` (RESTORING/NORECOVERY) during sync |
| Offline / simplest | **Native backup/restore (.bak)** | SQL Server 2008+; install TDE cert in destination `master` first; master/msdb not restorable |
| Online subset | **Transactional replication** | use when tables/articles fit and publisher rights exist |
| Data-only / bulk | bcp / Smart Bulk Copy / BACPAC / ADF | data movement only; validate schema/features separately |

LRS and Arc version paths:
- **Standalone LRS** (PowerShell/CLI/API): SQL Server **2008–2022**. SQL Server **2012 SP1 CU2+** can `BACKUP TO URL` directly to Blob (page blob to 1 TB on 2012/2014, block blob + SAS to 12.8 TB on 2016+); older builds back up locally, then upload.
- **Arc-enabled SQL Server overall migration experience:** SQL Server **2014+**.
- **Arc → Azure SQL MI via MI Link:** SQL Server **2016+**, and this path is documented as **Windows Server only**, unlike MI Link configured outside the Arc portal.
- **Arc → Azure SQL MI via LRS:** Microsoft documents a method-table floor of SQL Server **2012+** and Windows Server **2012+**, but this contradicts the same page's **2014+** overall Arc experience floor. Conservative engine rule: require Arc experience floor **2014+** for Arc-orchestrated LRS; standalone LRS outside Arc remains **2008–2022**. Note that the LRS-specific pages also list SQL Server 2012 among supported sources — that is consistent with the standalone **2008–2022** range and is *not* evidence of a 2012 floor for the Arc experience.
- **Arc → SQL Server on Azure VM:** SQL Server **2014+**.

MI migration capacity gates:
| Method/control plane | Capacity rule |
| --- | --- |
| **MI Link** | Up to **100 links** on MI General Purpose and Business Critical; up to **500 links** on Next-gen General Purpose. One link = one database. |
| **Azure Arc portal migration wizard** | Batch-selection UI limit: up to **10 databases** per batch with Azure Extension for SQL Server **1.1.3348.364+**; earlier extension versions select one database at a time. This is not MI Link capacity. |
| **LRS** | Supports up to the MI service-tier database limit (100 GP / 500 Next-gen GP), with **100 simultaneous restores per instance** and **150 per subscription**. |

#### → Azure SQL Database

| Downtime wanted | Method | Gate |
| --- | --- | --- |
| Offline | **modern DMS (offline)** | SQL Server 2008+; online SQL DB path not available |
| Offline | **BACPAC / SqlPackage** | smaller/medium or schema-compatible workloads; test export/import |
| Online subset | **Transactional replication** | target-specific publisher floor: Azure SQL Database subscriber = publisher SQL Server **2016 and later**, including SQL Server 2022 and 2025; Fabric SQL database subscriber = SQL Server **2022 RTM CU12 and greater**; SQL DB/Fabric can only be a push subscriber |
| Online / CDC | **Striim (third-party)** | use for SQL Server → Azure SQL Database when online/near-zero downtime is required; pair with DMS/SqlPackage/SSMS schema assessment and migration |
| Bulk / integration | bcp / Smart Bulk Copy / **ADF Copy** | data-only or integration pipeline |

Transactional replication to Azure SQL DB/Fabric SQL DB: snapshot + one-way transactional only; no peer-to-peer and no merge. Tables need a primary key. Unsupported/limited articles include `hierarchyid`, FILESTREAM, spatial conversions, plus documented partitioning/index limits. Distribution database and replication agents cannot live in Azure SQL Database. Fabric SQL database publisher needs SQL Server 2022 RTM CU12+, and Private Link is not supported for replication into Fabric SQL database. For Azure SQL MI subscribers, publisher floor is SQL Server 2016+ and exact combinations depend on the MI update policy/supportability matrix.

Not supported to SQL DB: native `.bak` restore, detach/attach, MI Link, local SQL Agent, linked servers, DTC.

#### → SQL database in Fabric (GA target; Migration Assistant in Preview)

- **Fabric Migration Assistant (Preview)**: schema via **DACPAC ≤ 20 MB**; data via **Fabric Data Factory copy job** + **on-prem data gateway**. No VNet gateway/Private Link for the assistant. `targetAvailabilityDuringSync=not-present`, `businessCutoverDowntime=full load time`; use for Fabric-native/analytics-first simple schemas, not broad enterprise OLTP by default. **`previewAcceptable=false` disqualifies this method only, never the target.** Alternative Fabric SQL database ingestion paths include T-SQL, transactional replication (SQL Server 2022 RTM CU12+ publisher), Fabric pipelines / Data Factory copy jobs, Dataflow Gen2, and any TDS-capable tool; do not eliminate Fabric solely because assistant limits do not fit.

#### → Arc-enabled SQL MI / container

- **Arc-enabled SQL MI:** native backup/restore and MI-compatible data movement after endpoint is available; operate through Arc data controller.
- **Container:** backup/restore via mounted volume, detach/attach where appropriate, BACPAC, bcp, ADF. Customer owns HA/patch/backup.

#### Large estates / multi-TB (any target) — seed-then-sync

Ship the initial full backup via Data Box or AzCopy over ExpressRoute, then catch up the delta with LRS / MI Link / transactional replication / log shipping before cutover. Do not size cutover as `size ÷ bandwidth`; test one full backup plus upload/restore path first and plan rollback.

---

## Step C — Blockers, validation, uncertainty, and output status

### C1. Migration availability and cutover downtime outputs

The source-of-truth downtime model is the pair `targetAvailabilityDuringSync` + `businessCutoverDowntime`. A coarse `downtimeClass` may be emitted for cards, but it must be derived from `businessCutoverDowntime`.

| Method | `targetAvailabilityDuringSync` | `businessCutoverDowntime` | Derived `downtimeClass` |
| --- | --- | --- | --- |
| **MI Link** | `read-only` (secondary queryable) | `< 1 minute` | `minimal` |
| **LRS** | `unavailable` (RESTORING / NORECOVERY; no read or write) | `minutes` on General Purpose when the final backup is small; `hours` on Business Critical because the database seeds to secondary replicas before availability | `planned-cutover` |
| **Native backup/restore** | `not-present` | `full restore time` | `extended` |
| **Transactional replication** | `read-write` (subscriber accessible) | `near-zero` | `minimal` |
| **DMS offline** | `not-present` | `total migration execution time` | `extended` |
| **Distributed / Always On AG** | `read-only` (readable secondary, if configured) | `near-zero` (planned failover) | `minimal` |
| **Log shipping** | `unavailable` (standby/restoring) | `minimal` | `minimal` |
| **BACPAC / bcp / ADF / Data Box** | `not-present` | `full load time` | `extended` |

Rules:
- For LRS, emit `targetAvailabilityDuringSync=unavailable` and a planned cutover duration; do not use the extended/load-time class.
- If `target = Azure SQL MI Business Critical` and `method = LRS`, add warning `lrsBusinessCriticalCutoverCanTakeHours=true`; rank MI Link higher whenever all MI Link prerequisites are satisfiable.
- Reserve `minimal downtime` wording for MI Link when comparing MI migration methods.

### C2. Cutover blockers and remediations

| Blocker | Remediation |
| --- | --- |
| **TDE encrypted DB** | Install the server-level TDE certificate in the destination `master` before native restore; restore fails unless the certificate is present first. |
| **Windows logins** | DMS may skip them unless enabled; grant MI read to Entra ID where needed; script/recreate logins and users. |
| **MI Link ports** | Open required **5022** and **11000–11999** directions: MI NSG inbound 5022 + 11000–11999 from SQL Server IP; MI NSG outbound 5022 to SQL Server IP; SQL Server host/corporate firewall inbound 5022 from MI subnet /24; SQL Server host/corporate firewall outbound 5022 + 11000–11999 to MI subnet. If either port set cannot be opened, MI Link is `unsupported`. Choose LRS **only when LRS itself qualifies**: source SQL Server 2008–2022, storage and public-endpoint access available, and the migration able to finish inside the 30-day maximum window. Otherwise evaluate another supported method or target, or return a provisional shortlist. |
| **Retained server name / DNS redirect to MI** | When the migration keeps the source server name and repoints DNS at Managed Instance, inventory clients that rely on TLS hostname validation or set `HostNameInCertificate`, and test them against the target MI certificate **before** the DNS cutover. Update client settings for the target certificate behaviour. Unknown client inventory ⇒ `unknown_requires_assessment` for the cutover, not a silent pass. |
| **MI managed DTC ports** | For SQL↔SQL DTC on MI, validate port 135 **both inbound and outbound**, port range 14000–15000 inbound, and 49152–65535 outbound, in both the SQL managed instance subnet NSG and any firewall in the external environment. Opening 135 inbound only is a common mistake: MI-initiated calls to the external participant's RPC endpoint mapper then fail after cutover. |
| Other methods' network | DMS/LRS/replication need outbound **443** to Blob, **1433** (+ **1434/UDP** for named instances where applicable). |
| **DAG / AG** | Requires AD Domain Services or workgroup AG + certificates; validate quorum and endpoint security. |
| **Transactional replication → SQL DB/Fabric SQL DB/MI** | SQL DB subscriber: publisher SQL Server 2016+; Fabric SQL database subscriber: publisher SQL Server 2022 RTM CU12+ and Private Link unsupported; MI subscriber: publisher SQL Server 2016+ with update-policy matrix check. SQL DB/Fabric are push-subscriber only; primary keys required; snapshot/one-way transactional only; distribution DB and agents cannot live in Azure SQL Database; article limits apply. |
| **SQL Agent jobs** | MI: native SQL Agent. SQL DB: refactor to Elastic Jobs, Automation, Functions, or external scheduler. |
| **Linked servers / cross-DB** | OK on VM and often MI after provider validation; not on SQL DB; refactor or choose MI/VM. |
| **SSIS** | Migrate to Azure-SSIS Integration Runtime; handle SSISDB separately. |
| **SSRS** | Move RDL workloads to **Power BI paginated reports** for managed cloud, or use **Power BI Report Server on a VM** when the managed service does not fit. Starting with SQL Server 2025 (17.x), on-premises reporting services is consolidated under Power BI Report Server; no new SSRS versions after SSRS 2022, which is supported until 11 Jan 2033. |
| **SSAS** | Move to Azure Analysis Services or Power BI Premium/Fabric semantic models. |
| Dependency gap | Undocumented linked servers, jobs, file access, CLR, DTC, and external data sources commonly derail migrations; run dependency discovery before committing. |

### C3. Pre-cutover validation

For performance-sensitive workloads: capture with **Extended Events**, replay with **RML Utilities / OStress**, and analyse with **Query Store** plus DMVs. Do not recommend retired DEA. Distributed Replay is deprecated as of SQL Server 2022 and unavailable in SQL Server 2022+.

### C4. Confidence and provisional status contract

Every output must include:

```yaml
confidence: high|medium|low
assumptions: []
unknowns: []
hardBlockers: []
evidenceRequired: []
recommendationStatus: provisional|validated
```

Decision-driving unknowns are: linked servers/provider targets, SQL Agent job criticality, FILESTREAM/FileTable, DTC participants, PolyBase/external data source types, source platform privileges (sysadmin/AG endpoints), network ports for selected online method, TDE status/cert availability, database size, tier-driving performance inputs, sovereignty/disconnected constraints, and Fabric preview/Private Link/gateway constraints.

Rules:
- Unknown on a decision-driving dependency ⇒ `recommendationStatus: provisional`, add `evidenceRequired`, and name the next assessment (Azure Migrate/Arc discovery/SSMS 22 assessment/scripts/Perfmon/DMVs).
- `confidence = high` only when all hard blockers and tier-driving inputs are known and the chosen method gates are satisfied.
- `confidence = medium` when only non-blocking remediation details remain.
- `confidence = low` when any candidate is `unknown_requires_assessment` on a decision-driving dependency.
- Never turn an unknown into a silent safe default.

---

## Step D — Cost levers, program fit, assessment tool

### D1. Cost and sizing levers

- **Azure Hybrid Benefit (AHB):** applies to Azure SQL Database General Purpose / Business Critical in the vCore provisioned compute tier, SQL MI, and SQL VM; not Fabric SQL DB, DTU, serverless, or new Hyperscale databases. Hyperscale carries a **creation-date cohort**: AHB can only be applied to Hyperscale single databases with provisioned compute **created before 15 December 2023**, and only until December 2026, after which they too move to the simplified pricing. A Hyperscale database created on or after that date is **not** AHB-eligible, because the simplified pricing already removed the software licence fee.
- **ESU:** the SQL Server ESU programme now covers **SQL Server 2014 and SQL Server 2016 only**. SQL Server 2014 reached end of support on 9 July 2024 with ESUs available until 8 July 2027; SQL Server 2016 reached end of support on 14 July 2026 with ESUs available until 17 July 2029. ESU is free on Azure VMs / AVS for SQL Server 2014; SQL Server 2016 is paid everywhere, including Azure VM, and materially changes stay-vs-migrate maths. SQL Server 2012 and earlier have no ESU path left at all, so do not describe them as covered: upgrade or migrate. Non-Azure/on-prem/hosted environments subscribe after connecting to Azure Arc, either with Software Assurance under eligible agreements or via Arc-connected PAYG billing without SA.
- Set `ahbEligible=true` only for eligible compute models: SQL MI, SQL VM, SQL DB GP/BC vCore provisioned, and the documented pre-15-December-2023 Hyperscale provisioned exception; set `ahbEligible=false` for DTU, serverless, Fabric SQL DB, and any Hyperscale database created on or after 15 December 2023. Combine AHB + reservations + ESU where eligible; state that savings depend on license position and commitment.
- **Sizing:** never size MI/SQL DB on average CPU alone. Require Perfmon/DMV baseline for at least 7 days, peak windows, storage latency, IOPS, log generation, tempdb, and about 20% headroom.

### D2. Assessment / control plane to run next

| Situation | Control plane / assessment |
| --- | --- |
| DBA-first, Windows, single/few DBs | **SSMS 22 Migration Component** |
| Arc-enabled source or assess-first/in-place | **SQL Server migration in Azure Arc** and Arc best-practices assessment |
| Estate scale / business case / dependency map | **Azure Migrate** appliance/import/Arc discovery |
| Orchestrate at scale / CI-CD | **modern Azure DMS** + **`Az.DataMigration`** |
| Heterogeneous source modernization | **SSMA** for Oracle/Sybase/DB2/MySQL/Access; not for homogeneous SQL→SQL |
| Tier uncertainty | Perfmon/DMVs, Query Store, storage latency, log-rate baseline |

### D3. Microsoft program fit and SLA reference

- Programs: **Cloud Accelerate Factory**, **SQL in a Day** (EMEA EPS Data Motion), **Azure Accelerate / FastTrack**.
- SLA reference: MI Business Critical 99.99%; SQL DB Business Critical zone-redundant up to 99.995%; SQL DB Hyperscale 99.99%; SQL VM depends on VM/AG design.

---

## Retired — never recommend (use the replacement)

| Retired | Date | Use instead |
| --- | --- | --- |
| Database Experimentation Assistant (DEA) | 15 Dec 2024 | Extended Events capture + RML Utilities / OStress replay + Query Store/DMVs |
| Distributed Replay | Deprecated in SQL Server 2022; unavailable in SQL Server 2022+ | RML Utilities / OStress |
| Data Migration Assistant (DMA) | 16 Jul 2025 | SSMS 22 / Arc / Azure Migrate |
| Azure Data Studio + SQL Migration extension | ADS retired 28 Feb 2026; migration extension has no separate announced retirement | VS Code + MSSQL; SSMS 22 / DMS |
| Azure DMS *classic* — SQL scenarios | absorbed into current DMS portal experience | **modern** DMS (portal / PowerShell / CLI) |
| SQL Data Sync | retires 30 Sep 2027 | ADF / transactional replication / AG |

---

## Reverse path / exit notes

- SQL DB exit usually requires BACPAC/scripts/data movement and validation; treat as higher effort.
- MI can use MI Link reverse failback to SQL Server 2022/2025 where prerequisites are met; this improves reversibility ranking.
- SQL VM/AVS/container retain the most traditional backup/restore portability but carry higher operational burden.
