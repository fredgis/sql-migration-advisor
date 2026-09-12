# Example run — SQL Migration Advisor

A worked example showing the two-tier interview, preliminary recommendation card, and JSON rendering. Values are illustrative.

**The JSON below is produced, not written.** The normalized profile carries every answer the two
interview tables supply, and the engine that the golden scenarios run against derives the
recommendation, the tier, the cutover class and the method candidates from it. The card is a
rendering of that same object. An earlier version of this page echoed eight of the thirty-seven
profile fields, listed no method candidates in the card while the JSON carried six, gave every
candidate an empty `prerequisitePaths` array that the handoff contract reads, and named a control
plane the rules do not select for a standalone Log Replay Service run. A worked example is a claim
about the output, and nothing was holding it to one.

## Interview answers

### Tier 1 — Triage

| # | Question | Answer |
| --- | --- | --- |
| 1 | Scope | A few databases (3 finance DBs) |
| 2 | Source location | On-prem |
| 3 | Source version | SQL Server 2014 |
| 4 | Migration intent / readiness | Move to Azure now |
| 5 | Primary driver | End-of-support / ESU pressure |
| 6 | Management model | Fully managed PaaS |
| 7 | Feature dependencies | SQL Agent jobs, cross-DB queries, linked servers |
| 8 | Largest DB size | 1.2 TB |
| 9 | Downtime tolerance | Minimal: a couple of hours |
| 10 | Network and ports | ExpressRoute available; 1433/443 open; MI Link ports 5022 and 11000–11999 not approved |
| 11 | Compliance | Standard commercial |
| 12 | Ancillary/security | SSIS packages, TDE-encrypted DBs, Windows logins |
| 13 | Tier-selection inputs | Moderate latency sensitivity, no read-scale need, no strict zone-redundant SLA, steady usage, not multi-tenant |

### Tier 2 — Confirmation asked because SQL MI and SQL VM remained in play

| Input | Answer | Why it mattered |
| --- | --- | --- |
| Source edition + OS | Enterprise on Windows Server 2016 | Confirms AHB/ESU and restore/log shipping feasibility |
| Compatibility level | 120 | Flags modernization testing but no immediate target block |
| Current HA/DR | No AG/FCI; nightly full + log backups every 15 min | MI Link/DAG not already prepared; LRS/native restore feasible |
| RPO / RTO | RPO 15 min; RTO 4 hours | Supports LRS log catch-up with planned cutover downtime |
| Peak log generation | 20 GB/hour close-of-month | Must test LRS catch-up rate before cutover |
| CPU/memory/IOPS/latency | 16 cores, 128 GB RAM, moderate IOPS, no sub-ms latency requirement | Supports SQL MI General Purpose rather than Business Critical |
| Authentication | Windows logins and SQL logins | Requires login discovery and migration |
| SQL CLR | Not used | Removes CLR eligibility uncertainty |
| Network/DNS/AD | AD reachable from Azure via ExpressRoute; private DNS planned | Supports MI domain/auth dependencies |
| Backup retention | 35 days operational retention; monthly archive outside database platform | No special tier blocker |
| Target region | UK South | Feature availability to confirm in assessment |
| DR/rollback | Keep source read-only for rollback window after cutover | Supports reversibility plan |
| SA/AHB | Software Assurance active | AHB cost lever applies |
| Maintenance restrictions | Prefer Microsoft-managed patching | Ranks MI above SQL VM |
| Recovery model + log chain | FULL recovery, nightly full plus log backups every 15 minutes, chain unbroken | `DMS-MODE` refuses online DMS without both; LRS needs FULL as well |
| Preview services | Generally available only | Rules out preview-gated capabilities without ruling out any GA target |
| Blob HTTPS reachability | Confirmed from the source to Azure Blob | `BACKUP-BLOB-PATH` cannot report `passed` on an unverified upload path |

## Phase A eligibility trace

| Target | Status | Reason |
| --- | --- | --- |
| SQL Server on Azure VM | eligible | Maximum compatibility, kept as the alternative; carries the operational burden the customer asked to avoid. `[MANAGEMENT-MODEL]` |
| Azure VMware Solution | excluded_by_preference | No VMware-continuity requirement was stated, so the platform was not selected. Technically compatible. `[AVS-LICENSING]` |
| Azure SQL Managed Instance | eligible_with_remediation | SQL Agent, cross-database queries and linked servers fit the instance surface; TDE certificate, logins and SSIS packages need remediation first. `[MANAGEMENT-MODEL]` |
| Azure SQL Database | unsupported | Linked servers, cross-database use and SQL Agent would all require refactoring the application. `[LINKED-SERVERS]` |
| SQL database in Fabric | unsupported | The instance-feature dependency set is outside the Fabric SQL database target surface. The target itself is generally available; only the Fabric Migration Assistant is preview. `[FABRIC-TARGET]` |
| Arc-enabled SQL MI | excluded_by_preference | No Kubernetes, edge or multi-cloud operating model was selected. `[MANAGEMENT-MODEL]` |
| SQL Server container | excluded_by_preference | Customer-operated patching, backups and HA conflict with the stated managed-PaaS preference. `[MANAGEMENT-MODEL]` |
| Arc in-place | excluded_by_preference | Useful for ESU cover while the move is prepared, but the stated intent is to migrate now. `[ARC-IN-PLACE]` |

