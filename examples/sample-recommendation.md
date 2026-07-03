# Example run — SQL Migration Advisor

A worked example showing the interview answers and the resulting recommendation.
Use it to calibrate tone and the output card. **The numbers are illustrative.**

## Interview answers (collected via `ask_user`, one at a time)

| # | Question | Answer |
| --- | --- | --- |
| 1 | Scope | A few databases (2–10) |
| 2 | Source location | On-prem |
| 3 | Source version | 2014 |
| 4 | Primary driver | End-of-support / ESU pressure |
| 5 | Management model | Fully managed PaaS preferred |
| 6 | Instance-level features | SQL Agent jobs, Cross-DB queries, Linked servers |
| 7 | Largest DB size | 150 GB – 4 TB (≈ 1.2 TB) |
| 8 | Downtime tolerance | Minimal (a couple of hours) |
| 9 | Network & ports | Good ExpressRoute; can open 5022 / 1433 / 443 |
| 10 | Compliance | Standard commercial |
| 11 | Ancillary services | SSIS packages, TDE-encrypted DBs |

## Reasoning (Steps A→D)

- **A — Target:** Instance-level features present (SQL Agent, cross-DB, linked servers) but
  **no** VM-only features → **Azure SQL Managed Instance** (managed lift-and-shift). Fully-managed
  preference confirms PaaS over VM. → **SQL MI, General Purpose**.
- **B — Method:** Source **2014** → MI Link needs 2016+, so **MI Link is out**. Downtime = minimal,
  size ≈ 1.2 TB, ExpressRoute available → **Log Replay Service (LRS)** with diff/log catch-up
  (offline-but-short), seeding the full backup over ExpressRoute.
- **C — Blockers:** **TDE** → migrate the server certificate **first**. **Linked servers** → OK on
  MI (re-point post-cutover). **SSIS** → Azure-SSIS Integration Runtime. Open **443/1433** for LRS.
- **D — Cost/program:** **AHB** applies to SQL MI; on-prem **ESU via Arc** while the project runs.
  Assess with **SSMS 22 Migration Component** (or Arc + Copilot). Program: **SQL in a Day** +
  **Cloud Accelerate Factory**.

## Output card (new readable format)

> **Verdict — `Finance-DB group (3 DBs)`**
> **Azure SQL Managed Instance (GP)** via **Log Replay Service** · downtime **minimal** · grounded in the FY27 SQL knowledge base.

Instance features (SQL Agent, cross-DB, linked servers) rule out SQL DB, and the
fully-managed preference rules out VM — so SQL MI is the managed lift-and-shift; source
SQL 2014 can't use MI Link (needs 2016+), so LRS gives a short planned cutover.

**📋 At a glance**

| | Recommendation |
| --- | --- |
| 🎯 **Target** | Azure SQL Managed Instance — General Purpose |
| 🔁 **Method** | Log Replay Service (full backup seeded over ExpressRoute + diff/log catch-up) |
| ⏱️ **Downtime** | minimal (short planned cutover) |
| 🧭 **Assess / orchestrate** | SSMS 22 Migration Component (or SQL migration in Azure Arc, Copilot-assisted) |

**🚧 Blockers & fixes**
- **TDE-encrypted DBs** → migrate the TDE server certificate to MI **first** (else restore fails ~80% in)
- **SSIS packages** → stand up Azure-SSIS Integration Runtime, host SSISDB, migrate packages
- **Outbound 443/1433 to Azure Blob/SQL** → confirm egress is open

**🔌 Ancillary** — SSIS → Azure-SSIS IR · SQL Agent jobs → native on MI · linked servers → re-create on MI post-cutover.

**💰 Cost & program**
- **AHB** eligible (SQL MI, vCore) · **ESU** via Azure Arc on-prem during the project
- **Sizing:** Perfmon ≥ 7 days + ~20% headroom (never average CPU)
- **Programs:** SQL in a Day + Cloud Accelerate Factory (zero-cost delivery)

> ⚠️ **Biggest risk:** TDE certificate order — migrate the server-level cert to MI *before* any restore, or the restore fails ~80% in with no clear message. Validate with **DEA** capture+replay before cutover.

🔗 *https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/log-replay-service-migrate* · caveat: if you can upgrade the source to 2016+ first, **MI Link** unlocks near-zero downtime instead of LRS.
