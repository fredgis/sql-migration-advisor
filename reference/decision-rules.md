# Decision rules — SQL Server → Azure

Apply Steps **A → D** in order. Steps map to the two engine phases:
- **Phase A — Eligibility filter:** Step A only. Classify every target as `eligible`, `eligible_with_remediation`, `unsupported`, or `unknown_requires_assessment`.
- **Phase B — Ranking and plan:** Steps B → D. Rank only surviving targets, then choose method, tier, blockers, cost, and assessment.

Regression contract: these rules are a **prompt policy under regression test**. Replaying the same inputs through the rules mirror in `tests/` gives the same result, and 116 golden scenarios enforce it on every commit. The mirror is not what runs in a session: an agent reads these rules and applies them. Treat the contract as a tested policy, not as a guarantee that two runs produce identical wording. Every recommendation must carry the KB version, engine version, and, when available, the source commit SHA and fetch timestamp.
Source of truth: `docs/sql-server-to-azure-migration.md` (sql-migration-advisor), **v3.2**, verified August 2026.

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
| `source_os` | Windows Server · Linux · unknown. Gates MI Link only through the host rule below (**`MI-LINK-HOST`**): MI Link runs on **Windows Server 2012 or later for every supported SQL Server version, and on Linux from SQL Server 2017 onwards**; SQL Server 2016 is **Windows Server only**. The Windows Server 2012 floor is Microsoft's own, stated in the link Limitations: Windows 10 and 11 clients cannot enable the Always On availability group feature the link requires. |
| `source_edition` | Enterprise · Standard · Developer · Express · Web · unknown. Gates MI Link, which requires **Enterprise, Standard or Developer**. |
| `management_model` | fully managed PaaS · need OS/file-system/engine control · Kubernetes on-prem/edge/multicloud |
| `kubernetes_model` | managed engine via Arc data controller · full DIY container · unknown |
| `feature_dependencies` | FILESTREAM/FileTable · PolyBase/cloud files · PolyBase/external RDBMS · PolyBase/unknown · homogeneous SQL↔SQL DTC · heterogeneous DTC · DTC/unknown · linked servers · SQL Agent · SQL CLR · Service Broker/intra-instance · Service Broker/cross-instance · Service Broker/unknown · cross-DB queries |
| `scope` | single database · a few databases (2-10) · large estate. Routes the estate-discovery branch. |
| `size` | `UNDER_150_GB` · `FROM_150_GB_TO_4_TB` · `FROM_4_TB_TO_128_TB` · `OVER_128_TB` · unknown. The classes do not overlap: until v2.4 a 200 TB database matched two of them. |
| `downtime` | `NEAR_ZERO` · `MINIMAL` · `OFFLINE` · unknown. Never inferred from the chosen method. |
| `compliance` | `STANDARD_COMMERCIAL` · `EU_DATA_BOUNDARY` · `GOVERNMENT_SOVEREIGN` · `EDGE_AIR_GAPPED` · unknown |
| `network_bandwidth` | `GOOD_BANDWIDTH` · `LIMITED_WAN` · `VERY_LARGE_MULTI_TB` · unknown. Drives seeding strategy only. |
| `mi_link_ports` | `PORTS_CONFIRMED_OPEN` · `PORTS_BLOCKED` · unknown. Only `PORTS_CONFIRMED_OPEN` lets MI Link be confirmed. |
| `blob_https_reachability` | `BLOB_HTTPS_CONFIRMED` · `BLOB_HTTPS_BLOCKED` · `BLOB_HTTPS_UNKNOWN`. Gates the backup-based paths that stage through Azure Blob — Backup to URL, BACPAC, LRS and log replay. It does **not** gate transports that never touch Blob: Data Box, detach/attach and file-level copies into a target that has a file system. Unknown holds the method gate at `unknown_requires_assessment` rather than `passed`. |
| `clr_permission_set` | `CLR_SAFE` · `CLR_EXTERNAL_ACCESS` · `CLR_UNSAFE` · unknown. Gates `CLR-PERMISSION`. **SAFE is not a clearance**: under `clr strict security` the engine treats SAFE and EXTERNAL_ACCESS as UNSAFE unless signed or hash-trusted. |
| `tde_status` | `TDE_ENABLED` · `TDE_NOT_ENABLED` · unknown. A backup-based method needs the server certificate in the target before restore. |
| `source_permissions` | `SYSADMIN_AVAILABLE` · `LIMITED_RIGHTS` · unknown. Gates **`SOURCE-PERMISSIONS`**. The SSMS 22 Migration Component requires `sysadmin` on the source. |
| `authentication` | `SQL_LOGINS_ONLY` · `WINDOWS_LOGINS` · `ENTRA_ID` · `MIXED_AUTH` · unknown. Drives login remediation effort. |
| `rpo` / `rto` | free text in the customer's own units. Recorded as required evidence; no HA/DR posture is asserted without them. |
| `target_region` | free text. Regional feature availability is stated as unverified until confirmed. |
| `fabric_constraints` | DACPAC size, Private Link need, on-prem gateway acceptable, preview acceptable |
| `database_count` | integer — total databases in scope. Drives MI Link capacity (100 GP/BC, 500 Next-gen GP) and the estate-discovery branch. Never inferred from free-text size. |
| `migration_batch_size` | integer — databases selected per Azure Arc portal migration batch. Checked against the Arc wizard limit, not against MI Link capacity. |
| `arc_extension_version` | Azure Extension for SQL Server version (e.g. `1.1.3348.364`). Gates the Arc wizard batch limit; **unknown is not treated as recent** — it yields `unknown_requires_assessment`. |
| `evidence` | typed booleans: `dependenciesToolConfirmed` · `performanceMeasured` · `regionAvailabilityConfirmed` · `architectSignedOff`. Recorded as claims to verify elsewhere. They never raise `recommendationStatus` or `confidence`, because this skill reads no assessment artefact. |
| `downtime`, `network_ports`, `size`, `tenant_count`, `performance`, `compliance` | used in Steps B→D; engine outputs include `targetAvailabilityDuringSync`, `businessCutoverDowntime`, and cost flags such as `ahbEligible` |

If a selected feature lacks a subtype needed for a hard rule (for example `PolyBase` with no source type, or `DTC` with no participant type), mark the affected candidate `unknown_requires_assessment`; do **not** silently pick the safer target.

For `ahbEligible`, derive the flag in Step D from the selected target, SQL DB purchasing model, compute tier, and whether Hyperscale is a new database or the documented qualifying existing provisioned-compute exception; do not treat every vCore SQL DB as eligible.

**Output consistency rule (must always hold).** The recommended target and method must never contradict the
eligibility table the engine just produced. The full set of invariants, and the requirement to run them
**before rendering**, lives in [`output-contract.md`](output-contract.md) §3. The four that matter most:
- The `primaryTarget` must be `eligible` or `eligible_with_remediation`. Never recommend a target that the
  same run marked `unsupported`.