## Phase B ranking summary

SQL MI ranks first because it preserves instance-level compatibility with much lower operational burden than SQL VM. SQL VM is the best alternative if later assessment finds unsupported linked-server providers, file-system dependencies, or latency/IOPS needs that exceed the selected MI tier.

## Output card

> **Preliminary recommendation — `Finance DB group (3 DBs)`**
> **Azure SQL Managed Instance — General Purpose** via **Log Replay Service** · status **provisional** · confidence **low**
> KB **v3.11** (bundled, same commit as the skill) · rules **v3.11**

SQL MI is the recommended assessment path because the workload needs SQL Agent, cross-database queries, and linked servers, while the team wants managed PaaS; SQL Server 2014 and blocked MI Link ports 5022/11000–11999 make MI Link unavailable, so LRS is the practical online method with planned cutover downtime.

**📋 Primary recommendation**

| | Recommendation |
| --- | --- |
| 🎯 **Target / tier** | Azure SQL Managed Instance — **General Purpose** |
| 🔁 **Migration method** | Log Replay Service: full backup to Blob, then differential/log catch-up |
| 👁️ **Target availability during sync** | `unavailable` — SQL MI database remains RESTORING/NORECOVERY during sync |
| ⏱️ **Business cutover downtime** | `minutes` expected for General Purpose with a small final backup; validate with a rehearsal |
| 🧭 **Assess / orchestrate** | Control plane `standalone`: the Log Replay Service is driven from PowerShell, CLI or the API, not through Arc or the SSMS migration component. Assessment tooling is a separate question, and here it is the SSMS 22 Migration Component plus dependency discovery, with Arc for ESU cover during the project |
| 💰 **Cost view** | Cost levers only: AHB eligible, ESU via Arc while on-prem, reservations after sizing; no estimate until measured sizing/pricing |

**Why General Purpose, not Business Critical** — interview inputs indicate moderate IOPS and latency sensitivity, no read-scale requirement, no strict zone-redundant SLA requirement, and steady non-tenant workload. Business Critical would win if assessment shows low-latency storage, high log throughput, readable secondary, or stricter HA/SLA needs.

**🥈 Best alternative** — **SQL Server on Azure VM** with native backup/restore or log shipping; wins if dependency discovery finds file-system dependencies, unsupported linked-server providers, third-party agents, or performance requirements not suitable for SQL MI GP/BC.

**⚖️ Methods weighed for this target**

| Method | Role | Status | Prerequisite paths |
| --- | --- | --- | --- |
| **Log Replay Service** *(selected)* | primary | `unknown_requires_assessment` | `P09` |
| Azure DMS | primary | `available` | `P23`, `P24` |
| Native backup/restore | primary | `available` | `P10` |
| Transactional replication | secondary | `available` | `P13` |
| BACPAC / SqlPackage | secondary | `available` | `P11` |
| MI Link | primary | `unavailable` | `P08` |

Every method the summary matrix marks primary or secondary for Managed Instance is listed, including
the ones that lost: a method never considered is a method never rejected, and its absence cannot be
argued with. MI Link is the only one ruled out on a fact rather than on ranking, because the source
is SQL Server 2014 and ports 5022 plus 11000–11999 are not approved.

The winner reads `unknown_requires_assessment` rather than `available`, and so does its gate. The
Log Replay Service has a hard thirty-day window and nobody has estimated how long 1.2 TB will take
to seed and catch up, so the route is viable and not yet proven. A recommendation waiting on one
unmeasured field is the ordinary case, and saying `available` there would claim a gate that has not
reported. The prerequisite paths are what a preferred alternative resolves to if the customer picks
one over the recommendation.

**🚫 Excluded or constrained targets (Phase A eligibility)**
- **Azure SQL Database** — unsupported: linked servers, cross-database use and SQL Agent would all require refactoring the application. `[LINKED-SERVERS]`
- **SQL MI Link method** — unsupported: source is SQL Server 2014 and required MI Link ports 5022 plus 11000–11999 are not approved in the required directions.
- **SQL database in Fabric** — unsupported: the instance-feature dependency set is outside that target surface. The target is generally available; only the Fabric Migration Assistant is preview. `[FABRIC-TARGET]`
- **Arc in-place** — excluded_by_preference: useful for ESU cover while the move is prepared, but the stated intent is to migrate now. `[ARC-IN-PLACE]`

