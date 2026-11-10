# Open knowledge base findings

Source: the weekly knowledge-base checks of 14 September to 9 November 2026 (issue #75), audited on
10 November against the live Microsoft sources and the text now in HEAD (last knowledge-base commit:
13 September). The file has two parts: **To do** (17 findings kept with their corrected fix, plus one decision, 28b) and **Not doing** (the 23 others, with the reason). Both are
recorded in the comment of 10 November on issue #75
(https://github.com/fredgis/sql-migration-advisor/issues/75#issuecomment-6774890874), and the corrections
made after a review of the plan are in the follow-up comment
(https://github.com/fredgis/sql-migration-advisor/issues/75#issuecomment-6775214583). Row numbers are
the ones used since the findings were first recorded, so there are gaps. Rows are ordered by
criticality. Nothing applied yet. Tick a row when it lands and say in which release.

## To do

Criticality: **High** = HEAD states something the sources contradict, **Medium** = incomplete,
**Low** = minor. Regression risk: 🔴 the executable mirror (`tests/engine/evaluate.mjs`) or golden
scenarios must change, 🟠 data, matrix or regex-checked text, 🟢 prose only.

| # | Where | What we say | What the source says now | Fix | Criticality | Regression risk |
|---|---|---|---|---|---|---|
| 1 | `migration.md` 135, 230, 234, 378; `decision-rules.md` 49, 96, 165, 380; `SKILL.md`; `README.md` 152, 180; `prerequisite.md` 57 and §19 (P16); `path-catalog.json` 533 (`supportStatus: preview_tool_ga_target`); `tests/engine/evaluate.mjs` 260-266 | The Fabric Migration Assistant is Preview, with "no Private Link", and a preview-acceptance gate applies to it | Generally Available since August 2026 (Fabric What's new). Doc of 24 Aug 2026: DACPAC up to 20 MB, on-premises data gateway only, VNet data gateway unsupported, no preview marking, Private Link never mentioned | Drop Preview everywhere. Replace "no Private Link" with "no VNet data gateway". Remove the preview-acceptance gate for the assistant. Do with row 16 | High | 🔴 engine gate and 9 Fabric scenarios: 6 carry "preview accepted / not acceptable" in their inputs, 3 expect "Migration Assistant Preview gates apply only if that path is chosen" |
| 16 | `migration.md` §5.4, §8 BACPAC row; `decision-rules.md` 381-382; `prerequisite.md` 227-230, 616; `advisor-coverage.json`; `path-catalog.json` 357-363 (P11 target variants); `tests/engine/evaluate.mjs` 972 | Fabric takes a DACPAC only, and the rules forbid offering a BACPAC import ("do not substitute a BACPAC import") | Fabric "SqlPackage for SQL database in Fabric": a .bacpac can be imported into an empty SQL database with `sqlpackage /action:import`. The Fabric migration overview lists "SqlPackage and Copy job". `evaluate.mjs` 659 already lists bacpac for Fabric | Lift the prohibition, but do not turn a refused assistant into a BACPAC recommendation automatically: the import needs an empty target database, a source that fits the Fabric T-SQL surface (the page says it may need altering) and a volume to qualify. Keep DACPAC as the assistant's schema path. Give BACPAC to Fabric a prerequisite path (P11 has no Fabric variant today) and separate the SqlPackage constraints from the assistant's (P16). Bring back the residual of the dropped row 8: `evaluate.mjs` 972 still treats every BACPAC as Blob-bound, so a local SqlPackage fallback can be rejected for a Blob reason. Do with row 1 | High | 🔴 3 scenarios send a refused assistant to Azure SQL Database and must be re-decided: `fabric-dacpac-too-large-remediation`, `fabric-small-database-with-an-oversized-dacpac-needs-another-path`, `fabric-preview-refused-keeps-the-ga-target-through-another-path` (the last one also forbids a Fabric answer) |
| 19 | `decision-rules.md` 304, 323; `migration-methods.json` 20; `prerequisite.md` P03-006 (121); `path-catalog.json` 116-128 (P03 question fields); `tests/engine/evaluate.mjs` 516-521 | Log shipping needs a Windows source ("Windows-only"). `migration.md` 192 already says Windows and Linux, so HEAD contradicts itself | Learn "Get started with log shipping on Linux": SQL Server Agent on both servers plus a CIFS/Samba share, Linux to Linux. Windows to Linux is not documented | Replace the Windows-only gate with an OS-pair condition instead of removing it: Windows to Windows as today; Linux to Linux documented (and P03-006 already assumes it); Windows to Linux and Linux to Windows neither documented nor excluded, so ask or leave to confirm; destination OS unknown, ask and do not promote log shipping. No contract collects the target OS (P03 asks `source_os` only), so either add a target-OS fact (contract, both schemas, `advisor-fact-mappings.json`, question) or keep the cross-OS case as "to confirm". Keep the version and log-chain checks | High | 🔴 scenario `dms-online-to-sql-vm-linux-source` has no target OS and must not flip automatically; `chooseSqlVmMethod` returns DMS online for a Linux source with a minimal window. Add scenarios for Linux to Linux, cross-OS and unknown target OS, and keep Windows to Windows unchanged |
| 28 | `migration.md` 538-540, 544; `decision-rules.md` §A1 `AVS-LICENSING` 109-111, 124; `prerequisite.md` P27-003 (531); `path-catalog.json` 922-924 | Pay-as-you-go retires 15 Oct 2026, new sales end 31 Oct 2026, reserved instances end 30 Aug 2027; "a recommendation made today on a pay-as-you-go assumption fails in under two months" | Azure Updates 569535 and the Learn portable VCF licensing reference: from 1 Nov 2025 new deployments must use portable VCF; license-included pay-as-you-go must transition by **31 Oct 2026**; reserved instances end 30 Aug 2027, and a reservation expiring earlier ends its benefit at expiry. The 15 Oct date appears only as 15 Oct 2025 (vDefend cores). The run proposed HEAD's own dates | Dates and wording only: re-date the table from the sources, rewrite the "under two months" wording in the past tense, keep "AVS is not retiring". Leave the changelog row v2.10 as it is. The eligibility rule is a separate decision, row 28b | High | 🟢 nothing reads the dates except the three catalog fields |
| 29 | `connectivity.md` §2.2 (83, 102); `connectivity-matrix.json` `mi-default-connection-type` | Redirect is the Managed Instance default since October 2025, stated without condition | Learn "Connection types": since Oct 2025 a programmatic deployment or update with `proxyOverride=Default` is interpreted as Redirect and never preserved; instances set to Default before Oct 2025 "are converted to Proxy" | State the effective-value rule; diagnostics must read the effective connection type. Do with row 4 | High | 🟠 matrix field |
| 4 | `connectivity.md` 74, 79, 120, 126, 141, 452, 459, 593, 603, 678, 717; `connectivity-matrix.json` (DISPUTED block 88-93, 761-792) | Redirect needs 11000-11999 plus 1433; a section calls it disputed | Learn "Connection types": redirect needs port 1433 across the instance's subnet range plus DNS resolution of the instance zone; 11000-11999 appears nowhere on the page | State 1433 plus DNS as documented, add the default and the alias (`proxyOverride=Default` is deprecated and now an alias of Redirect). Keep a one-line hedge that older Bicep/ARM quickstarts still create 11000-11999 NSG rules instead of deleting the section. Do with row 29. Do not touch the MI Link range 11000-11999 | High | 🟠 matrix text. No golden scenario covers redirect ports (the 28 golden mentions of 11000 are MI Link) |
| 17 | `migration.md` 200; `decision-rules.md` 50, 357, 557; `prerequisite.md` P08-006; `reference/input-contract.md` §4 and §8; both skills' `schemas/input.schema.json`; `advisor-fact-mappings.json`; `questions.json`; `path-catalog.json` (path level only); both `SKILL.md` | One link per database, always | Learn MI link overview, the "Extend an Always On availability group" page and the Azure SQL blog of 29 Sep: multiple-database mode (preview) replicates all databases of an availability group over one link, and an existing availability group is not required (SSMS can place standalone databases in a new single-node AG). Needs SQL Server 2022 CU27+ or 2025 CU9+ (Windows or Linux), Enterprise or Developer (not Standard), MI update policy SQL Server 2025 or Always-up-to-date, SSMS 22.10.2+. Cannot coexist with single-database links on one instance, and the mode cannot be changed in place. The pages differ on the SQL Server 2022 update policy: the overview states the general rule, the detailed page excludes the 2022 policy for this mode, and the blog expects support "in the coming weeks" | Keep one link per database for the single-database mode, with its criteria unchanged (Standard edition and SQL Server 2016 and later stay valid there). Add the multiple-database mode as a distinct mode behind preview acceptance, with its own criteria, never applied to the shared MI Link filter. Flag the 2022 update policy inconsistency instead of hard-coding it. Carry the mode through the canonical contract (every field needs a question, a type, a consumer and a golden scenario, and no hard gate may read an absent field), both schemas and the fact mapping, so the recommendation and the prerequisite plan stay in step. Do with row 35 | Medium | 🔴 new input, gate, contract, schemas, fact mapping and scenarios; the 5 existing capacity scenarios and every single-database scenario stay valid |
| 28b | `decision-rules.md` §A1 `AVS-LICENSING` table; `migration.md` §15.1; `tests/golden-scenarios.json` 1114 (`datacenter-exit-vmware-avs`); both skills' contracts if a licence-type fact is added | Relying on license-included, or an unknown licence, holds AVS at `unknown_requires_assessment`; a confirmed portable VCF licence makes it eligible | Same sources as row 28: new deployments have required portable VCF since 1 Nov 2025, pay-as-you-go had to transition by 31 Oct 2026, reserved instances end 30 Aug 2027 | **Decision needed.** Keep today's rule (dates fixed by row 28), or adopt the finer one: a valid existing license-included reservation is `eligible_with_remediation` until its term and 30 Aug 2027 at most; an unknown entitlement stays `unknown_requires_assessment`; a new deployment relying on license-included capacity is unsupported, for a commercial reason. The finer rule changes eligibility, so it needs a licence-type fact (portable VCF, existing reservation with its expiry, unknown) carried the same way by both skills | Medium | 🔴 scenario `datacenter-exit-vmware-avs` expects AVS `eligible` with no licence answer; the recommendation and the prerequisite plan must give the same qualification and the same unknowns |
| 15 | `migration.md` 15, 138, 150, §4.1; `decision-rules.md` §A3, §B3, 506; `SKILL.md`; `tests/engine/evaluate.mjs` 895-901 | Arc migrates to SQL MI and SQL Server on Azure VM ("MI and VM targets both GA") | Azure Updates 571795 (29 Sep) and Learn: Arc also migrates to Azure SQL Database, Hyperscale included, in public preview, through DMS and a self-hosted integration runtime | Add the target, gated on preview acceptance. The preview concerns the Arc orchestration to Azure SQL Database, not Azure SQL Database itself: a refusal removes only that orchestration and keeps the GA routes to SQL Database. Keep `controlPlane=azure-arc` in the hand-off to the prerequisite plan (the mirror maps DMS to `azure-dms`, `evaluate.mjs` 895-901) | Medium | 🔴 Arc candidate set, preview gate and control-plane mapping in the mirror |
| 31 | `prerequisite.md` §14 P11-010 (243) | Instance-scoped objects are scripted separately only for SQL MI, SQL VM and Arc-enabled SQL MI | A BACPAC carries only user-database schema and data. P11 also covers SQL containers, and an AVS-hosted SQL Server is a full instance like a SQL VM. The cited sqlpackage page does not state the instance-object point | Extend the applicability to AVS-hosted and containerised SQL Server. Markdown only: `path-catalog.json` has no row-level data | Medium | 🟢 |
| 32 | `prerequisite.md` §16 P13-011 (290) | The requirement says "in any role", the applicability says subscriber only | Learn: SQL Server 2017 CU18 and later support replication for instances of SQL Server on Linux, with no role distinction | Apply whenever any publisher, distributor or subscriber is Linux-hosted or containerised. Markdown only | Medium | 🟢 |
| 33 | `prerequisite.md` §16 P13-013 (292) | The UNC snapshot folder applies only when the subscriber is a containerised SQL Server | Learn "Secure the snapshot folder": a remote distributor or pull subscriptions require a UNC share rather than a local path | Drop the container condition and apply to any pull subscription or remote distributor. Markdown only | Medium | 🟢 |
| 34 | `prerequisite.md` §24 P21-009 (413) | The private-sink self-hosted integration runtime names SQL VM, Arc-enabled SQL MI and containers, not AVS | The Data Factory SQL Server connector requires a self-hosted integration runtime for stores inside an on-premises network or a virtual network. AVS is not named, so this is an inference | Add an AVS-hosted SQL Server with no public endpoint. Markdown only | Low | 🟢 |
| 35 | `decision-rules.md` §A0, §B3 `MI-LINK-CAPACITY`; `migration.md` §5.2 | Link capacity derived straight from `database_count` (100 or 500 "links") | Learn MI link overview: in multiple-database mode every replicated database still counts toward the instance-wide limit (100 for General Purpose and Business Critical, 500 for next-gen); only the number of links changes | Reword "links" to "databases" in the capacity text, keep `database_count` at or below the limit in both modes and check the capacity left on the target (existing databases count against it). Do not relax the check. Do with row 17 | Low | 🟢 wording; 🔴 if the check is relaxed (5 capacity scenarios) |
| 5 | `decision-rules.md` 428; `migration.md` 319 | LRS cutover is minutes on General Purpose, hours on Business Critical | Learn LRS: a job is cancelled after 30 days; Business Critical seeding takes "up to several hours"; no figure for General Purpose. "Minutes" is our own estimate, stored in `decision-rules.data.json` (`businessCutoverDowntimeByTier.default`) | Add the 30-day ceiling. Label "minutes" as an estimate instead of dropping it | Low | 🟢 for the ceiling; 🔴 if "minutes" is dropped (13 of 16 LRS scenarios, the data file and `evaluate.mjs` 199) |
| 6 | `reference/claims-registry.json`, claim `arc-sql-migration-minimum-source-versions` | The claim watches the "Prerequisites" section of the Arc migration overview | That section no longer exists on the overview. The floors now sit on the Arc to Managed Instance page (MI Link: SQL Server 2016 on Windows Server 2016; LRS: SQL Server 2012 on Windows Server 2012) and the overview gives 2014 for the whole experience. HEAD already splits these floors (`decision-rules.md` 349-353, `migration.md` 371) | Re-point `source_url` and `source_section` to the Arc to MI page, check the section exists, then re-baseline. No knowledge-base text to change. Without it the verifier hashes the whole page (`tools/weekly-check/verify-claims.mjs`, `sectionFromText`) | Low | 🟢 |
| 20 | `connectivity.md` 333, §7.8; `connectivity-matrix.json` 419-420 (`jdbc-auth-keywords`, `jdbc-msi-client-id`); `claims-registry.json` | `ActiveDirectoryMSI` needs JDBC 8.3.1; a minimum-version dispute is recorded | The JDBC page contradicts itself: the keyword list says "since 8.3.1", the dedicated section says "supported starting with version 7.2", the dependency table starts at 7.2. `ActiveDirectoryManagedIdentity` needs 12.2 | Record 7.2 (dedicated section and table) and keep 8.3.1 only as the `msiClientId` boundary. Keep a note that the page is inconsistent rather than deleting the dispute | Low | 🟢 no scenario |
| 39 | `prerequisite.md` 155 (P06-005) | The source link is `tutorial-migrate-vmware#run-a-test-migration` | The anchor is gone. The test-migration steps now sit under `#track-and-migrate-replicating-servers` | Re-point the link and update the checked date | Low | 🟢 |

**More than 100 lines in about 20 files** once the contracts, schemas, fact mappings, README, executable mirror and golden scenarios are counted (an estimate), plus
about ten new golden scenarios, one per rule changed, and a re-baseline of the drifted claims, which
the script does. Six rows state something the sources contradict: 1, 4, 16, 19, 28 and 29; row 20 is
contested inside the Microsoft page itself, and rows 31 to 34 are incomplete as written. Do rows 1 and
16 together (they move the same Fabric scenarios), rows 4 and 29 together, and rows 17 and 35
together: they touch the same lines.

## Conditions for the two skills

The recommendation skill and the prerequisite-plan skill must keep qualifying the same facts the same
way. A change in one that the other cannot receive is a regression even when every test passes.

Baseline at HEAD, as reported by the 10 November review: `node tests/run-tests.mjs` passes 76 of 76
checks (118 scenarios and the hand-off contracts) and `node tests/check-prerequisite-skill.mjs` passes
3,619 checks (28 paths, 77 questions, 291 prerequisites). That is a reference, not proof that future
changes are regression-free: the tests replay a mirror of the rules, not the agent reading the skills.

Replay these cases end to end, through both skills:

| Case | Result to preserve |
|---|---|
| Fabric, preview refused | The GA paths are still evaluated; no stale Preview prerequisite |
| Fabric with a local BACPAC, Blob blocked | No rejection for Blob; SqlPackage prerequisites adapted to Fabric |
| Linux source, destination OS unknown | Log shipping is not promoted automatically; a clarification is asked |
| Existing single-database MI Link | GA criteria unchanged; no multiple-database prerequisite imposed |
| Arc to SQL Database, preview refused | GA routes kept; orchestration handed over with `controlPlane=azure-arc` |
| AVS, licence unknown or existing reservation | Same commercial qualification and same unknowns in both results |

Invariants: no unknown fact is converted into a confirmation, no `ready` with a required prerequisite
unresolved, no recommendation without a matching prerequisite path. A scenario whose answer changes on
purpose must be justified by the source, not rewritten to make the tests pass.

## Traps

- **11000-11999 serves two unrelated things.** Client redirect to Managed Instance is the one
  that changed, row 4. The MI Link distributed availability group endpoint, paired with 5022
  in `migration.md` and `decision-rules.md`, is documented on a page nobody has re-read.
  Leave it alone.
- **Changelog rows record what was true at the time.** Do not rewrite them, in any knowledge
  base.
- **`SKILL.md` repeats rows 1, 5, 15 and 17** in its factual-gates table. Fix both copies, or
  remove that table first, which also cuts the skill's token count.
- **Row 28: check a date against its source, not against this knowledge base.** The run proposed
  the dates already in HEAD. The sources say 31 Oct 2026 for pay-as-you-go and 1 Nov 2025 for new
  deployments.
- **Rows 1 and 16 move the same Fabric scenarios.** Decide what a refused assistant falls back to
  (Azure SQL Database today) before touching them.
- **Row 19 flips `dms-online-to-sql-vm-linux-source`.** Linux log shipping is documented only Linux
  to Linux; keep that limit in the rule or the scenario stops being a witness.
- **Row 35: the instance-wide database limit still applies in multiple-database mode.** Do not
  relax `database_count`.

## Release

Rows 1, 5, 15, 16, 17, 19, 28 and 35 touch `reference/decision-rules.md`, which forces the full
coordinated release across every surface the README lists. Ship all sixteen rows in one release, then
align microsoft/microsoft-sql by pull request, issue first.

## Not doing

The 23 findings below were audited on 10 November and are not retained. Nothing is to be edited in the
knowledge base for them. They stay recorded so that the weekly check does not raise them again as new.
The four re-baseline rows (13, 21, 25, 37) still need their claim re-baselined by the script, after
revalidating the source and the section (see "Weekly check gaps").

| # | Finding | Decision | Why |
|---|---|---|---|
| 2 | DMS and AVS shown with a dash | Already fixed | The matrix shows AVS as unsupported (`migration.md` 335, v3.3). |
| 3 | AVS log shipping and `BACKUP-BLOB-PATH` | Already fixed | The gate applies only when Blob is chosen as the transport (`decision-rules.md` 323). The Windows-only wording left is row 19. |
| 7 | AVS vMotion "hours" | Already fixed | `migration.md` 441 separates HCX live from bulk and cold. |
| 8 | BACPAC and `BACKUP-BLOB-PATH` | Already fixed in the rules | `decision-rules.md` 40 and 556 scope it to "only when that workflow stages the file in Blob". The residual, the mirror treating every BACPAC as Blob-bound (`evaluate.mjs` 972), is handled in row 16. |
| 13 | Appliance sizes | Re-baseline only | P28-003 matches the page (VMware 32 GB, 8 vCPU, about 80 GB). |
| 14 | One anchor and two 403/429 links (14 Sept) | Closed | The artifact expired. The 2 Nov and 9 Nov reports list no 403/429 link; the broken anchor is now row 39. |
| 21 | SqlClient TLS defaults drift | Re-baseline only | HEAD still matches the page. |
| 25 | Private endpoint redirect drift | Re-baseline only | HEAD still matches (1433-65535, FQDN, Redirect chosen explicitly, JDBC 9.4 or above). |
| 37 | ODBC Entra values drift | Re-baseline only | HEAD still matches (no `ActiveDirectoryDefault`, `ActiveDirectoryPassword` deprecated). |
| 26 | MI regional limits (blog of 24 Aug) | Declined | No row quotes a regional subnet or vCore limit. |
| 36 | MI link with failover groups | Declined | Pre-announcement of a limited preview (21 Oct), nothing to advise. |
| 40 | SQL Server on Linux flexible provisioning | Declined | HEAD never mentions the Marketplace images; P25-002 and P26-011 are unaffected. |
| 9 | ADS replacements | Optional, not retained | The retirement date (28 Feb 2026) is right, citation hygiene only. |
| 10 | Cross-cloud sources | Optional, not retained | The page names Amazon RDS only; `migration.md` 407 already flags the inference. |
| 11 | AHB source for VMs | Optional, not retained | Citation hygiene. |
| 12 | DMA sources | Optional, not retained | The retirement date (16 Jul 2025) is right, citation hygiene. |
| 18 | SQL Migration Agent Skills (GA 29 Sep) | Optional, not retained | An agent layer, not a data-movement method. |
| 22 | SQL Server on Azure Local (GA 29 Sep) | Optional, not retained | The licence details are not in the announcements. |
| 23 | SSMS sizing and pricing | Optional, not retained | Enrichment only. |
| 24 | SGX enclaves retire 31 Oct 2027 | Optional, not retained | About twelve months of runway. |
| 27 | Standard service endpoint (GA 15 Oct) | Optional, not retained | An addition, not a correction. |
| 30 | TLS Strict ignores `TrustServerCertificate` | Optional, not retained | HEAD already says not to use it as a fix. |
| 38 | P27 overlay and P28 | Optional, not retained | The mirror attaches P27 only to a method path, and the catalog has no row-level data. |

## Weekly check gaps

- The Microsoft Data Migration blog is not among the feeds in `tools/weekly-check/keywords.json`,
  though DMS, Arc migration, SSMS and SSMA announcements are published there. The feed works:
  https://techcommunity.microsoft.com/t5/s/gxcuf89792/rss/board?board.id=MicrosoftDataMigration
- The claims registry watches a Prerequisites section that no longer exists on the Arc migration
  overview, and not its Migration targets section. Row 15 came in through Azure Updates, not through
  the drift check.
- A finding the run stops proposing is not a fixed finding. Rows 15, 16 and 20 dropped out of the 12 Oct
  report and row 17 out of the 19 Oct one because their announcements left the 7-day news window. A
  finding that leaves the window stays open until it lands. The feeds also carry the date of the last
  update, not the publication date, so some posts of 24 Aug, 29 Sep and 21 Oct reached the run weeks late.
- The 14 drifted claims have barely moved since 14 Sept (12 were already drifted then): nobody
  re-baselines a claim until its rule is edited, so the report keeps raising the same list. After the
  10 Nov audit, five of them sit behind retained rows (1, 4 and 29, 5, 17, 20) and one behind row 6. Six were re-read and still
  match their source, but revalidate the source and the section before each re-baseline (see the last bullet): the Azure Data Studio and Data Migration Assistant
  retirement dates, the
  private endpoint redirect, SqlClient encryption, ODBC Entra and Azure Migrate appliance claims. Two
  (Azure Hybrid Benefit applicability, cross-cloud sources) were not re-read in full.
- The link checker says "exited non-zero (`0`)", which contradicts itself. On 9 Nov one link of 559 failed
  and the classifier could not attribute it. Six weeks running means a defect of the classifier, not a
  transient failure. The prerequisite contract test "could not confirm every source and anchor it cites"
  for as long, while the source verifier found 218 of 218 resolving until 9 Nov, when it found the
  broken anchor of row 39, which is probably what the contract test was trying to say.
- The 10 Nov audit found three more gaps. The claims verifier falls back to the whole page when a
  claim's section heading is missing (`tools/weekly-check/verify-claims.mjs`, `sectionFromText`), so a
  vanished section looks like ordinary drift and a blind re-baseline locks a whole-page hash (row 6). The run's "companion updated (`path-catalog.json`)" box is
  generated even where the catalog has no row-level data (P11-010, P13-011, P13-013 and P21-009 exist
  only in the prerequisite markdown). The run takes dates from the knowledge base instead of from the
  source (row 28).

## Sources

| Row | URL |
|---|---|
| 1 | https://learn.microsoft.com/en-us/fabric/database/sql/migration-assistant ; https://learn.microsoft.com/en-us/fabric/fundamentals/whats-new |
| 4, 29 | https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/connection-types-overview |
| 5 | https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/log-replay-service-migrate |
| 6 | https://learn.microsoft.com/en-us/sql/sql-server/azure-arc/migrate-to-azure-sql-managed-instance ; https://learn.microsoft.com/en-us/sql/sql-server/azure-arc/migration-overview |
| 15 | https://azure.microsoft.com/updates?id=571795 ; https://learn.microsoft.com/en-us/sql/sql-server/azure-arc/migration-overview |
| 16 | https://learn.microsoft.com/en-us/fabric/database/sql/sqlpackage ; https://learn.microsoft.com/en-us/fabric/fundamentals/migration |
| 17, 35 | https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/managed-instance-link-feature-overview ; https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/managed-instance-link-extend-availability-group ; https://techcommunity.microsoft.com/t5/azure-sql-blog/mi-link-support-for-multiple-databases-in-an-always-on/ba-p/4560546 |
| 19 | https://learn.microsoft.com/en-us/sql/linux/sql-server-linux-use-log-shipping |
| 20 | https://learn.microsoft.com/en-us/sql/connect/jdbc/connecting-using-azure-active-directory-authentication |
| 28 | https://azure.microsoft.com/updates?id=569535 ; https://learn.microsoft.com/en-us/azure/azure-vmware/portable-vcf-licensing-reference |
| 31 | https://learn.microsoft.com/en-us/sql/tools/sqlpackage/sqlpackage-export (does not state the instance-object point) |
| 32 | https://learn.microsoft.com/en-us/sql/linux/replication/overview |
| 33 | https://learn.microsoft.com/en-us/sql/relational-databases/replication/security/secure-the-snapshot-folder |
| 34 | https://learn.microsoft.com/en-us/azure/data-factory/connector-sql-server |
| 39 | https://learn.microsoft.com/en-us/azure/migrate/tutorial-migrate-vmware |

## Out of scope

Blind behaviour evaluation: the protocol shows the model the expected answer before asking it
to score itself. Recorded so it is not lost. Microsoft has an open pull request proposing an
evaluation framework.