- The chosen `method` must be viable for that target *and* satisfy its own gates (source version range,
  ports, source type, capacity). A method whose gates fail is not selectable, even as a fallback.
- If no target survives with a viable method, do **not** invent one: return a **provisional shortlist**
  with `recommendationStatus: provisional`, the reason each candidate was excluded, and the assessment to
  run next.
- Worked case: SQL Server **2025** source, MI Link blocked (ports or prerequisites) and Azure SQL Database
incompatible ⇒ standalone LRS is **not** a legal fallback (it supports 2008–2022 only), but that removes
**the method, not the target**. **Azure DMS (online)** is documented to Azure SQL MI from SQL Server 2008
onwards, so the answer is **Azure SQL Managed Instance via Azure DMS (online)** when its gates pass —
falling to **SQL Server on Azure VM** or a provisional shortlist only when no MI method survives. Never
"Azure SQL MI via LRS", and never leave the MI family while another MI method is viable.

### A1. Candidate target eligibility states

Classify each target independently. Only `eligible` and `eligible_with_remediation` survive to Phase B. `unknown_requires_assessment` may be carried into the shortlist, flagged, but it can never be the primary recommendation.

**`excluded_by_preference` is not `unsupported`.** When the stated management model rules a family out — managed PaaS excluding SQL VM, or OS control excluding SQL MI and SQL DB — nothing technical has failed. Record `excluded_by_preference`, name the answer that caused it, and say it can be revisited. `unsupported` is reserved for a target that cannot host the workload as it stands, and a reader six months later must be able to tell the two apart.

| Candidate target | Ruled out when — `unsupported` unless the cell marks it a *preference* | `eligible_with_remediation` examples | Notes |
| --- | --- | --- | --- |
| **SQL Server enabled by Azure Arc** *(control plane, in-place)* | none for assessment/control-plane use | Arc onboarding, agent/network prerequisites, paid on-prem ESU | Not a runtime migration target. Use when intent is assess/modernize in place/not ready. |
| **SQL Server on Azure VM** | none of these rules eliminate it | right-size VM/storage, HA design, patch/backup operations, TDE cert migration | Maximum compatibility and OS/engine control; free ESU on Azure VM applies to SQL Server 2014, SQL Server 2016 ESU is paid even on Azure VM, and SQL Server 2012 and earlier have no remaining ESU path at all. |
| **Azure VMware Solution (AVS)** | not a VMware estate or no need to keep VMware operational model | HCX/vMotion readiness, AVS capacity/networking, **portable VCF licence — see `AVS-LICENSING`** | Rehost VMware estate with minimal refactor; keeps FCI/AG patterns. |
| **Azure SQL Managed Instance (MI)** | FILESTREAM/FileTable; PolyBase to external RDBMS; heterogeneous DTC to third-party RDBMS; need OS/file-system access; unsupported third-party linked server dependency | SQL Agent jobs usually native; **Service Broker intra-instance is eligible**; **Service Broker cross-instance is in public preview** and therefore gated on `previewAcceptable`; SQL CLR/cross-DB usually compatible but assess; cloud-file PolyBase eligible; homogeneous SQL↔SQL DTC eligible | PaaS lift-and-shift for instance features. Service Broker within a single instance is fully supported. Cross-instance message exchange, MI-to-MI and SQL Server-to-MI, is in **public preview**: `CREATE ROUTE`/`ALTER ROUTE` must specify port 4022, transport security only (`CREATE REMOTE SERVICE BINDING` unsupported). Treat it exactly like the Fabric Migration Assistant: preview refusal removes the capability, never the MI target. Unknown scope still requires a topology assessment. |
| **Azure SQL Database** | FILESTREAM/FileTable; linked servers; cross-database three-part-name dependency; instance-level CLR/Service Broker dependency; native restore requirement; DTC dependency | refactor SQL Agent jobs to Elastic Jobs/Automation, refactor cross-DB/linked-server patterns, use contained DB model | Use for cloud-native DB-scoped workloads after dependencies are removed. |
| **SQL database in Fabric** *(GA target; Migration Assistant in Preview)* | complex enterprise OLTP dependency set that the Fabric SQL surface does not support; no viable ingestion path at all | use T-SQL, transactional replication, Fabric pipelines / Data Factory copy jobs, Dataflow Gen2, or TDS-capable tools; if using the Fabric Migration Assistant Preview specifically, its limits are DACPAC > 20 MB, requires Private Link, or cannot use the required on-prem gateway | The target is GA — do **not** apply a target-level preview blocker. Preview acceptance is a *method* gate on the Fabric Migration Assistant only: when preview is unacceptable, keep evaluating the non-assistant ingestion paths. Rank it ahead of general SQL DB when the driver/profile is Fabric analytics; a non-analytics driver lowers its ranking but does not make it `unsupported`. |
| **Arc-enabled SQL Managed Instance** | no Kubernetes/edge/sovereign requirement; Kubernetes model = full DIY container *(preference, not a technical limit — record `excluded_by_preference` and say it can be revisited)* | Arc data controller prerequisites, storage class, network, HA sizing | Managed engine on Kubernetes: auto patch/backup/HA through Arc data services. |
| **SQL Server in a container** | requires managed PaaS/managed engine and will not operate DIY *(preference, not a technical limit — record `excluded_by_preference` and say it can be revisited)* | backup/HA/patch/runbook must be built by customer | Dev/test/edge or full DIY containerized SQL Server. |

#### AVS licensing — `AVS-LICENSING`

**`AVS-LICENSING`.** AVS remains an eligible target. What is ending is the **license-included**
purchasing option: Microsoft stops bundling a VMware licence, and continued use requires a
customer-provided **portable VMware Cloud Foundation subscription** bought from Broadcom and
registered per private cloud.

| Date | What ends |
| --- | --- |
| **15 October 2026** | License-included **pay-as-you-go** SKUs |
| **31 October 2026** | **New sales** of license-included AVS |
| **30 August 2027** | Service for the remaining reserved-instance SKUs |

Quoting only the last date understates the problem by ten months, which is why all three are here.

| Answer | Effect on AVS |
| --- | --- |
| Portable VCF licence confirmed for the planned period | AVS `eligible`; carry the licence cost into the comparison |
| Relying on license-included, or the licence is unknown | AVS `unknown_requires_assessment`, with the licence in `evidenceRequired` |
| Portable VCF confirmed unobtainable for the period | AVS `unsupported`, and say the constraint is commercial, not technical |

**Never report AVS as retiring.** The target is not going away; a purchasing option is. Telling a
customer otherwise steers them off a supported platform for the wrong reason. And never rank AVS
without the licence question settled: Broadcom procurement runs in weeks, so a recommendation made
on a pay-as-you-go assumption today expires before the project starts.