**🚧 Blockers & required evidence**
- **TDE** → install the source TDE certificate in destination `master` before restoring encrypted databases; otherwise restore fails.
- **Windows logins** → discover, script, and validate login/user mapping before cutover.
- **SSIS packages** → assess package compatibility and plan Azure-SSIS Integration Runtime or refactor.
- **Peak log generation 20 GB/hour** → run a test full backup plus LRS catch-up to prove the cutover window.

**✅ Assumptions**
- Linked servers are SQL Server-compatible and can be recreated on MI.
- No FILESTREAM/FileTable, PolyBase external RDBMS connector, heterogeneous DTC, or SQL CLR dependency exists.
- UK South has the required SQL MI features available at deployment time.

**❓ Missing information that could change the decision**
- Full dependency inventory → could move the recommendation to SQL VM if VM-only features are discovered.
- Measured IOPS/log-write latency under peak close-of-month load → could move the tier from GP to Business Critical.
- Final region capacity and network test results → could affect deployment region, tier, or migration sequencing.

**🔌 Ancillary / remediations** — SSIS → Azure-SSIS IR or refactor · SQL Agent → native on MI · linked servers → recreate and test on MI · Windows logins → migrate and validate.

**⚠️ Biggest risk** — dependency-map gap plus TDE sequencing. Defuse it with SSMS 22 assessment, dependency discovery, certificate migration rehearsal, and a test restore before scheduling cutover.

**🔗 Evidence links** — Azure SQL MI LRS guidance, TDE certificate restore guidance, Azure Hybrid Benefit, SQL Server enabled by Azure Arc ESU guidance.

## JSON rendering

