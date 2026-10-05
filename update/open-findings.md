# Open knowledge base findings

Weekly checks of 14 September and 5 October 2026. Rows 1 to 14 were re-verified against Microsoft
documentation on 15 September. Rows 15 to 21 come from the 5 October run; rows 15 and 19 have been
checked so far. Rows 22 and 23 were added by hand: the run listed the news but proposed no edit.
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
| 14 | One anchor, two 403/429 links | Reported on 14 Sept, URLs in the `weekly-review` artifact of run 34861988927 | The 5 Oct run says every URL and anchor resolves; its 18 bot-blocked links are counted, not listed | Probably resolved. Confirm in the artifact, then tick | 0 |
| 15 | `migration.md` 15, 138, 150, §4.1; `decision-rules.md` §A3, §B3, 506; `SKILL.md` | Arc migrates to SQL MI and SQL Server on Azure VM | Arc also migrates to Azure SQL Database, Hyperscale included, in preview: a DMS logical migration through a self-hosted integration runtime, with planned downtime | Add the target, gated on preview acceptance. Do it with row 6 | ~10 |
| 16 | `migration.md` §5.4, §8 BACPAC row; `decision-rules.md` 381, 382; `prerequisite.md` 230, 616; `advisor-coverage.json` | Fabric takes a DACPAC only, and the rules forbid offering a BACPAC import | The Fabric migration overview documents SqlPackage with a .bacpac plus a Copy job | Add the route, keep DACPAC as the assistant's schema-only path, lift the prohibition. Do it with row 1 | ~10 |
| 17 | `migration.md` 200; `decision-rules.md` 50, 357, 557; `prerequisite.md` P08-006; `path-catalog.json`; `SKILL.md` | One link per database, always | A preview mode replicates several databases of an existing availability group over one link | Keep one per database for the single-database mode, add the preview mode gated on preview acceptance and an existing AG | ~9 |
| 18 | `migration.md` §4, §14, §16; `decision-rules.md` §D2 | Nothing on SQL Migration Agent Skills | GA on 29 Sept 2026: assessment, target selection, migration, validation. The wider Microsoft SQL Agent Skills are in public preview | Add them as an agent layer, not a data-movement method. Read the third trap first | ~5 |
| 19 | `decision-rules.md` 304, 323 | Log shipping needs a Windows source | Log shipping is documented on Linux, and `migration.md` 192 already says so | Remove the Windows-only gates, keep the version and log-chain checks | 2 |
| 20 | `connectivity.md` 333; `connectivity-matrix.json` | `ActiveDirectoryMSI` from JDBC 8.3.1 | From JDBC 7.2 | Set 7.2, leave `ActiveDirectoryManagedIdentity` at 12.2 | ~3 |
| 21 | `connectivity.md` 493-499; `connectivity-matrix.json` | Encryption and certificate-validation defaults | The watched section changed; the run proposed no edit | Read the section, then edit or re-baseline | 0-2 |
| 22 | `migration.md` 444, 457, sovereignty and edge | Nothing on Azure Local | SQL Server on Azure Local is GA, connected and disconnected (28 Sept), on Windows or Linux VMs. Licences: SA, subscription or pay-as-you-go through Arc when connected, Azure Hybrid Benefit when disconnected | Name it in the sovereignty and edge branch, or decline in writing | 0-3 |
| 23 | `migration.md` 15, 151 | SSMS 22 assesses and migrates | The SSMS migration assessment adds configuration readiness, a target recommendation, sizing and a pricing estimate. The blog gives no version and no preview status | Confirm on Learn, then record it. The skill can then name SSMS as evidence for tier and cost | ~3 |

**About 75 lines, 8 files**, plus about five golden scenarios (one per rule changed) and a
re-baseline of the drifted claims, which the script does. Seven rows state something false today:
1, 2, 3, 4, 16, 19 and 20. Do rows 1 and 16 together, and rows 6 and 15 together: they touch the
same lines.

## Traps