### A2. Hard compatibility rules (Phase A only)
These are filters, not preferences:

| Dependency / answer | MI | SQL DB | SQL VM / AVS / container | Rule |
| --- | --- | --- | --- | --- |
| FILESTREAM / FileTable | `unsupported` | `unsupported` | `eligible` on **SQL VM and AVS**; `unsupported` on the **container**, which runs SQL Server on Linux and has no FILESTREAM/FileTable | **`FILESTREAM-PAAS`.** Hard MI/SQL DB incompatibility. Do not bundle with PolyBase/DTC. The container shares the Linux limitation, so grouping it with the VM offered a target that cannot host the dependency. |
| PolyBase over Blob / ADLS Gen2 cloud files using `OPENROWSET(BULK)`, external tables or CETAS; CSV/Parquet | `eligible` | assess separately | `eligible` | **`POLYBASE-KIND`.** SQL MI supports cloud-file virtualization. Delta Lake, pushdown, and S3 are not supported. |
| PolyBase connector to Oracle, Teradata, MongoDB, another SQL Server, or other external RDBMS | `unsupported` | `unsupported` unless refactored | `eligible` | **`POLYBASE-KIND`.** MI does not support PolyBase external RDBMS connectors. |
| PolyBase selected but source type unknown | `unknown_requires_assessment` | `unknown_requires_assessment` | `eligible` | **`POLYBASE-KIND`**, **`DEPENDENCY-INVENTORY`.** Evidence required: list external data sources/connectors. |
| Homogeneous SQL↔SQL T-SQL DTC (MI↔MI or MI↔SQL Server) | `eligible` | `unsupported` for DTC to SQL DB | `eligible` | **`DTC-TOPOLOGY`.** MI managed DTC supports SQL-to-SQL distributed transactions; port 135 **inbound and outbound**, 14000–15000 inbound, 49152–65535 outbound. Prefer native elastic transactions for all-MI cross-DB work. |
| Heterogeneous DTC to third-party RDBMS | `unsupported` | `unsupported` | `eligible` | **`DTC-TOPOLOGY`.** Use SQL VM or refactor the transaction boundary. |
| DTC selected but participants unknown | `unknown_requires_assessment` | `unknown_requires_assessment` | `eligible` | **`DTC-TOPOLOGY`**, **`DEPENDENCY-INVENTORY`.** Evidence required: transaction participants and linked-server map. |
| Linked servers | `eligible_with_remediation` for supported SQL/OLE DB patterns; third-party RDBMS must be assessed | `unsupported` unless refactored | `eligible` | **`LINKED-SERVERS`.** Hard SQL DB blocker; possible MI blocker when third-party RDBMS is mandatory. |
| SQL Agent jobs | `eligible` | `eligible_with_remediation` | `eligible` | SQL DB requires Elastic Jobs/Automation; this is ranking/remediation, not a hard blocker unless jobs cannot be refactored. |
| SQL CLR, permission set `CLR_SAFE` or `CLR_EXTERNAL_ACCESS` | `eligible_with_remediation` | `unsupported` | `eligible` | **`CLR-PERMISSION`.** SAFE is not a clearance. Under `clr strict security`, on by default since SQL Server 2017, the engine treats SAFE and EXTERNAL_ACCESS assemblies as if they were UNSAFE: each must be signed with a certificate or asymmetric key that has a matching login, or its hash trusted via `sp_add_trusted_assembly`. Remediation is therefore signing plus an assembly inventory, not a permission-set check. Assess external file, network and native-library calls before ranking. SQL DB has no instance-level CLR. |
| SQL CLR, permission set `CLR_UNSAFE` | `unknown_requires_assessment` | `unsupported` | `eligible` | **`CLR-PERMISSION`.** UNSAFE assemblies may call unmanaged code and touch the host, which managed PaaS does not expose. Do not rank MI first until the assemblies are inventoried and their calls understood. |
| SQL CLR, permission set unknown | `unknown_requires_assessment` | `unknown_requires_assessment` | `eligible` | **`CLR-PERMISSION`.** Evidence required: assembly inventory with permission sets, signatures and external calls. Never treat an unstated permission set as SAFE. |
| Need OS/file-system/exact engine control/third-party agents | `unsupported` | `unsupported` | `eligible` | **`MANAGEMENT-MODEL`.** Target SQL VM, AVS, or full DIY container. |

### A3. Reachable target selection order after filtering

Use this order to produce the target shortlist; it prevents masked branches.

1. **Arc in-place / assess first** → SQL Server enabled by Azure Arc control plane. **`ARC-IN-PLACE`.**
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
   - `management_model = Kubernetes on-prem/edge/multicloud` + `kubernetes_model = unknown` → `unknown_requires_assessment`; ask/record evidence. Safe default: do **not** silently pick Arc MI or container. **`MANAGEMENT-MODEL`.**

4. **Fabric analytics branch before generic SQL DB**: **`FABRIC-TARGET`**, **`FABRIC-ASSISTANT`.**
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

