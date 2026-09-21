# Open knowledge base findings

Weekly check of 14 September 2026, re-verified against Microsoft documentation on 15 September.
Nothing applied yet. Tick a row when it lands and say in which release.

| # | Where | What we say | What the page says now | Fix | Lines |
|---|---|---|---|---|---|
| 1 | `migration.md` 135, 234 | Migration Assistant is Preview; no Private Link | No Preview marking; Private Link never mentioned; VNet data gateway is the exclusion. 20 MB DACPAC and on-prem gateway hold | Drop Preview, swap Private Link for VNet gateway | 2 |
| 2 | `migration.md` §8, DMS × AVS | Dash, reads as indirect route | AVS is not a DMS target | Change to a cross | 3 |
| 3 | `decision-rules.md`, AVS log shipping | `BACKUP-BLOB-PATH` applies | Log shipping uses a backup share, not Blob | Remove the gate, require a proven share | 1 |
| 4 | `connectivity.md` 74, 79, 120, 126, 141, 452, 459, 593, 603, 678, 717 | Redirect needs 11000-11999 plus 1433; a section calls it disputed | Range absent from the page. Only 1433 across the subnet range, plus DNS. Redirect is the default since Oct 2025, `proxyOverride=Default` deprecated | State 1433, delete the disputed section, add the default and the alias | 11 |
| 5 | `decision-rules.md`, LRS | Minutes on GP, hours on BC | BC wording confirmed. "Minutes" appears nowhere. A job is cancelled after 30 days | Drop the GP figure, add the 30-day ceiling | 2 |
| 6 | `decision-rules.md`, Arc | One minimum source version | Three: overview 2014, LRS 2012 RTM, MI Link 2016 SP3 + Azure Connect pack. No Windows Server floor | Split into three, drop the Windows floor | 3 |
| 7 | `migration.md` §12, AVS | Roughly hours (vMotion) | §11 of the same document says HCX live migration is near zero | Separate vMotion from bulk and cold | 1 |
| 8 | `decision-rules.md`, BACPAC | `BACKUP-BLOB-PATH` applies to all BACPAC | SqlPackage imports a local file directly | Apply only when the workflow stages in Blob. **Needs a decision: collect the fact or set a default** | 1 |
| 9 | `migration.md`, ADS | SSMS 22, Arc, DMS | Leads with VS Code + MSSQL. Never writes "SSMS 22". Arc is scoped to assessment. DMS not named | Put VS Code first, drop the version number, scope Arc | 1 |
| 10 | `migration.md`, cross-cloud | EC2, GCP Compute, GCP Cloud SQL sourced here | Page names Amazon RDS only | Re-point or remove. Same page as row 2 | 1 |
| 11 | `migration.md`, AHB | VM eligibility sourced here | Page covers SQL DB and MI only | Re-point to the SQL VM licensing page | 1 |
| 12 | `migration.md`, DMA | SSMS 22, Arc, Azure Migrate | Page names none of them, and is archived | Keep the date, source elsewhere, mark archived | 1 |
| 13 | `prerequisite.md`, appliance | To verify | VMware is 32 GB, 8 vCPU, ~80 GB, WS2022/2025. Hyper-V is 16 GB | Check the VMware row does not carry 16 GB | 0-1 |
| 14 | One anchor, two 403/429 links | — | URLs are in the `weekly-review` artifact of run 34861988927, not in the issue | Open the artifact first | 3 |

**31 lines, 5 files.** Rows 1 to 3 are 6 lines and remove three wrong facts.

## Two traps

- **11000-11999 serves two unrelated things.** Client redirect to Managed Instance is the one
  that changed, row 4. The MI Link distributed availability group endpoint, paired with 5022
  in `migration.md` and `decision-rules.md`, is documented on a page nobody has re-read.
  Leave it alone.
- **Changelog rows record what was true at the time.** Do not rewrite them, in any knowledge
  base.

## Release

Rows 1, 3, 4, 5, 6 and 8 touch `reference/decision-rules.md`, which forces the full
coordinated release across every surface the README lists.

## Sources

| # | URL |
|---|---|
| 1 | https://learn.microsoft.com/en-us/fabric/database/sql/migration-assistant |
| 2, 10 | https://learn.microsoft.com/en-us/azure/dms/resource-scenario-status |
| 3 | https://learn.microsoft.com/en-us/sql/database-engine/log-shipping/about-log-shipping-sql-server |
| 4 | https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/connection-types-overview |
| 5 | https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/log-replay-service-migrate |
| 6 | https://learn.microsoft.com/en-us/sql/sql-server/azure-arc/migration-overview |
| 7 | https://learn.microsoft.com/en-us/azure/azure-vmware/introduction |
| 8 | https://learn.microsoft.com/en-us/azure/azure-sql/database/database-import |
| 9 | https://learn.microsoft.com/en-us/sql/tools/whats-happening-azure-data-studio |
| 11 | https://learn.microsoft.com/en-us/azure/azure-sql/virtual-machines/windows/licensing-model-azure-hybrid-benefit-ahb-change |
| 12 | https://learn.microsoft.com/en-us/previous-versions/sql/dma/dma-overview |
| 13 | https://learn.microsoft.com/en-us/azure/migrate/migrate-appliance |

## Out of scope

Blind behaviour evaluation: the protocol shows the model the expected answer before asking it
to score itself. Recorded so it is not lost. Microsoft has an open pull request proposing an
evaluation framework.