- **11000-11999 serves two unrelated things.** Client redirect to Managed Instance is the one
  that changed, row 4. The MI Link distributed availability group endpoint, paired with 5022
  in `migration.md` and `decision-rules.md`, is documented on a page nobody has re-read.
  Leave it alone.
- **Changelog rows record what was true at the time.** Do not rewrite them, in any knowledge
  base.
- **Row 18: do not apply the run's wording as is.** It sets SQL Migration Agent Skills apart from
  this repository's advisor, but `recommend-migration-path` and
  `generate-migration-prerequisite-plan` ship inside them, in microsoft/microsoft-sql.
- **`SKILL.md` repeats rows 1, 5, 6, 15 and 17** in its factual-gates table. Fix both copies, or
  remove that table first, which also cuts the skill's token count.

## Release

Rows 1, 3, 4, 5, 6, 8, 15, 16, 17, 18 and 19 touch `reference/decision-rules.md`, which forces
the full coordinated release across every surface the README lists. Ship them in one release,
then align microsoft/microsoft-sql by pull request, issue first.

## Weekly check gaps

- The Microsoft Data Migration blog is not among the feeds in `tools/weekly-check/keywords.json`,
  though DMS, Arc migration, SSMS and SSMA announcements are published there. Row 23 came in only
  through a Learn page title. The feed works:
  https://techcommunity.microsoft.com/t5/s/gxcuf89792/rss/board?board.id=MicrosoftDataMigration
- The claims registry watches the Prerequisites section of the Arc migration page, not its
  Migration targets section. Row 15 came in through Azure Updates, not through the drift check.
- Rows 2, 3, 7 and 8 are absent from the 5 Oct report and still open. A finding the run stops
  proposing is not a fixed finding.
- The 5 Oct report says the link checker "exited non-zero (`0`)", which contradicts itself.

## Sources

| # | URL |
|---|---|
| 1 | https://learn.microsoft.com/en-us/fabric/database/sql/migration-assistant |
| 2, 10 | https://learn.microsoft.com/en-us/azure/dms/resource-scenario-status |
| 3 | https://learn.microsoft.com/en-us/sql/database-engine/log-shipping/about-log-shipping-sql-server |
| 4 | https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/connection-types-overview |
| 5 | https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/log-replay-service-migrate |
| 6, 15 | https://learn.microsoft.com/en-us/sql/sql-server/azure-arc/migration-overview |
| 7 | https://learn.microsoft.com/en-us/azure/azure-vmware/introduction |
| 8 | https://learn.microsoft.com/en-us/azure/azure-sql/database/database-import |
| 9 | https://learn.microsoft.com/en-us/sql/tools/whats-happening-azure-data-studio |
| 11 | https://learn.microsoft.com/en-us/azure/azure-sql/virtual-machines/windows/licensing-model-azure-hybrid-benefit-ahb-change |
| 12 | https://learn.microsoft.com/en-us/previous-versions/sql/dma/dma-overview |
| 13 | https://learn.microsoft.com/en-us/azure/migrate/migrate-appliance |
| 15 | https://azure.microsoft.com/updates?id=571795 |
| 16 | https://learn.microsoft.com/en-us/fabric/fundamentals/migration |
| 17 | https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/managed-instance-link-feature-overview |
| 18 | https://azure.microsoft.com/updates?id=571899 (GA), https://azure.microsoft.com/updates?id=573003 (preview) |
| 19 | https://learn.microsoft.com/en-us/sql/linux/sql-server-linux-use-log-shipping |
| 20 | https://learn.microsoft.com/en-us/sql/connect/jdbc/connecting-using-azure-active-directory-authentication |
| 21 | https://learn.microsoft.com/en-us/sql/connect/ado-net/encryption-and-certificate-validation |
| 22 | https://azure.microsoft.com/updates?id=571841, https://azure.microsoft.com/updates?id=571836 |
| 23 | https://learn.microsoft.com/en-us/ssms/migrate/migrate-sql-server-azure-sql |

## Out of scope

Blind behaviour evaluation: the protocol shows the model the expected answer before asking it
to score itself. Recorded so it is not lost. Microsoft has an open pull request proposing an
evaluation framework.