MI Link prerequisites: SQL Server 2016+, Enterprise / Standard / Developer edition, a host OS supported by that SQL Server version (Windows Server 2012 or later throughout, Linux from SQL Server 2017 onwards, SQL Server 2016 being Windows Server only), sysadmin on source, distributed availability groups, ability to create AG endpoints, VNet connectivity, and documented MI Link ports. Required ports are: MI subnet NSG inbound **5022** and **11000–11999** from the SQL Server IP; MI subnet NSG outbound **5022** to the SQL Server IP (Microsoft's table states MI NSG allows 5022 + 11000–11999 both directions); SQL Server host OS/corporate firewall inbound **5022** from the MI subnet /24; SQL Server host OS/corporate firewall outbound **5022** and **11000–11999** to the MI subnet. Ports **11000–11999** carry the MI-side distributed-AG HADR data-replication channel; the MI-side HadrPort is dynamically assigned in that range and visible in `sys.dm_hadr_fabric_config_parameters`. MI-side ports cannot be customized; the SQL Server-side endpoint port can. If **5022** or **11000–11999** cannot be opened in the required directions, set MI Link `unsupported`. The fallback is **LRS only when LRS itself qualifies**: source SQL Server 2008–2022, all LRS prerequisites met, and the migration able to complete inside the 30-day maximum window. For a SQL Server 2025 source, or a window that cannot be met, evaluate another supported method or target, or return a provisional shortlist — never fall through to LRS unconditionally. This gate is always required, independent of tier, update policy, VPN, ExpressRoute, or peering. Therefore MI Link is impossible from AWS RDS for SQL Server and GCP Cloud SQL for SQL Server. The rules behind this matrix are **`MI-LINK-SOURCE`**, **`MI-LINK-VERSION`**, **`MI-LINK-HOST`** and **`MI-LINK-PORTS`** for the first column, and **`REPL-PUBLISHER`** for the transactional-replication column.

---

## Step B — Phase B ranking, tier, and migration method

### B1. Ranking criteria for surviving targets

Score/rank only candidates whose Phase A state is `eligible` or `eligible_with_remediation`. Do not reintroduce hard blockers here.

**Apply these steps in order.** Each step either settles the ranking or hands an unchanged order to the next. An unordered list of criteria is not a rule: two readers weighing "cost" against "resilience" differently reach different answers, and that is the variability this ordering exists to remove.

| # | Step | Settles the order when |
| --- | --- | --- |
| 1 | Keep only `eligible` and `eligible_with_remediation` | — |
| 2 | Respect the requested management model (`MANAGED_PAAS`, `OS_CONTROL`, `KUBERNETES`) | A candidate contradicts what the user asked for |
| 3 | Prefer the candidate needing the least mandatory application or database refactoring | Refactoring effort differs |
| 4 | Prefer candidates meeting the confirmed downtime, RPO and RTO constraints | A candidate cannot meet a stated window |
| 5 | Prefer lower operational burden when compatibility is comparable | Patch, backup and HA work differs materially |
| 6 | Prefer stronger rollback and reversibility when cutover risk is comparable | One path can fail back and another cannot |
| 7 | Apply sovereignty and regional-availability constraints | Residency, disconnected or edge needs exclude a region or target |
| 8 | Consider cost levers **only** when the licensing and sizing inputs are known | AHB, ESU or reservations apply and the inputs exist |
| 9 | Prefer the candidate with fewer unresolved assumptions | One path rests on more unverified claims |
| 10 | Otherwise return a **provisional shortlist** | Candidates tie, or depend on different unknowns |

**`RANK-ORDER`** is the rule ID for this ordered table.

**Never invent a winner at step 10.** A shortlist that names what would break the tie is more useful than a confident answer chosen arbitrarily.

For every ordering decision, record which step and which input changed the order. That record is what the output trace renders.

Soft preferences, applied inside step 3: prefer MI over SQL DB when SQL Agent, cross-DB or linked-server patterns exist; prefer SQL DB over MI for simple cloud-native DB-scoped apps; prefer VM or Arc for strict sovereignty or OS control.

### B2. Tier selection rules

If a tier-driving input is missing, emit `unknown_requires_assessment` for tier and list the evidence. Do not default to General Purpose just because nothing else is known.

#### Azure SQL Managed Instance tier

**`MI-TIER`.**

| Inputs | Tier result |
| --- | --- |
| Low-latency storage required, high IOPS/log throughput, heavy tempdb, in-memory OLTP, read-scale secondary, highest HA/resilience, or SLA/latency target cannot tolerate remote storage | **MI Business Critical** |
| 101–500 databases or MI Links on a single instance, up to 128 vCores, up to 32 TB, or configurable IOPS/memory required — and Business Critical-only features and its latency floor are not required | **MI Next-gen General Purpose** *(GA — but its **zone-redundancy option is public preview**, so count it only when `previewAcceptable`)* |
| Moderate latency/IO, general enterprise workload, cost-sensitive, no read-scale secondary, no high log throughput requirement | **MI General Purpose** |
| More than 500 databases or links on one instance | Next-gen General Purpose is still capped at 500 — plan **multiple instances** |
| `performance.latency`, `performance.iops`, `performance.log_throughput`, and `resilience.read_scale/SLA` unknown | `unknown_requires_assessment` — require Perfmon/DMV baseline, wait stats, log generation rate, HA/read-scale requirement |

**Zone redundancy on Next-gen General Purpose is public preview.** The tier is GA; that capability is
not, and a GA tier label must not quietly make its preview options GA too. When resilience is what
selects the tier, treat zone redundancy as available only if `previewAcceptable` is true. Otherwise
say the option exists in preview and rank on the GA feature set — the same treatment already applied
to the Fabric Migration Assistant and to cross-instance Service Broker.

#### Azure SQL Database service tier/model
**`SQLDB-TIER`**; the size ceilings below are **`HYPERSCALE-CEILING`.**

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

**Method selection is a comparison, not a lookup.** Phase A evaluates all eight target families and
records why each one stands or falls; the same discipline applies here. A method that is never
considered cannot be argued with, and a table read as a lookup produced exactly that: Azure DMS is
documented for SQL VM and SQL MI in §5.1, §5.2 and the §8 matrix, and for a long time no rule ever
offered it, so it was never rejected either — it simply never appeared.

#### B3.0 How to pick

1. **Enumerate the candidates.** For the selected target, the candidate methods are the ones the
   knowledge base marks supported for that target in its §8 matrix and describes in §5.1–§5.5. That
   list is the source; the tables below carry the gates, not a shorter catalogue.
2. **Apply the hard gates.** Source version floor, source type, ports, permissions, capacity,
   downtime class. A gate can only *remove* a candidate or hold it at `unknown_requires_assessment` —
   never promote one.
3. **Rank what survives, in this order.** Each step either settles the choice or hands an unchanged
   order to the next:

   | # | Step | Settles the choice when |
   | --- | --- | --- |
   | 1 | **Meet the stated downtime tolerance.** An offline answer does not need an online method; a near-zero answer cannot use one that stops the source | A candidate cannot meet the window the user stated |
   | 2 | **Follow what the answers actually say.** Database count, largest size, network path, permissions, source location: the interview exists to orient this choice, so a candidate contradicted by an answer loses to one supported by it | An answer speaks directly to a candidate |
   | 3 | **Prefer the simpler operation when the outcome is comparable.** Fewer moving parts, fewer prerequisites, fewer things to rehearse. A managed orchestration earns its setup on a wave of databases and loses to a plain restore on a single one | One candidate reaches the same result with materially less machinery |
   | 4 | **Prefer the one that fails better.** Reversibility, restartability, and how much of the work survives an interruption | Cutover risk differs |
   | 5 | **Prefer the one whose prerequisites are already confirmed** over one that adds new evidence to collect | The readiness state differs and nothing above separated them |

4. **When the steps do not separate the finalists, say so.** Return the shortlist with what would
   break the tie, exactly as §B1 requires for targets: **never invent a winner.** Judgment is allowed
   here — the steps order the comparison, they do not replace reading the profile — but an
   unexplained preference is not judgment, it is a coin toss with a confident voice.

5. **Name the losers.** The recommendation states the candidates that were considered and why each
   was set aside. One line each is enough; silence is what let a documented method disappear.

#### → SQL Server on Azure VM

| Downtime wanted | Method | Gate |
| --- | --- | --- |
| Near-zero | **Distributed AG** or **Always On AG** | **`AG-VERSION`.** Distributed AG: source **2016+**. Always On AG: source **2012+**. Both: AD DS or workgroup AG + certs, AG endpoints, ports open, planned failover window |
| Online subset | **Transactional replication** | **`REPL-PUBLISHER`.** Publisher floor as for any SQL Server target; replicated tables need a primary key. Use when a subset of articles moves and the rest stays |
| Smaller / schema-compatible | **BACPAC / SqlPackage** | Test the export and import at full size; not for large or dependency-heavy workloads |
| Offline **or** minimal | **Azure DMS** (offline or online) | **`DMS-MODE`**, **`SOURCE-PERMISSIONS`.** Source **2008+**; target SQL Server version and edition **at or above the source**; target VM registered with the **SQL Server IaaS Agent extension in Full management mode**. DMS restores backups you supply — each one in **its own file**, never appended. **Online** additionally requires the FULL recovery model and an unbroken log chain. Rank it against a plain restore by step 3 of §B3.0: it earns its setup on a wave, not on a single database. Prerequisites `P25` offline, `P26` online |
| Minimal | **Log shipping** | Windows source and log backup chain feasible |
| Offline | **Native backup/restore** — direct `BACKUP TO URL` from **2012 SP1 CU2+**, or local backup + upload below that build or when URL prerequisites are unavailable; detach/attach for special large-file cases | Confirm the build for SQL Server 2012 (SP1 CU2 or later). 2012/2014 use page blob + storage-account credential, 1 TB max; 2016+ use block blob + SAS, up to 12.8 TB striped. TDE cert installed first when encrypted. **`BACKUP-BLOB-PATH`** applies to the **Blob-staged variants only**: for those, `blob_https_reachability` must be `BLOB_HTTPS_CONFIRMED` before the gate reports `passed`, `BLOB_HTTPS_UNKNOWN` yields `unknown_requires_assessment`, and an unverified upload path is the single most common reason a cutover date slips because it is invisible until someone tries it. `BLOB_HTTPS_BLOCKED` does **not** eliminate the method here: this target has a file system, so the knowledge base's backup-to-a-file-and-copy route survives. Move to that variant and hold the gate at `unknown_requires_assessment` until the file-transfer route is proven and measured for the largest database — a route nobody has timed is not a route |
| Whole VM/instance | **Azure Migrate** replication | use for rehost/business case; validate SQL consistency |
| Multi-TB / limited WAN | **Data Box** seed → sync delta | test one full backup/AzCopy/Data Box run |

Arc-enabled source: SQL migration in Azure Arc can orchestrate offline native backup/restore lift-and-shift to SQL VM and can be a phased on-ramp to MI/SQL DB later.

#### → AVS

**Two different moves, and conflating them is what left this section with one line.** HCX and vMotion
move the **virtual machine**; every other method moves the **database** into a SQL Server that AVS
hosts. An AVS-hosted SQL Server is a SQL Server on a VM, so the VM methods apply once the platform
exists — the target's own prerequisites live in the `P27` overlay.

| Downtime wanted | Method | Gate |
| --- | --- | --- |
| Near-zero, whole VM | **VMware HCX / vMotion** | Preserves the VMware operational model and existing SQL HA patterns. Moves the machine, not the database, so nothing inside SQL Server changes |
| Near-zero, database | **Distributed AG** or **Always On AG** | **`AG-VERSION`.** Same floors as the VM target: Distributed AG source **2016+**, Always On AG **2012+**; AD DS or workgroup AG with certificates, AG endpoints and the documented ports |
| Offline | **Native backup/restore** | **`BACKUP-BLOB-PATH`**, **`SOURCE-PERMISSIONS`.** The target has a file system, so a local `.bak` copied into it stays available when the Blob path is blocked |
| Minimal, database | **Log shipping** | **`BACKUP-BLOB-PATH`**, **`SOURCE-PERMISSIONS`.** SQL Server 2008+, Windows-only. Simpler to stand up than an AG when the cutover can absorb one log-restore interval; confirm the secondary restore mode, since `NORECOVERY` leaves the target unavailable until cutover |
| Online subset | **Transactional replication** | **`REPL-PUBLISHER`.** Publisher floor as for any SQL Server target; tables need a primary key |
| Smaller / schema-compatible | **BACPAC / SqlPackage** | Test export and import; not for large or dependency-heavy workloads |

**Not available to this target:** MI Link and Azure DMS — the §8 matrix marks both `➖` for AVS.
Do not offer them here, and do not infer from `→ SQL Server on Azure VM` that they apply.

Rank the surviving candidates with §B3.0: the stated window first, then what the answers say, then
the simpler operation. Moving the whole machine is the least disruptive option when the estate is
already VMware and the operational model is the reason for choosing AVS; it is the wrong tool when
only one database is moving.

#### → Azure SQL Managed Instance

| Downtime wanted | Method | Gate |
| --- | --- | --- |
| Near-zero / online | **MI Link** | **`MI-LINK-VERSION`**, **`MI-LINK-HOST`**, **`MI-LINK-SOURCE`**, **`MI-LINK-PORTS`.** SQL Server 2016+, **Enterprise / Standard / Developer edition**, and a host OS supported by that SQL Server version: **Windows Server 2012 or later** on every supported version, plus **Linux from SQL Server 2017** onwards (SQL Server 2016 is Windows Server only). Also sysadmin, distributed AG, AG endpoint creation, required 5022 + 11000–11999 ports, VNet connectivity; not possible from AWS RDS/GCP Cloud SQL. Unknown OS or edition makes the method `unknown_requires_assessment`; an unsupported edition, a Windows client OS or Windows Server below 2012, or a Linux host below SQL Server 2017, eliminates **MI Link only**, never the MI target. When the migration is driven from the **Azure Arc portal**, that path is documented as Windows Server only, so a Linux host keeps MI Link but loses the Arc-portal orchestration |
| Online migration / planned cutover | **Log Replay Service (LRS)** standalone | **`LRS-VERSION`**, **`LRS-WINDOW`.** SQL Server 2008–2022 (**not 2025 on this control plane**; the Arc-orchestrated path lists 2025 and is a separate entry. Microsoft's own pages disagree here: the LRS-versus-MI-Link comparison page says "2008 and later" with no ceiling, while the standalone migration page states 2008 to 2022. This rule keeps the narrower boundary on purpose, so the failure mode is a route wrongly excluded rather than one wrongly promised; both pages are watched in `claims-registry.json`); sources include SQL on VMs, AWS EC2, AWS RDS, GCP Compute Engine, GCP Cloud SQL; public endpoint/storage access; **the initial restore and log replay must complete inside the 30-day maximum window**; target is `unavailable` (RESTORING/NORECOVERY) during sync |
| Offline / simplest | **Native backup/restore (.bak)** | **`BACKUP-BLOB-PATH`**, **`SOURCE-PERMISSIONS`.** SQL Server 2008+; install TDE cert in destination `master` first; master/msdb not restorable. The SSMS 22 Migration Component requires `sysadmin` on the source: `LIMITED_RIGHTS` refuses that tooling path and an unstated `source_permissions` holds it at `unknown_requires_assessment` |
| Online subset | **Transactional replication** | **`REPL-PUBLISHER`.** Publisher floor as for any SQL Server target; replicated tables need a primary key. Use when a subset of articles moves and the rest stays |
| Smaller / schema-compatible | **BACPAC / SqlPackage** | Test the export and import at full size; not for large or dependency-heavy workloads |
| Offline **or** minimal | **Azure DMS** (offline or online) | **`DMS-MODE`**, **`SOURCE-PERMISSIONS`.** Source **2008+**; provision the target instance first; source login needs `sysadmin` or `CONTROL SERVER`, migration account Contributor on the instance and storage. DMS restores backups you supply — each in **its own file** in an SMB share or Blob container, never appended. **Online** additionally requires the FULL recovery model and an unbroken log chain. **This is the online path that survives when MI Link is unavailable and LRS does not qualify**; against native backup/restore it is the heavier option, so apply step 3 of §B3.0. Prerequisites `P23` offline, `P24` online |
| Online subset | **Transactional replication** | **`REPL-PUBLISHER`.** Use when tables/articles fit and publisher rights exist |
| Data-only / bulk | bcp / Smart Bulk Copy / BACPAC / ADF | data movement only; validate schema/features separately |

LRS and Arc version paths:
- **Standalone LRS** (PowerShell/CLI/API): SQL Server **2008–2022**. SQL Server **2012 SP1 CU2+** can `BACKUP TO URL` directly to Blob (page blob to 1 TB on 2012/2014, block blob + SAS to 12.8 TB on 2016+); older builds back up locally, then upload.
- **Arc-enabled SQL Server overall migration experience:** SQL Server **2014+**.
- **Arc → Azure SQL MI via MI Link:** SQL Server **2016+**, and this path is documented as **Windows Server only**, unlike MI Link configured outside the Arc portal.
- **Arc → Azure SQL MI via LRS:** Microsoft documents a method-table floor of SQL Server **2012+** and Windows Server **2012+**, but this contradicts the same page's **2014+** overall Arc experience floor. Conservative engine rule: require Arc experience floor **2014+** for Arc-orchestrated LRS; standalone LRS outside Arc remains **2008–2022**. Note that the LRS-specific pages also list SQL Server 2012 among supported sources — that is consistent with the standalone **2008–2022** range and is *not* evidence of a 2012 floor for the Arc experience.
- **Arc → SQL Server on Azure VM:** SQL Server **2014+**.

MI migration capacity gates (**`MI-LINK-CAPACITY`**; the Arc wizard row is **`ARC-WIZARD-BATCH`**):
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

- **Fabric Migration Assistant (Preview)**: **`FABRIC-ASSISTANT`.** Schema via **DACPAC ≤ 20 MB**; data via **Fabric Data Factory copy job** + **on-prem data gateway**. No VNet gateway/Private Link for the assistant. `targetAvailabilityDuringSync=not-present`, `businessCutoverDowntime=full load time`; use for Fabric-native/analytics-first simple schemas, not broad enterprise OLTP by default. **`previewAcceptable=false` disqualifies this method only, never the target.** Alternative Fabric SQL database ingestion paths include T-SQL, transactional replication (SQL Server 2022 RTM CU12+ publisher), Fabric pipelines / Data Factory copy jobs, Dataflow Gen2, and any TDS-capable tool; do not eliminate Fabric solely because assistant limits do not fit.
- **DACPAC / SqlPackage**: the schema artefact the Migration Assistant itself imports, subject to the **20 MB** ceiling. Microsoft documents a **DACPAC** path into Fabric SQL database, not a BACPAC import, and §8 marks the cell `✅ (DACPAC)` for exactly that reason. The two are different artefacts — a BACPAC carries schema *and* data, a DACPAC carries schema only — so offering "BACPAC export and import" here promised a route the product does not have.
- **When the assistant is refused** — preview unacceptable, no gateway, or the schema exceeds the DACPAC ceiling — do not substitute a BACPAC import. Evaluate the separately documented Fabric ingestion paths instead: **T-SQL**, **transactional replication** (SQL Server 2022 RTM CU12+ publisher), **Fabric Data Factory copy jobs or pipelines**, **Dataflow Gen2**, and **bcp** with Entra ID (`-G`). Fabric SQL database accepts no SQL authentication.
- **Transactional replication**: **`REPL-PUBLISHER`.** Publisher must be SQL Server **2022 RTM CU12+**, push subscriber only, and Private Link is not supported for replication into Fabric SQL database.

#### → Arc-enabled SQL MI / container

Both targets are customer-operated, so the method list is the same shape as a VM target: a restore
path, an online subset path, and an export path. The difference is where the files land.

| Target | Downtime wanted | Method | Gate |
| --- | --- | --- | --- |
| Arc-enabled SQL MI | Offline | **Native backup/restore** | Through the pod, PVC or the documented Blob workflow; the backup storage class is fixed at deployment, so it is a precondition and not a step. Prerequisites `P17` direct, `P18` when a client endpoint must be reachable first |
| Arc-enabled SQL MI | Online subset | **Transactional replication** | **`REPL-PUBLISHER`.** Publisher floor as for any SQL Server target; tables need a primary key |
| Container | Offline | **Backup/restore via mounted volume** | Persistent volume for `/var/opt/mssql` and the backup path, explicit Linux target paths on restore. Prerequisites `P19` |
| Container | Online subset | **Transactional replication** | **`REPL-PUBLISHER`.** Same floor |
| Either | Smaller / schema-compatible | **BACPAC / SqlPackage** | Test export and import at full size |

**The two targets do not share an operating model, and saying they do erases the reason to choose
one over the other.**

- **Arc-enabled SQL MI** is a managed service on customer infrastructure. The Arc data controller
  provides built-in health monitoring, failure detection and automatic failover, sets up the
  availability group and coordinates failover and upgrade *without user intervention*; it also
  provides automated backups and point-in-time restore, with the HA level depending on the service
  tier. What the **customer owns** is the Kubernetes platform underneath: cluster, storage classes,
  capacity, networking and disaster recovery.
- **SQL Server in a container** is not managed. The **customer owns HA/patch/backup** outright —
  engine patching, backup scheduling and any availability topology are theirs to build and operate.

Rank with §B3.0; on these targets the simpler operation usually wins, because every additional
moving part is one the customer will also operate.

#### Large estates / multi-TB (any target) — seed-then-sync

Ship the initial full backup via Data Box or AzCopy over ExpressRoute, then catch up the delta with LRS / MI Link / transactional replication / log shipping before cutover. Do not size cutover as `size ÷ bandwidth`; test one full backup plus upload/restore path first and plan rollback.

---

## Step C — Blockers, validation, uncertainty, and output status

### C1. Migration availability and cutover downtime outputs

The source-of-truth downtime model is the pair `targetAvailabilityDuringSync` + `businessCutoverDowntime`. A coarse `downtimeClass` may be emitted for cards, but it must be derived from `businessCutoverDowntime`. **`DOWNTIME-CLASS`.**

| Method | `targetAvailabilityDuringSync` | `businessCutoverDowntime` | Derived `downtimeClass` |
| --- | --- | --- | --- |
| **MI Link** | `read-only` (secondary queryable) | `< 1 minute` | `minimal` |
| **LRS** | `unavailable` (RESTORING / NORECOVERY; no read or write) | `minutes` on General Purpose when the final backup is small; `hours` on Business Critical because the database seeds to secondary replicas before availability | `planned-cutover` |
| **Native backup/restore** | `not-present` | `full restore time` | `extended` |
| **Transactional replication** | `read-write` (subscriber accessible) | `near-zero` | `minimal` |
| **DMS offline** | `not-present` | `total migration execution time` | `extended` |
| **DMS online** | `unavailable` (the destination is restored from backups and log backups while the source stays in service) | the final synchronization and cutover interval — **minimal, but not guaranteed sub-minute** | `minimal` |
| **Distributed / Always On AG** | `read-only` (readable secondary, if configured) | `near-zero` (planned failover) | `minimal` |
| **Log shipping** | `read-only` when the secondary is restored WITH STANDBY (queryable between restore jobs, and readers are disconnected for each one); `unavailable` when it is restored WITH NORECOVERY | `minimal` | `minimal` |
| **BACPAC / bcp / ADF / Data Box** | `not-present` | `full load time` | `extended` |

Rules:
- For LRS, emit `targetAvailabilityDuringSync=unavailable` and a planned cutover duration; do not use the extended/load-time class.
- If `target = Azure SQL MI Business Critical` and `method = LRS`, add warning `lrsBusinessCriticalCutoverCanTakeHours=true`; rank MI Link higher whenever all MI Link prerequisites are satisfiable.
- Reserve `minimal downtime` wording for MI Link **when comparing it with LRS**, not with online DMS. Both MI Link and online DMS are minimal-downtime methods; what separates them is the cutover length — MI Link is sub-minute, online DMS is the final synchronization interval. Saying "only MI Link is minimal" contradicts a method §B3 now selects.

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
| **SSRS** | Move RDL workloads to **Power BI paginated reports** for managed cloud, or use **Power BI Report Server on a VM** when the managed service does not fit. Starting with SQL Server 2025 (17.x), on-premises reporting services is consolidated under Power BI Report Server; no new SSRS versions after SSRS 2022, which follows the SQL Server 2022 lifecycle and is supported until 12 Jan 2033. |
| **SSAS** | Move to Azure Analysis Services or Power BI Premium/Fabric semantic models. |
| Dependency gap | Undocumented linked servers, jobs, file access, CLR, DTC, and external data sources commonly derail migrations; run dependency discovery before committing. |

### C3. Pre-cutover validation

For performance-sensitive workloads: capture with **Extended Events**, replay with **RML Utilities / OStress**, and analyse with **Query Store** plus DMVs. Do not recommend retired DEA. Distributed Replay is deprecated as of SQL Server 2022 and unavailable in SQL Server 2022+.

### C4. Confidence and provisional status contract

Every output must include:

```yaml
confidence: medium|low
assumptions: []
unknowns: []
hardBlockers: []
evidenceRequired: []
recommendationStatus: provisional
```

Decision-driving unknowns are: linked servers/provider targets, SQL Agent job criticality, FILESTREAM/FileTable, DTC participants, PolyBase/external data source types, source platform privileges (sysadmin/AG endpoints), network ports for selected online method, TDE status/cert availability, database size, **cutover downtime tolerance**, tier-driving performance inputs, sovereignty/disconnected constraints, and Fabric preview/Private Link/gateway constraints.

Rules:
- Unknown on a decision-driving dependency ⇒ add `evidenceRequired` and name the next assessment (Azure Migrate/Arc discovery/SSMS 22 assessment/scripts/Perfmon/DMVs).
- `recommendationStatus` is always `provisional`. There is no other value: the skill reads nothing from the estate, so it can never certify a target.
- `confidence = medium` is the ceiling. It is reached only when all hard blockers and tier-driving inputs are known and the chosen method gates are satisfied. Nothing above it is available, because a confidence higher than that would have to rest on measured evidence and the interview produces none.
- `confidence = low` when any candidate is `unknown_requires_assessment` on a decision-driving dependency.
- Never turn an unknown into a silent safe default.
- An unknown cutover downtime tolerance yields `businessCutoverDowntime: unknown_requires_assessment`. A downtime class is a promise made to the business, so it is never inferred from a method that was itself selected by defaulting the unanswered question. **`DOWNTIME-CLASS`.**
- The card must not contradict the eligibility table that produced it. **`OUTPUT-CONSISTENCY`** is normative in [`output-contract.md`](output-contract.md) §3, which is the list of invariants to run **before rendering**; expose an inconsistency, never repair it silently.

---

## Step D — Cost levers, program fit, assessment tool

### D1. Cost and sizing levers

- **Azure Hybrid Benefit (AHB):** applies to Azure SQL Database General Purpose / Business Critical in the vCore provisioned compute tier, SQL MI, and SQL VM; not Fabric SQL DB, DTU, serverless, or new Hyperscale databases. Hyperscale carries a **creation-date cohort**: AHB can only be applied to Hyperscale single databases with provisioned compute **created before 15 December 2023**, and only until December 2026, after which they too move to the simplified pricing. A Hyperscale database created on or after that date is **not** AHB-eligible, because the simplified pricing already removed the software licence fee.
- **ESU:** the SQL Server ESU programme now covers **SQL Server 2014 and SQL Server 2016 only**. SQL Server 2014 reached end of support on 10 July 2024 with ESUs available until 13 July 2027; SQL Server 2016 reached end of support on 15 July 2026 with ESUs available until 17 July 2029. ESU is free on Azure VMs / AVS for SQL Server 2014; SQL Server 2016 is paid everywhere, including Azure VM, and materially changes stay-vs-migrate maths. SQL Server 2012 and earlier have no ESU path left at all, so do not describe them as covered: upgrade or migrate. Non-Azure/on-prem/hosted environments subscribe after connecting to Azure Arc, either with Software Assurance under eligible agreements or via Arc-connected PAYG billing without SA.
- Set `ahbEligible=true` only for eligible compute models: SQL MI, SQL VM, SQL DB GP/BC vCore provisioned, and the documented pre-15-December-2023 Hyperscale provisioned exception; set `ahbEligible=false` for DTU, serverless, Fabric SQL DB, and any Hyperscale database created on or after 15 December 2023. Combine AHB + reservations + ESU where eligible; state that savings depend on license position and commitment.
- **Sizing:** never size MI/SQL DB on average CPU alone. Require Perfmon/DMV baseline for at least 7 days, peak windows, storage latency, IOPS, log generation, tempdb, and about 20% headroom.

### D2. Assessment / control plane to run next

| Situation | Control plane / assessment |
| --- | --- |
| DBA-first, Windows, single/few DBs | **SSMS 22 Migration Component** |
| Arc-enabled source or assess-first/in-place | **SQL Server migration in Azure Arc** and Arc best-practices assessment |
| Estate scale / business case / dependency map | **Azure Migrate** appliance or import (GA); Arc-based agentless discovery is **Preview**, so select it only when the customer accepts preview services |
| Readiness / strategy / ROI / landing-zone planning **on existing Azure Migrate data** | **Azure Copilot Migration Agent** *(Preview)* — **`COPILOT-AGENT`.** Select only when `previewAcceptable` and an Azure Migrate assessment already exists: it reasons over collected data, it does not collect and it does not move data. Never treat it as a migration method, and never let it replace SQL assessment or method selection, which stay with Azure Migrate, Arc, SSMS and DMS. |
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

---

## Rule index

Every hard gate is addressable. A recommendation cites the rule that decided each target, so a reader can look it up here and challenge it.

Each entry names the fields it consumes, from [`input-contract.md`](input-contract.md), and what it does when one of them is unknown. **No hard gate may consume a field absent from the input contract**, and no gate may treat unknown as a pass: an unverified prerequisite is not a satisfied prerequisite.

The normative wording stays in the sections above. This index is the address book, not a second copy.

| Rule ID | Type | Consumes | Unknown behaviour | Defined in |
| --- | --- | --- | --- | --- |
| `MI-LINK-SOURCE` | hard method gate | `source_location` | Method `unknown_requires_assessment` | A4, B3 |
| `MI-LINK-VERSION` | hard method gate | `source_version` | Method `unknown_requires_assessment` | B3 |
| `MI-LINK-HOST` | hard method gate | `source_os`, `source_edition`, `source_version` | Method `unknown_requires_assessment`; a **known** unsupported edition or host eliminates MI Link only, never the MI target | A0, B3 |
| `MI-LINK-PORTS` | hard method gate | `mi_link_ports` | Method `unknown_requires_assessment` | B3 |
| `DMS-MODE` | hard method gate | `source_version`, `source_permissions`, `downtime`, `database_count` | Method `unknown_requires_assessment`; online mode is never assumed without a confirmed FULL recovery model and log chain | B3 |
| `BACKUP-BLOB-PATH` | hard method gate | `blob_https_reachability` | **Gate cannot report `passed`**; `unknown_requires_assessment`. Blocked eliminates the Blob-staged variant only; a target with a file system keeps the copy-a-file variant | B3 |
| `MI-LINK-CAPACITY` | hard method gate | `database_count`, tier | Capacity `unknown_requires_assessment` | B3 |
| `LRS-VERSION` | hard method gate | `source_version` | Method `unknown_requires_assessment` | B3 |
| `LRS-WINDOW` | hard method gate | `size`, `network_bandwidth` | Constraint always recorded; **`unknown_requires_assessment`** once size or bandwidth make 30 days a real risk | B3 |
| `AG-VERSION` | hard method gate | `source_version` | Method not selected | B3 |
| `REPL-PUBLISHER` | hard method gate | `source_version`, `source_location` | Method `unknown_requires_assessment` | A4, B3 |
| `FILESTREAM-PAAS` | hard target gate | `feature_dependencies` | SQL MI and SQL DB `unknown_requires_assessment` | A2 |
| `POLYBASE-KIND` | hard target gate | `feature_dependencies`, PolyBase kind | SQL MI and SQL DB `unknown_requires_assessment` | A2 |
| `DTC-TOPOLOGY` | hard target gate | `feature_dependencies`, DTC topology | SQL MI and SQL DB `unknown_requires_assessment` | A2 |
| `LINKED-SERVERS` | hard target gate | `feature_dependencies` | SQL DB `unknown_requires_assessment` | A2 |
| `CLR-PERMISSION` | hard target gate | `feature_dependencies`, CLR permission set | SQL MI and SQL DB `unknown_requires_assessment` | A2 |
| `DEPENDENCY-INVENTORY` | hard target gate | `feature_dependencies` | SQL MI and SQL DB `unknown_requires_assessment` | A2 |
| `AVS-LICENSING` | hard target gate | `target_region`, licence answer | AVS `unknown_requires_assessment` with the portable VCF licence in `evidenceRequired`; never reported as AVS retiring | A1 |
| `COPILOT-AGENT` | control-plane branch | `previewAcceptable`, existing Azure Migrate data | Not selected; the GA control planes are unaffected | D2 |
| `MANAGEMENT-MODEL` | hard target gate | `management_model`, `kubernetes_model` | Family split blocked; return a shortlist | A2 |
| `ARC-IN-PLACE` | hard target gate | `intent`, `source_version` | Path not offered | A3 |
| `ARC-WIZARD-BATCH` | hard method gate | `migration_batch_size`, `arc_extension_version` | **Not treated as recent**, `unknown_requires_assessment` | B3 |
| `FABRIC-TARGET` | hard target gate | `driver` | Fabric ranked below, never eliminated | A3 |
| `FABRIC-ASSISTANT` | hard method gate | `fabric_constraints` | Assistant `unknown_requires_assessment`; the GA target survives | A3, B3 |
| `HYPERSCALE-CEILING` | hard target gate | `size` | Tier `unknown_requires_assessment`. Past the 128 TB single-database ceiling, both PaaS families are **refused** and the workload must be sharded or moved to a VM | B2 |
| `SOURCE-PERMISSIONS` | hard method gate | `source_permissions` | Method `unknown_requires_assessment`; limited rights **refuse** the method | A0, B3 |
| `MI-TIER` | tier rule | `performance`, `size`, `database_count` | Tier `unknown_requires_assessment`, never General Purpose by default; Next-gen GP zone redundancy counts only when preview is accepted | B2 |
| `SQLDB-TIER` | tier rule | `performance`, `size`, `tenant_count` | Tier `unknown_requires_assessment` | B2 |
| `DOWNTIME-CLASS` | consistency rule | `downtime` | `businessCutoverDowntime` `unknown_requires_assessment` | C1, C4 |
| `RANK-ORDER` | ranking | all surviving candidates | Provisional shortlist at step 10 | B1 |
| `OUTPUT-CONSISTENCY` | consistency rule | eligibility, method, tier | Expose the inconsistency, never repair silently | C4, output contract §3 |