```json
{
  "metadata": {
    "knowledgeBaseVersion": "v3.11",
    "decisionRulesVersion": "v3.11",
    "sourceCommit": "bundled",
    "evaluatedAt": "2026-09-09T18:20:00Z",
    "recommendationStatus": "provisional",
    "confidence": "low"
  },
  "normalizedProfile": {
    "scope": "FEW_DATABASES",
    "source_location": "ON_PREM",
    "source_version": "SQL2014",
    "intent": "MIGRATE_NOW",
    "driver": "EOS_ESU",
    "management_model": "MANAGED_PAAS",
    "kubernetes_model": "NOT_APPLICABLE",
    "source_os": "WINDOWS_SERVER_2016",
    "source_edition": "ENTERPRISE",
    "clr_permission_set": "NONE_CONFIRMED",
    "tde_status": "TDE_ENABLED",
    "source_permissions": "SYSADMIN_AVAILABLE",
    "authentication": "MIXED_AUTH",
    "feature_dependencies": [
      "SQL Agent jobs",
      "cross-database queries",
      "linked servers"
    ],
    "feature_dependencies_state": "ANSWERED",
    "size": "FROM_150_GB_TO_4_TB",
    "downtime": "MINIMAL",
    "compliance": "STANDARD_COMMERCIAL",
    "network_bandwidth": "GOOD_BANDWIDTH",
    "mi_link_ports": "PORTS_BLOCKED",
    "blob_https_reachability": "BLOB_HTTPS_CONFIRMED",
    "network_ports": "1433 and 443 open; 5022 and 11000-11999 not approved",
    "rpo": "15 minutes",
    "rto": "4 hours",
    "target_region": "UK South",
    "performance": "16 cores, 128 GB RAM, moderate IOPS, no sub-millisecond latency requirement",
    "tenant_count": "single tenant",
    "fabric_constraints": "none stated",
    "database_count": 3,
    "migration_batch_size": 3,
    "arc_extension_version": "not deployed",
    "evidence": {
      "dependenciesToolConfirmed": false,
      "performanceMeasured": false
    },
    "preview_acceptable": "PREVIEW_REFUSED",
    "recovery_model": "FULL",
    "log_chain_status": "CHAIN_INTACT",
    "ancillary_services": [
      "SSIS packages",
      "TDE-encrypted databases",
      "Windows logins"
    ],
    "ancillary_services_state": "ANSWERED"
  },
  "eligibilityTrace": [
    {
      "target": "sql_vm",
      "status": "eligible",
      "ruleId": "MANAGEMENT-MODEL",
      "reason": "Maximum compatibility, kept as the alternative; carries the operational burden the customer asked to avoid."
    },
    {
      "target": "avs",
      "status": "excluded_by_preference",
      "ruleId": "AVS-LICENSING",
      "reason": "No VMware-continuity requirement was stated, so the platform was not selected. Technically compatible."
    },
    {
      "target": "sql_mi",
      "status": "eligible_with_remediation",
      "ruleId": "MANAGEMENT-MODEL",
      "reason": "SQL Agent, cross-database queries and linked servers fit the instance surface; TDE certificate, logins and SSIS packages need remediation first."
    },
    {
      "target": "sql_db",
      "status": "unsupported",
      "ruleId": "LINKED-SERVERS",
      "reason": "Linked servers, cross-database use and SQL Agent would all require refactoring the application."
    },
    {
      "target": "fabric_sql_db",
      "status": "unsupported",
      "ruleId": "FABRIC-TARGET",
      "reason": "The instance-feature dependency set is outside the Fabric SQL database target surface. The target itself is generally available; only the Fabric Migration Assistant is preview."
    },
    {
      "target": "arc_sql_mi",
      "status": "excluded_by_preference",
      "ruleId": "MANAGEMENT-MODEL",
      "reason": "No Kubernetes, edge or multi-cloud operating model was selected."
    },
    {
      "target": "container",
      "status": "excluded_by_preference",
      "ruleId": "MANAGEMENT-MODEL",
      "reason": "Customer-operated patching, backups and HA conflict with the stated managed-PaaS preference."
    },
    {
      "target": "arc_in_place",
      "status": "excluded_by_preference",
      "ruleId": "ARC-IN-PLACE",
      "reason": "Useful for ESU cover while the move is prepared, but the stated intent is to migrate now."
    }
  ],
  "recommendation": {
    "target": "Azure SQL Managed Instance",
    "tier": "General Purpose",
    "method": "Log Replay Service",
    "targetAvailabilityDuringSync": "unavailable",
    "businessCutoverDowntime": "minutes",
    "controlPlane": "standalone"
  },
  "alternative": {
    "target": "SQL Server on Azure VM",
    "method": "Native backup/restore",
    "condition": "VM-only dependencies or measured I/O beyond the selected Managed Instance tier are found during assessment."
  },
  "methodCandidates": [
    {
      "method": "DMS",
      "role": "primary",
      "status": "available",
      "selected": false,
      "reason": "Prerequisite paths P23, P24 apply.",
      "prerequisitePaths": [
        "P23",
        "P24"
      ]
    },
    {
      "method": "MI Link",
      "role": "primary",
      "status": "unavailable",
      "selected": false,
      "reason": "MI Link requires SQL Server 2016+.",
      "prerequisitePaths": [
        "P08"
      ]
    },
    {
      "method": "Log Replay Service",
      "role": "primary",
      "status": "unknown_requires_assessment",
      "selected": true,
      "reason": "Prerequisite paths P09 apply. Its method gate has not reported passed, so the route is viable and not yet proven.",
      "prerequisitePaths": [
        "P09"
      ]
    },
    {
      "method": "Native backup/restore",
      "role": "primary",
      "status": "available",
      "selected": false,
      "reason": "Prerequisite paths P10 apply.",
      "prerequisitePaths": [
        "P10"
      ]
    },
    {
      "method": "Transactional replication",
      "role": "secondary",
      "status": "available",
      "selected": false,
      "reason": "Prerequisite paths P13 apply.",
      "prerequisitePaths": [
        "P13"
      ]
    },
    {
      "method": "BACPAC / SqlPackage",
      "role": "secondary",
      "status": "available",
      "selected": false,
      "reason": "Prerequisite paths P11 apply.",
      "prerequisitePaths": [
        "P11"
      ]
    }
  ],
  "blockers": [
    "MI Link is unavailable: ports 5022 and 11000-11999 are blocked and the source is below the 2016 floor."
  ],
  "unknowns": [
    "Measured peak IOPS and log-write latency",
    "Region capacity for the selected tier",
    "Blob upload path for the staged backups"
  ],
  "assumptions": [
    "No FILESTREAM, heterogeneous DTC, PolyBase to an external RDBMS or SQL CLR dependency",
    "Linked servers can be recreated on Managed Instance"
  ],
  "evidenceRequired": [
    "SSMS 22 Migration Component assessment",
    "Dependency discovery for linked servers, jobs and SSIS",
    "Test restore with the TDE certificate installed first"
  ],
  "nextActions": [
    "Run the assessment",
    "Confirm the Blob upload path",
    "Rehearse the cutover against the stated RPO and RTO"
  ],
  "evidenceLinks": [
    "https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/log-replay-service-migrate"
  ],
  "largestRisk": "An assumed General Purpose tier misses the measured I/O and latency requirement; resolve it with a workload replay and Query Store analysis before provisioning.",
  "methodGateTrace": {
    "method": "Log Replay Service",
    "result": "unknown_requires_assessment"
  }
}
```
