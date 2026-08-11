# Example run — SQL Migration Advisor

A worked example showing the two-tier interview, preliminary recommendation card, and JSON rendering. Values are illustrative.

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

## Phase A eligibility trace

| Target | Status | Reason |
| --- | --- | --- |
| Azure SQL Managed Instance | eligible_with_remediation | Fits SQL Agent, cross-DB, linked servers; requires TDE cert, login, SSIS remediation |
| Azure SQL Database | unsupported | Linked servers, cross-DB use, and SQL Agent dependency would require significant refactor |
| SQL Server on Azure VM | eligible | Maximum compatibility, but higher operational burden than requested |
| Azure VMware Solution | unsupported | Not a VMware data-center-exit requirement |
| Arc-enabled SQL MI | unsupported | Kubernetes/edge not requested |
| SQL Server container | unsupported | DIY operations conflicts with managed PaaS preference |
| SQL database in Fabric | unsupported | Production OLTP lift-and-shift with instance features is outside this preview fit |
| Arc in-place | eligible alternative control plane | Useful for ESU/assessment while preparing the Azure move |

## Phase B ranking summary

SQL MI ranks first because it preserves instance-level compatibility with much lower operational burden than SQL VM. SQL VM is the best alternative if later assessment finds unsupported linked-server providers, file-system dependencies, or latency/IOPS needs that exceed the selected MI tier.

## Output card

> **Preliminary recommendation — `Finance DB group (3 DBs)`**
> **Azure SQL Managed Instance — General Purpose** via **Log Replay Service** · status **provisional** · confidence **medium**
> KB **v2.2** · commit **abc1234** · fetched **2026-07-27T10:45:00Z**

SQL MI is the recommended assessment path because the workload needs SQL Agent, cross-database queries, and linked servers, while the team wants managed PaaS; SQL Server 2014 and blocked MI Link ports 5022/11000–11999 make MI Link unavailable, so LRS is the practical online method with planned cutover downtime.

**📋 Primary recommendation**

| | Recommendation |
| --- | --- |
| 🎯 **Target / tier** | Azure SQL Managed Instance — **General Purpose** |
| 🔁 **Migration method** | Log Replay Service: full backup to Blob, then differential/log catch-up |
| 👁️ **Target availability during sync** | `unavailable` — SQL MI database remains RESTORING/NORECOVERY during sync |
| ⏱️ **Business cutover downtime** | `minutes` expected for General Purpose with a small final backup; validate with a rehearsal |
| 🧭 **Assess / orchestrate** | SSMS 22 Migration Component + dependency discovery; Arc for ESU during project |
| 💰 **Cost view** | Cost levers only: AHB eligible, ESU via Arc while on-prem, reservations after sizing; no estimate until measured sizing/pricing |

**Why General Purpose, not Business Critical** — interview inputs indicate moderate IOPS and latency sensitivity, no read-scale requirement, no strict zone-redundant SLA requirement, and steady non-tenant workload. Business Critical would win if assessment shows low-latency storage, high log throughput, readable secondary, or stricter HA/SLA needs.

**🥈 Best alternative** — **SQL Server on Azure VM** with native backup/restore or log shipping; wins if dependency discovery finds file-system dependencies, unsupported linked-server providers, third-party agents, or performance requirements not suitable for SQL MI GP/BC.

**🚫 Excluded or constrained targets (Phase A eligibility)**
- **Azure SQL Database** — unsupported: SQL Agent, linked servers, and cross-DB dependencies require refactoring.
- **SQL MI Link method** — unsupported: source is SQL Server 2014 and required MI Link ports 5022 plus 11000–11999 are not approved in the required directions.
- **Fabric SQL DB** — unsupported: preview path is not a fit for this OLTP instance-feature lift-and-shift.
- **Arc in-place** — eligible as an interim control plane for ESU, assessment, and migration orchestration, not the final runtime target.

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
  "profile": {
    "source": {
      "location": "on-prem",
      "version": "SQL Server 2014",
      "edition": "Enterprise",
      "os": "Windows Server 2016",
      "compatibilityLevel": 120,
      "haTopology": "none; log backups every 15 minutes"
    },
    "workload": {
      "scope": "3 finance databases",
      "largestDatabaseGb": 1229,
      "peakLogGeneration": "20 GB/hour",
      "tierDrivers": ["moderate latency", "moderate IOPS", "steady usage"]
    },
    "dependencies": {
      "sqlAgent": true,
      "crossDatabaseQueries": true,
      "linkedServers": true,
      "filestream": false,
      "polybaseKind": null,
      "dtcKind": null,
      "sqlClrPermissionSet": "none",
      "ssis": true
    },
    "businessContinuity": {
      "downtimeTolerance": "minimal",
      "rpo": "15 minutes",
      "rto": "4 hours",
      "rollbackPlan": "keep source read-only during rollback window"
    },
    "security": {
      "tde": true,
      "authentication": ["Windows", "SQL"],
      "sovereignty": "standard commercial"
    },
    "network": {
      "expressRoute": true,
      "miLinkPort5022": "blocked",
      "miLinkPorts11000To11999": "blocked",
      "port1433": "open",
      "port443": "open",
      "adReachableFromAzure": true
    },
    "commercial": {
      "softwareAssurance": true,
      "ahbEligible": true,
      "esuViaArcDuringProject": true
    }
  },
  "recommendation": {
    "recommendationStatus": "provisional",
    "primary": {
      "target": "Azure SQL Managed Instance",
      "tier": "General Purpose",
      "method": "Log Replay Service",
      "targetAvailabilityDuringSync": "unavailable",
      "businessCutoverDowntime": "minutes on General Purpose with a small final backup; validate in rehearsal",
      "controlPlane": "SSMS 22 Migration Component"
    },
    "alternative": {
      "target": "SQL Server on Azure VM",
      "method": "native backup/restore or log shipping",
      "winsIf": "VM-only dependencies or unsuitable MI performance requirements are discovered"
    },
    "confidence": "medium",
    "assumptions": [
      "No FILESTREAM/FileTable, heterogeneous DTC, external RDBMS PolyBase connector, or SQL CLR dependency",
      "Linked servers can be recreated on SQL MI",
      "Region feature availability is confirmed before deployment"
    ],
    "unknowns": [
      "Tool-confirmed dependency inventory",
      "Measured peak IOPS, log-write latency, and LRS cutover rehearsal",
      "Region capacity and final network throughput"
    ],
    "hardBlockers": [
      "MI Link unavailable because source version is 2014 and required ports 5022 plus 11000–11999 are blocked"
    ],
    "evidenceRequired": [
      "SSMS 22 Migration Component assessment",
      "Dependency discovery for linked servers, jobs, and SSIS",
      "Test restore with TDE certificate installed first",
      "Extended Events capture, RML Utilities or OStress replay, Query Store and DMV analysis"
    ],
    "evidence": [
      "Tier 1 and Tier 2 interview answers",
      "SQL migration knowledge base v2.2"
    ]
  },
  "knowledgeBase": {
    "version": "v2.2",
    "commit": "abc1234",
    "verifiedAt": "2026-07-27T10:45:00Z"
  }
}
```
