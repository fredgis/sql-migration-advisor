# Open knowledge base findings

Source: the weekly knowledge-base checks of 14 September to 23 November 2026 (issue #75). The 40
findings open on 10 November were audited that day against the live Microsoft sources and the text now
in HEAD (last knowledge-base commit: 13 September); the 16 November check added one finding, row 41.
The file has three parts: **To do** (26 findings, including three guidance additions, plus one decision, 28b),
**Implementation audit** (added 16 November: the knowledge-base lines to change for each one, a revised
criticality and a size for the scope then known) and **Not doing** (22 others, with the reason). The 10 November audit is
recorded in the comment of 10 November on issue #75
(https://github.com/fredgis/sql-migration-advisor/issues/75#issuecomment-6774890874), and the corrections
made after a review of the plan are in the follow-up comment
(https://github.com/fredgis/sql-migration-advisor/issues/75#issuecomment-6775214583). Row numbers are
the ones used since the findings were first recorded, so there are gaps. Nothing applied yet.

**23 November review.** The [weekly report on #75](https://github.com/fredgis/sql-migration-advisor/issues/75#issuecomment-7106334090) proposed 9 Advisor, 4 prerequisite and 4 connectivity edits, not 17 distinct findings. Advisor proposals 1–9 map, in order, to 42/42, 43/43, 17/35, 44/44 and 19. Prerequisite proposals 1–4 belong to 17/35 (P08-006) and 17 (P08-007): the catalog holds path questions, not the individual prerequisite rows. Connectivity proposals 1–4 map to 20/20 and the reopened 30/30. Rows 46–48 come from [Azure Weekly 589](https://azureweekly.info/issue-589), not from the run's proposed edits.

The run reported 15 source-section hash changes (including standalone LRS source versions): review the actual passages before updating hashes, not 15 automatic rule changes. Four dead anchors map to 39 and 45. The separate link scan reported 558 successes out of 559 with no attributable failed URL; no additional dead link is established.

**v3.15.0 (23 November): this repository now carries the official Microsoft publication.** The line
numbers below were read at v3.14. Convert them before editing:

| File | v3.14 lines | v3.15 lines |
|---|---|---|
| `docs/sql-server-to-azure-migration.md` | 1-25 | unchanged |
| | 27-484 | minus 1 (the §1 partner bullet is gone) |
| | 485-567 | removed: the former §14 and §15, including the AVS licensing callout (old 530-548) |
| | 568-650 | minus 84: Sources is now §14 at line 484, and old 622 is now 538 |
| `reference/decision-rules.md` | 1-514 | unchanged |
| | 516 onward | minus 1 (D3 lost its programs line) |
| `skills/recommend-migration-path/SKILL.md` | 9-12 | plus 24 (startup section) |
| | 14-267 | plus 26 |
| | 269-661 | plus 28 |
| | 662 onward | plus 35 |
| `skills/generate-migration-prerequisite-plan/SKILL.md` | 9-213 | plus 3 |
| | 214 onward | plus 10 |

Two findings change in substance:
- **Row 28** loses its knowledge-base part: Microsoft removed the callout. The wrong dates remain in
  `decision-rules.md` 109-111 and 124, P27-003 and `path-catalog.json` 922-924. The AVS target row now
  says only "Confirm current portable VCF licensing requirements before recommending it."
- **Row 1**: the Sources entry for the assistant is now line 538.

## To do

Criticality, revised on 16 November once the lines were read (it now measures what a customer who
follows HEAD gets wrong; on 10 November it measured the distance between HEAD and the source):
**High** = a wrong decision or a wrong deadline, **Medium** = incomplete or over-conservative (the answer
stays safe, but an option, a caveat or a prerequisite is missing), **Low** = wording, label, citation or
watch-list. The old values are in the summary table of the implementation audit. "Where" lists only
knowledge-base lines: the three knowledge bases and the files the skills read.

| # | Where | What we say | What the source says now | Fix | Criticality |
|---|---|---|---|---|---|
| 42 | `migration.md` 133; `decision-rules.md` 230, 235–239, 577; the preview question in the recommendation skill | Next-gen GP zone redundancy requires preview acceptance | [GA announcement](https://azure.microsoft.com/updates?id=578033) | Remove that condition for zone redundancy only. Check the target region's support for zone-redundant Next-gen GP; if unknown, ask. Do not remove preview checks for unrelated capabilities. | High |
| 43 | `migration.md` 133; `decision-rules.md` §B2, 230–232 | Old log-rate ceiling; a qualitative high-throughput answer favours Business Critical | [MI sizing update](https://techcommunity.microsoft.com/blog/AzureSQLBlog/azure-sql-managed-instance-gets-a-boost-new-capabilities-in-next-gen-general-pur/4573761) | Compare measured log demand to the selected configuration: up to 6 MiB/s per vCore, capped at 220 MiB/s per instance, not 220 for every SKU. Check storage/vCore and latency, HA and read-scale needs before recommending BC. | Medium |
| 44 | `migration.md` 278, 435 and §13; `decision-rules.md` 95, 171, 217, 455; P11-001 when assessing three-part names | Cross-database references disqualify SQL Database outright | [Hyperscale limited preview](https://techcommunity.microsoft.com/blog/AzureSQLBlog/azure-sql-hyperscale-cross-database-querying-now-in-limited-preview/4573935) | Evaluate native three-part reads only with approved preview access, online databases in the **same Hyperscale elastic pool on the same logical server**, and suitable permissions. Writes limited to one database; no savepoints or nested transactions. Keep linked servers and DTC separate. Otherwise retain refactor/MI/VM alternatives. | Medium |
| 30 | `connectivity.md` §5.3, 517 onward; `connectivity-matrix.json` `trust_server_certificate.diagnostic_use` | Toggling trust is presented as a certificate diagnostic without a mode condition | [SqlClient certificate validation](https://learn.microsoft.com/en-us/sql/connect/ado-net/encryption-and-certificate-validation) | Reopened: with `Encrypt=Strict`, `TrustServerCertificate` is ignored, so toggling it provides no diagnostic signal. For other modes distinguish diagnosis from a production fix. Keep separate from row 41's hostname change. | Medium |
| 45 | `prerequisite.md` 185, 186, 206 (P08-013, P08-014, P09-014) | Three removed anchors; old wording also overstates the ADR restriction | [MI Link preparation](https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/managed-instance-link-preparation), [LRS preparation](https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/log-replay-service-migrate) | Cite `#prepare-databases-that-use-accelerated-database-recovery-adr` for ADR: **if ADR is used**, verify PVS on `PRIMARY`; do not assert ADR must be enabled for every migration or cannot be enabled later without evidence. For Service Broker cite `#prepare-databases-with-service-broker-disabled`: enable at source if needed, otherwise enabling it after migration requires Support. Row 39 is the fourth anchor, not a new finding. | Medium |
| 46 | `migration.md` §§4, 4.1; `decision-rules.md` §D2; P28 discovery guidance | Assessment guidance predates the Azure Migrate name change and joint application/database assessment | [Azure Catalyst](https://techcommunity.microsoft.com/blog/AzureSQLBlog/whats-new-in-databases-at-microsoft-ignite-2026-ai-ready-data-for-apps-and-agent/4570764), [Modernize CLI](https://techcommunity.microsoft.com/blog/MicrosoftDataMigration/modernize-applications-and-databases-together-with-the-modernize-cli/4574244) | Introduce **Azure Catalyst (formerly Azure Migrate)** without renaming historical references or identifiers. Offer Modernize CLI for joint application and SQL assessment: blockers, target, sizing and estimated cost. Neither the CLI assessment nor a roadmap for BACPAC/LRS is a new data movement method. | Medium |
| 47 | `prerequisite.md` P11-003/P11-006, 236, 239 | Import rehearsal gives little help isolating a slow BACPAC import | [Microsoft support guidance](https://techcommunity.microsoft.com/blog/AzureDBSupport/why-your-bacpac-import-is-slow-finding-the-real-bottleneck/4574107) | Extend the existing rehearsal, not the list of blocking prerequisites: inspect SqlPackage logs, client CPU/RAM/disk, network and target utilisation. Compare from a same-region VM before increasing target compute. | Low |
| 48 | `migration.md` 367; `decision-rules.md` 529 | Retirement is correct but the replacement list does not distinguish sync semantics | [SQL Data Sync replacement guide](https://techcommunity.microsoft.com/blog/AzureDBSupport/sql-data-sync-is-retiring-how-to-choose-the-right-replacement/4574101) | Keep 30 September 2027. Ask direction, writable destinations, conflict handling and tolerated lag before recommending a replacement. ADF copy, one-way replication and Fabric mirroring do not replace writable bidirectional sync as-is. | Low |
| 1 | `migration.md` 107, 135, 230, 234, 238, 377, 378, 474, 622; `decision-rules.md` 49, 94, 96, 165, 238-239, 378, 380; both `SKILL.md` (recommend 645, prerequisite 181); `prerequisite.md` 57, 327-328, 334; `migration-methods.json` 24; `claims-registry.json` 101; `path-catalog.json` 533 | The Fabric Migration Assistant is Preview, with "no Private Link", and a preview-acceptance gate applies to it | GA since August 2026. DACPAC up to 20 MB, on-premises data gateway only; the limitations page excludes VNet gateways, not Private Link by name | Remove the assistant's Preview label and gate. Keep its documented constraints separate from target eligibility. At rules 94 and 238-239 remove the assistant as a preview example; zone redundancy is no longer a preview example either (42). Do with 16. | High |
| 28 | `migration.md` 538-540, 544; `decision-rules.md` §A1 `AVS-LICENSING` 109-111, 124; `prerequisite.md` P27-003 (531); `path-catalog.json` 922-924 | Pay-as-you-go retires 15 Oct 2026, new sales end 31 Oct 2026, reserved instances end 30 Aug 2027; "a recommendation made today on a pay-as-you-go assumption fails in under two months" | Azure Updates 569535 and the Learn portable VCF licensing reference: from 1 Nov 2025 new deployments must use portable VCF; license-included pay-as-you-go must transition by **31 Oct 2026**; reserved instances end 30 Aug 2027, and a reservation expiring earlier ends its benefit at expiry. The 15 Oct date appears only as 15 Oct 2025 (vDefend cores). The run proposed HEAD's own dates | Dates and wording only: re-date the table from the sources, rewrite the "under two months" wording in the past tense, keep "AVS is not retiring". P27-003 (`prerequisite.md` 531) repeats both wrong dates in its applicability cell and changes with them. Leave the changelog rows (v2.10 in `migration.md` and `README.md`) as they are. The eligibility rule is a separate decision, row 28b | High |
| 16 | `migration.md` 343 (§8 cell) and a new §5.4 row; `decision-rules.md` 381-382; `prerequisite.md` 223-230 (the P11 heading and its note that P11 does not cover Fabric), 237 (P11-004), 582-583 (coverage counts), 616-617; `advisor-coverage.json` 3 and 325-332; `path-catalog.json` 356-363 (P11 target variants) | Fabric takes a DACPAC only, and the rules forbid offering a BACPAC import ("do not substitute a BACPAC import") | Fabric "SqlPackage for SQL database in Fabric": a .bacpac can be imported into an empty SQL database with `sqlpackage /action:import`. The Fabric migration overview lists "SqlPackage and Copy job" | Lift the prohibition, but do not turn a refused assistant into a BACPAC recommendation automatically: the import needs an empty target database, a source that fits the Fabric T-SQL surface (the page says it may need altering) and a volume to qualify. Keep DACPAC as the assistant's schema path. Give BACPAC to Fabric a prerequisite path (P11 has no Fabric variant today) and separate the SqlPackage constraints from the assistant's (P16). P11-004 (Blob access) must apply only when the BACPAC is staged in Blob, so that a local SqlPackage import does not leave a required prerequisite unresolved. Do with row 1 | Medium |
| 19 | `decision-rules.md` 304, 323; `migration-methods.json` 20; `migration.md` 192 | Log shipping needs a Windows source ("Windows-only"). `migration.md` 192 already says Windows and Linux, so HEAD contradicts itself | Learn "Get started with log shipping on Linux": SQL Server Agent on both servers plus a CIFS/Samba share, Linux to Linux. Windows to Linux is not documented | Replace the Windows-only gate with an OS-pair condition instead of removing it: Windows to Windows as today; Linux to Linux documented (and P03-006 already assumes it); Windows to Linux and Linux to Windows neither documented nor excluded, so ask or leave to confirm; destination OS unknown, ask and do not promote log shipping. No contract collects the target OS (P03 asks `source_os` only), so either add a target-OS fact (contract, both schemas, `advisor-fact-mappings.json`, question) or keep the cross-OS case as "to confirm". The line audit recommends the second: 4 lines changed and 2 added in 3 files, against about 39 new lines in 9 more files for a new fact. `migration.md` 192 and P03-006 (`prerequisite.md` 121) say "source or target" without the pairing: reword 192 to "Windows to Windows and Linux to Linux; a mixed pair is not documented" and leave P03-006, which only asks for the Samba share when either end is Linux. Keep the version and log-chain checks | Medium |
| 17 | `migration.md` 200, 369; `decision-rules.md` 186, 360, 557; `prerequisite.md` 173–181, especially P08-006/007/009; recommendation and prerequisite contracts, questions and fact mapping | One link per database; the 16 November plan used preview floors | [GA announcement](https://aka.ms/milink-multidb-ga-blogpost) and [Learn support table](https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/managed-instance-link-extend-availability-group): SQL Server **2022 CU28+ or 2025 CU11+**, Enterprise/Developer, Windows or Linux, **SSMS 22.12.1+** for the wizard. An existing AG is optional. Only automatic multi-node wizard configuration remains preview. | Offer multi-database mode without preview consent. For SQL Server → MI the update policy must match the source version or be newer; creating the link from MI or reversing roles needs the matching version policy (including SQL Server 2022). Rehearse cutover and application switch for every link; require online failback evidence only when supported, otherwise a separate rollback plan. Carry the selected mode into P08; preserve single-database criteria. Pair with row 35: count databases against remaining target capacity, not links. | High |
| 28b | `decision-rules.md` 115-119 (the `AVS-LICENSING` answer table); `migration.md` 530-548 (§15.1); recommend `input.schema.json`, `SKILL.md`, `input-contract.md` and `advisor-fact-mappings.json` if a licence-type fact is added | Relying on license-included, or an unknown licence, holds AVS at `unknown_requires_assessment`; a confirmed portable VCF licence makes it eligible | Same sources as row 28: new deployments have required portable VCF since 1 Nov 2025, pay-as-you-go had to transition by 31 Oct 2026, reserved instances end 30 Aug 2027 | **Decision needed.** Keep today's rule (dates fixed by row 28), or adopt the finer one: a valid existing license-included reservation is `eligible_with_remediation` until its term and 30 Aug 2027 at most; an unknown entitlement stays `unknown_requires_assessment`; a new deployment relying on license-included capacity is unsupported, for a commercial reason. The finer rule changes eligibility, so it needs a licence-type fact (portable VCF, existing reservation with its expiry, unknown) carried the same way by both skills. The prerequisite plan already has the fact (`avs_vcf_subscription_status`: schema 509, `questions.json` 74, catalog 937) and P27-003 already states the reservation boundary; the recommendation side has no licence field, so the two skills must be given the same qualification and the same unknowns | Medium |
| 15 | `migration.md` 15, 138, 150 and new rows in §4.1 (after 167) and §5.3; `decision-rules.md` 309, 349-355 and a new §B3 row; recommend `SKILL.md` 640 | Arc migrates to SQL MI and SQL Server on Azure VM ("MI and VM targets both GA") | Azure Updates 571795 (29 Sep) and Learn: Arc also migrates to Azure SQL Database, Hyperscale included, in public preview, through DMS and a self-hosted integration runtime | Add the target, gated on preview acceptance. The preview concerns the Arc orchestration to Azure SQL Database, not Azure SQL Database itself: a refusal removes only that orchestration and keeps the GA routes to SQL Database. The hand-off has to keep `controlPlane=azure-arc`, but the prerequisite KB carries no row for the Arc orchestration (extension, identity, batch) on any path, and `decision-rules.md` 355 already refuses to hand off Arc with LRS for that reason. Decide between that precedent (document the route, recommend standalone DMS, name Arc as an optional orchestration: text only) and giving the prerequisite KB the Arc rows so that `controlPlane=azure-arc` can be carried (about 20 new lines there, plus `migration-methods.json` 15, where DMS gets `controlPlanes`) | Medium |
| 41 | `connectivity.md` §5.3 (488-496: the driver-change table and "Driver upgrades changed the defaults, twice"); `connectivity-matrix.json` `tls.breaking_defaults` (890-923; the `tls-sqlclient-*` names exist only as `affected_rules` of the claim); `claims-registry.json` 336-345 (`conn-sqlclient-encryption-defaults`) and its line in `connectivity.md` 721; optional pointers from `migration.md` 470 and `decision-rules.md` 449 | The §5.3 table stops at SqlClient 5.0 and ODBC 18 and says driver upgrades changed the defaults "twice". `HostNameInCertificate` appears only as the client-side answer when the connection name differs from the certificate (`connectivity.md` 408 and 515). The matrix carries no servicing-release diagnostic | SQL Server Blog of 13 Nov 2026, "Microsoft.Data.SqlClient 7.1.2, 7.0.4, and 6.1.8 are now available": the servicing releases tighten certificate validation. A `HostNameInCertificate` value now replaces the server name for validation, so a value that is not in the certificate fails the connection **even when the server name matches** (before, a wrong value was ignored in that case). The error is a certificate name mismatch during the TLS handshake, before login. With a deliberately wrong value, 7.1.2 and 7.0.4 fail on .NET 10 (native and managed networking) and on .NET Framework 4.8.1; 6.1.8 fails only with managed networking (the default on Linux and macOS, opt-in on Windows); 7.1.1 opens everywhere. The Learn page (last updated 29 Sep) has not caught up and ends at 7.0.3. The run's wording "when the connection hostname differs" is inexact: the new check applies when the name matches too | Add the three releases to §5.3 and to the matrix as a certificate-validation change, with this diagnostic first for a new TLS failure after an upgrade: search the connection strings for `HostNameInCertificate`, confirm each value appears in the certificate's subject or subject alternative names, fix or remove it. State the 6.1.8 scope (managed networking only) and correct "twice". Say the source is the blog until Learn is updated. Register the behaviour under claim `conn-sqlclient-encryption-defaults` and update its line in the claims table. Optionally point the retained-server-name pattern at it: a client that sets `HostNameInCertificate` for the old name now fails on these releases even when the connection name matches. Edit the matrix first, then the prose. Then re-baseline the claim (row 21) | Medium |
| 31 | `prerequisite.md` §14 P11-010 (243) | Instance-scoped objects are scripted separately only for SQL MI, SQL VM and Arc-enabled SQL MI | A BACPAC carries only user-database schema and data. P11 also covers SQL containers, and an AVS-hosted SQL Server is a full instance like a SQL VM. The cited sqlpackage page does not state the instance-object point | Extend the applicability to AVS-hosted and containerised SQL Server. Markdown only: `path-catalog.json` has no row-level data | Medium |
| 32 | `prerequisite.md` §16 P13-011 (290) | The requirement says "in any role", the applicability says subscriber only | Learn: SQL Server 2017 CU18 and later support replication for instances of SQL Server on Linux, with no role distinction | Apply whenever any publisher, distributor or subscriber is Linux-hosted or containerised. Markdown only | Medium |
| 33 | `prerequisite.md` §16 P13-013 (292) | The UNC snapshot folder applies only when the subscriber is a containerised SQL Server | Learn "Secure the snapshot folder": a remote distributor or pull subscriptions require a UNC share rather than a local path | Drop the container condition and apply to any pull subscription or remote distributor. Markdown only | Medium |
| 29 | `connectivity.md` 102 (the Managed Instance endpoint table; line 83 is the Azure SQL Database policy and stays); `connectivity-matrix.json` 87 (`connection_type`) | The endpoint table and the matrix row say "redirect (default since October 2025) or proxy" without the alias detail. The rule itself is already there: §7.3 (626-634) and the matrix entry `mi-proxyoverride-default` (775-787) state that the effective value decides, and `get-connection-details/SKILL.md` 197 that the meaning depends on when the value was set | Learn "Connection types" (re-read 16 Nov): `proxyOverride=Default` is deprecated and now works as an alias of Redirect; since Oct 2025 a programmatic deployment or update with `Default` is interpreted as Redirect and the value is never preserved; instances set to Default before Oct 2025 "are converted to Proxy" | Add "alias, deprecated, never stored" to the cell in line 102 and to the matrix field in line 87, and point both at §7.3. Do with row 4 | Low |
| 4 | Managed Instance lines only: `connectivity.md` 102, 120-142 (the redirect-ports block), 584-613 (§7.1), 715; `connectivity-matrix.json` 87-93, 757-773 (`get-connection-details/SKILL.md` 189 and 235 stay true). Not lines 74, 79, 452, 459, 678 and 717: they describe Azure SQL Database, where 11000-11999 is right | HEAD already records the redirect ports as disputed: test 1433 first, open 11000-11999 only if that fails and policy allows it | Learn "Connection types" (re-read 16 Nov): redirect needs port 1433 across the instance's subnet range plus DNS resolution of the instance zone; 11000-11999 appears nowhere on that page or on the two connectivity-architecture pages. The Bicep and ARM quickstarts (re-read 16 Nov) still create an inbound NSG rule for 11000-11999 from the virtual network, so the conflict is current and not a leftover of old templates | HEAD's guidance fits both readings, so the conflict stays open and is not resolved in favour of 1433 alone. Add the missing DNS requirement to §2.2 and to the matrix row 87-93, and date the evidence. Do with row 29. Do not touch the MI Link range 11000-11999 | Low |
| 34 | `prerequisite.md` §24 P21-009 (413) | The private-sink self-hosted integration runtime names SQL VM, Arc-enabled SQL MI and containers, not AVS | The Data Factory SQL Server connector requires a self-hosted integration runtime for stores inside an on-premises network or a virtual network. AVS is not named, so this is an inference | Add an AVS-hosted SQL Server with no public endpoint. Markdown only | Low |
| 35 | `migration.md` 200; `decision-rules.md` 230, 360; recommend `SKILL.md` 641, `input.schema.json` 267 and `output.schema.json` 329 | Link capacity derived straight from `database_count` (100 or 500 "links") | Learn MI link overview: in multiple-database mode every replicated database still counts toward the instance-wide limit (100 for General Purpose and Business Critical, 500 for next-gen); only the number of links changes | Reword "links" to "databases" in the capacity text, keep `database_count` at or below the limit in both modes and check the capacity left on the target (existing databases count against it). Do not relax the check. Do with row 17 | Low |
| 5 | `migration.md` 319; `decision-rules.md` 428; recommend `SKILL.md` 299 and 639 | LRS cutover is minutes on General Purpose, hours on Business Critical | Learn LRS: a job is cancelled after 30 days; Business Critical seeding takes "up to several hours"; no figure for General Purpose. "Minutes" is our own estimate, stored in `decision-rules.data.json` (`businessCutoverDowntimeByTier.default`) | Label "minutes" as our own estimate instead of dropping it. The 30-day ceiling is already in HEAD (`migration.md` 201, `decision-rules.md` 340 and 559) and needs nothing | Low |
| 6 | `reference/claims-registry.json` 223-233, claim `arc-sql-migration-minimum-source-versions` (225 and 226 by hand; 227 and 228 by the script) | The claim watches the "Prerequisites" section of the Arc migration overview | That section no longer exists on the overview. The floors now sit on the Arc to Managed Instance page (MI Link: SQL Server 2016 on Windows Server 2016; LRS: SQL Server 2012 on Windows Server 2012) and the overview gives 2014 for the whole experience. HEAD already splits these floors (`decision-rules.md` 349-353, `migration.md` 371) | Re-point `source_url` and `source_section` to the Arc to MI page, check the section exists, then re-baseline. No knowledge-base text to change. Without it the weekly check hashes the whole page | Low |
| 20 | `connectivity.md` 333, 355, 723; `connectivity-matrix.json` 420 (`min_version`) and 429 (`extra_property`); `claims-registry.json` 376 (the claim's note; `jdbc-auth-keywords` and `jdbc-msi-client-id` are its `affected_rules` names, not matrix keys) | `ActiveDirectoryMSI` needs JDBC 8.3.1; a minimum-version dispute is recorded | The JDBC page contradicts itself: the keyword list says "since 8.3.1", the dedicated section says "supported starting with version 7.2", the dependency table starts at 7.2. `ActiveDirectoryManagedIdentity` needs 12.2, and its keyword entry says the Client ID of a user-assigned managed identity "can also now be set in the `user` property" (re-read on 16 Nov; the run proposed this row on 26 Oct and again on 16 Nov) | Record 7.2 (dedicated section and table) and keep 8.3.1 only as the `msiClientId` boundary. For `ActiveDirectoryManagedIdentity` (12.2 and later) add the `user` property as a way to pass a user-assigned Client ID, next to `msiClientId` for the legacy `ActiveDirectoryMSI`. Keep a note that the page is inconsistent rather than deleting the dispute | Low |
| 39 | `prerequisite.md` 155 (P06-005; the only occurrence of the anchor) | The source link is `tutorial-migrate-vmware#run-a-test-migration` | The anchor is gone. The test-migration steps now sit under `#track-and-migrate-replicating-servers` | Re-point the link and update the checked date | Low |

**16 November sizing only, not a total for the expanded 23 November scope:** about 118 existing lines in 21 files and about 109 new lines (about 150 if row 28b is
adopted), all in the knowledge bases and the files the skills read. The sizes by finding are in the
implementation audit below; the new-line figures are estimates. The drifted claims are re-baselined by the
script after the source and section are checked. Current High priorities: 1, 17, 28 and 42. Row 20 is contested inside the Microsoft page itself, rows 31 to 34
and 41 are incomplete as written, and rows 4 and 29 are smaller than they looked, because HEAD already
carries most of the fix. Do rows 1 and 16 together (they rewrite the same rule lines), rows 4, 20, 29
and 41 in one connectivity version (the same lines and the same stamp), and rows 17 and 35 together.

## Implementation audit

Written on 16 November 2026. Every retained row was re-read against HEAD (`df706e2`) and the live
sources, and every line number below was read in that commit. It lists only knowledge-base lines: the
three knowledge bases (`docs/sql-server-to-azure-migration.md` with `reference/decision-rules.md`, the
prerequisite document with its catalog, the connectivity document with its matrix) and the files the
skills read (`SKILL.md`, contracts, schemas, `questions.json`, fact mappings), plus the claims watch list.
Tests, the executable mirror and the presentation files (README, poster, rule graph, example) follow the
text and are not counted. "Existing lines" counts the lines of HEAD that change (a block counts in full
when it is rewritten). "New lines" is an estimate, plus or minus a quarter. Nothing was run.

### Summary (16 November scope and estimates)

| # | Finding | Criticality (10 Nov to 16 Nov) | Why it moved | Existing lines | New lines | Files |
|---|---|---|---|---|---|---|
| 1 | Fabric Migration Assistant is GA | High to **High** | A customer who accepts GA only is told the GA assistant is out | 26 | 0 | 8 |
| 28 | AVS dates | High to **High** | Two of the three dates are not in the sources, and "no new sales on 31 Oct" contradicts the 1 Nov 2025 rule | 12 | about 1 | 4 |
| 16 | BACPAC import into Fabric | High to **Medium** | A missed option: the other fallbacks after a refusal still stand | 21 | about 7 | 5 |
| 19 | Log shipping, Linux to Linux (minimal option) | High to **Medium** | The rules say Windows-only while `migration.md` 192 says Windows and Linux; the loss is a missed option, not a wrong answer | 4 | about 2 | 3 |
| 17 | MI Link multiple-database mode | **High** as of 23 Nov | GA changes eligibility and the source build, policy and failback requirements in P08 | 3 | about 62 (prior estimate) | 11 |
| 28b | AVS eligibility rule, only if adopted | Medium to **Medium** | A decision; nothing to do if today's rule is kept | 3 | about 41 | 6 |
| 15 | Arc to Azure SQL Database (preview) | Medium to **Medium** | A missing preview route, and no way to hand it off today | 6 | about 10 | 3 |
| 41 | SqlClient `HostNameInCertificate` | Medium to **Medium** | A new post-upgrade TLS failure with no diagnostic | 5 | about 20 | 3 |
| 31 | P11-010, instance objects | Medium to **Medium** | A required prerequisite is absent for AVS and container targets | 1 | 0 | 1 |
| 32 | P13-011, replication on Linux | Medium to **Medium** | Same, for a Linux publisher or distributor | 1 | 0 | 1 |
| 33 | P13-013, UNC snapshot folder | Medium to **Medium** | Same, for any pull subscription or remote distributor | 1 | 0 | 1 |
| 29 | MI `Default` alias | High to **Low** | HEAD already states the rule in §7.3, the matrix and `SKILL.md`; only the short form in line 102 lacks the alias | 2 | about 2 | 2 |
| 4 | MI redirect ports | High to **Low** | HEAD already says "test 1433 first", and the quickstarts still create the 11000-11999 rule, so the conflict stays open; only DNS is missing | 4 | about 2 | 2 |
| 34 | P21-009, AVS | Low to **Low** | An inference | 1 | 0 | 1 |
| 35 | Capacity counts databases | Low to **Low** | Wording | 6 | 0 | 5 |
| 5 | LRS "minutes" | Low to **Low** | The 30-day ceiling is already in HEAD, so only the label is left | 4 | 0 | 3 |
| 6 | Claim re-point | Low to **Low** | Restores a blind spot of the weekly check | 2 | 0 | 1 |
| 20 | JDBC minimum version | Low to **Low** | Contested inside the Microsoft page | 6 | about 2 | 3 |
| 39 | Dead anchor | Low to **Low** | One link | 1 | 0 | 1 |
| | Connectivity version stamp (rows 4, 20, 29, 41) | | One version line moves | 5 | about 1 | 3 |
| | Prerequisite version stamp (rows 1, 16, 17, 28, 31 to 34, 39) | | One version line moves | 7 | 0 | 6 |
| | **Total** | | | **118** | **about 109** | **21** |
| | **Total with 28b adopted** | | | **121** | **about 150** | **21** |

By knowledge base:

| Knowledge base | Files | Existing lines | New lines |
|---|---|---|---|
| Advisor: `migration.md`, `decision-rules.md`, `migration-methods.json`, the advisor `input-contract.md`, recommend `SKILL.md` and schemas | 7 | 52 | about 51 |
| Prerequisite: `prerequisite.md`, `path-catalog.json`, `advisor-coverage.json`, `questions.json`, `advisor-fact-mappings.json`, its `SKILL.md`, contracts and schemas | 10 | 41 | about 31 |
| Connectivity: `connectivity.md`, `connectivity-matrix.json`, `get-connection-details/SKILL.md` | 3 | 19 | about 26 |
| Claims watch list: `claims-registry.json` | 1 | 6 | about 1 |
| **Total** | **21** | **118** | **about 109** |

The advisor knowledge-base release (now v3.15 to v3.16, about 20 stamped files) is not counted: see Release.

### What the line audit changed in the rows above

- **Rows 4 and 29 are small.** HEAD already carries most of the fix: §7.3 (626-634) and the matrix entry
  `mi-proxyoverride-default` (775-787) state that the effective value decides,
  `get-connection-details/SKILL.md` 197 says the meaning depends on when the value was set, and §2.2
  already says to test 1433 first. The first "Where" cell of row 4 mixed in Azure
  SQL Database lines (74, 79, 452, 459, 678, 717), where 11000-11999 is correct and must not change. The
  Bicep and ARM quickstarts still create the 11000-11999 rule (re-read 16 November), so the first fix's
  "older quickstarts" was wrong: the conflict is current and stays open.
- **Row 5 loses half its fix.** The 30-day ceiling is already in HEAD (`migration.md` 201,
  `decision-rules.md` 340 and 559). Only the "minutes" label is left.
- **Row 1 reaches more rule lines.** `decision-rules.md` 94 and 238-239 cite the Fabric Migration Assistant
  as the example of a preview option; they change with it.
- **Row 15 has a gap on the prerequisite side.** The prerequisite KB carries no row for the Arc
  orchestration (extension, identity, batch) on any path, and `decision-rules.md` 355 already refuses to
  hand off Arc with LRS for that reason. Arc to SQL Database inherits the limit (see its row).
- **Row 19 reaches `migration.md` 192.** "Works on Windows and on Linux" does not say which pairs;
  P03-006 can stay.
- **Row 28: P27-003 repeats the dates** (`prerequisite.md` 531), and the three catalog fields have no
  reader.
- **Row 35 is wording in six lines**, including `decision-rules.md` 230 ("MI Links") and recommend
  `SKILL.md` 641. Lines 50, 172 and 213 say "MI Link capacity" without a unit and stay.
- **Rows 20 and 41: matrix keys.** `jdbc-auth-keywords`, `jdbc-msi-client-id` and `tls-sqlclient-*` are claim
  `affected_rules` names, not matrix keys. The matrix lines are 420 and 429 (JDBC) and the
  `tls.breaking_defaults` block, 890-923.
- **16 November criticality.** Six High rows became two (1 and 28) before the 23 November announcements. Rows 4 and 29 fell to Low because HEAD already holds
  most of the fix, and rows 16 and 19 fall to Medium because the effect is a missed option, not a wrong
  decision.

### Detail by finding

#### Fabric: rows 1 and 16, one lot (47 existing lines, about 7 new, 10 files)

| File | Lines at HEAD | Change | Row | Existing |
|---|---|---|---|---|
| `docs/sql-server-to-azure-migration.md` | 107, 135, 230, 234, 238, 377, 378, 474, 622 | Drop "Preview" for the assistant (diagram label, §3 row 5 and its link label, the §5.4 title and its assistant row, the 238 caveat, the two gate lists, the source entry); "no Private Link" becomes "no VNet data gateway" | 1 | 9 |
| | 343 (+ a new §5.4 row) | The §8 cell `✅ (DACPAC)`; a new row for the SqlPackage BACPAC import into an empty database | 16 | 1 (+1 new) |
| `reference/decision-rules.md` | 49, 94, 96, 165, 238-239, 378, 380 | Remove preview consent for the assistant; coordinate lines 238–239 with row 42. Keep consent for unrelated previews such as cross-instance Service Broker. | 1 | 8 |
| | 381, 382 (+ 2 lines) | Replace "do not substitute a BACPAC import" with its conditions: empty target, Fabric T-SQL surface, volume | 16 | 2 (+2 new) |
| `docs/sql-server-to-azure-migration-prerequisite.md` | 57, 327-328, 334 | P16 label and text; P16-003 loses "Private Link" | 1 | 4 |
| | 223, 225-230, 237, 582-583, 616-617 (+ 2 new P11 rows) | The P11 heading and the note saying P11 does not cover Fabric; P11-004 (Blob access) only when the BACPAC is staged in Blob; coverage counts 51 and 7 become 52 and 6; new P11 rows for Fabric (Microsoft Entra ID only, empty target) | 16 | 12 (+2 new) |
| recommend `SKILL.md`; prerequisite `SKILL.md` | 645; 181 | Same wording | 1 | 2 |
| `reference/migration-methods.json` | 24 | "Preview." | 1 | 1 |
| `reference/claims-registry.json` (watch list) | 101 | Claim text only; keep the claim id `fabric-sql-db-migration-preview-limits`; the script re-baselines the hash | 1 | 1 |
| `skills/generate-migration-prerequisite-plan/reference/path-catalog.json` | 533 | `supportStatus` is no longer `preview_tool_ga_target` | 1 | 1 |
| | 356 (+ 1 line in 357-363) | Add "SQL database in Fabric" to the P11 `target` and `targetVariants`, so that the new P11 rows have a path that serves Fabric | 16 | 1 (+1 new) |
| `.../reference/advisor-coverage.json` | 3, 328-331 (+ 1 line) | The Fabric by BACPAC cell moves from `out-of-scope` to `path` P11; the description's "51" and "7" become "52" and "6" | 16 | 5 (+1 new) |

`fabric_gateway_type` keeps its option `VNET_OR_PRIVATE_LINK` (`questions.json` 57): it is an input value
shared with the schema and stays. Decide the §8 cell first: a plain ✅, or a qualified cell that states the
empty-database condition.

#### Row 19, minimal option (4 existing lines, about 2 new, 3 files)

| File | Lines at HEAD | Change | Existing |
|---|---|---|---|
| `reference/decision-rules.md` | 304, 323 | "Windows source" and "Windows-only" become an OS-pair condition: Windows to Windows, Linux to Linux; a mixed pair or an unknown target OS stays "to confirm" | 2 (+2 new) |
| `reference/migration-methods.json` | 20 | "Windows-only." | 1 |
| `docs/sql-server-to-azure-migration.md` | 192 | "Works on Windows and on Linux" becomes "Windows to Windows and Linux to Linux; a mixed pair is not documented" | 1 |

P03-006 (`prerequisite.md` 121) asks for the Samba share when either end is Linux and stays. The full option
adds a target-OS fact: both input contracts (about 4 lines), both input schemas (about 16), the fact mapping
(about 8), `questions.json` (about 2), the P03 question fields in `path-catalog.json` (1), both `SKILL.md`
(about 8): about 39 new lines in 9 more files. Take the minimal option.

#### Row 28, AVS dates (12 existing lines, about 1 new, 4 files)

| File | Lines at HEAD | Change | Existing |
|---|---|---|---|
| `docs/sql-server-to-azure-migration.md` | 538-540, 544 | The three table rows (1 Nov 2025 new deployments need portable VCF; 31 Oct 2026 pay-as-you-go must transition; 30 Aug 2027 reserved instances end) and the "under two months" sentence | 4 |
| `reference/decision-rules.md` | 109-111, 124 | Same table, and "expires before the project starts" | 4 |
| `docs/sql-server-to-azure-migration-prerequisite.md` | 531 | P27-003 applicability cell | 1 |
| `skills/generate-migration-prerequisite-plan/reference/path-catalog.json` | 922-924 | The three date fields; nothing reads them, so the field names can follow the new meaning | 3 |

Do not touch: `README.md` 561 and `migration.md` 688 (changelog rows v2.10), `path-catalog.json` 921 and 925
(still right: the earlier of the reservation's expiry and 30 August 2027; ten months).

#### Connectivity: rows 29, 4, 20 and 41, one version (22 existing lines, about 27 new, 4 files)

| File | Lines at HEAD | Change | Row | Existing |
|---|---|---|---|---|
| `docs/sql-server-to-azure-migration-connectivity.md` | 102 | "alias, deprecated, never stored" in the Managed Instance endpoint table | 29 | 1 |
| | after 634 | One sentence in §7.3 | 29 | (+2 new) |
| | 125, 592 | Record the 16 November re-read of the connection-types page | 4 | 2 |
| | after 145 | The DNS requirement for redirect | 4 | (+2 new) |
| | 333, 723 | JDBC table cell, the claims-table line | 20 | 2 |
| | 355 | The client-ID sentence gains the `user` property | 20 | 1 (+1 new) |
| | 488-489, 721 | "changed the defaults, twice", the claims-table line | 41 | 3 |
| | after 496 | Three table rows and the `HostNameInCertificate` diagnostic | 41 | (+9 new) |
| `skills/get-connection-details/reference/connectivity-matrix.json` | 87 | `connection_type` | 29 | 1 |
| | 89, 760 | `client_requirement` gets DNS; the evidence date | 4 | 2 |
| | 420, 429 | `min_version`; `extra_property` next to the `user` property | 20 | 2 (+1 new) |
| | after 922 | New entry in `tls.breaking_defaults` (890-923) | 41 | (+10 new) |
| `reference/claims-registry.json` (watch list) | 376 | Claim note (dispute) | 20 | 1 |
| | 344, 347 | A new `affected_rules` name for the `HostNameInCertificate` check; the claim note (servicing releases) | 41 | 2 (+1 new) |
| Version stamp | `connectivity.md` 3; the matrix 3; `get-connection-details/SKILL.md` 17, 121, 151 | v0.10 becomes v0.11, plus a changelog row after `connectivity.md` 745 | all | 5 (+1 new) |

Optional pointers for row 41, not counted: `connectivity.md` 408 and 515, `migration.md` 470,
`decision-rules.md` 449, and one gotcha line in `get-connection-details/SKILL.md` 189-198. Edit the matrix
first (it is canonical), then the prose, then the stamp.

#### MI Link: rows 17 and 35

Row 35, wording only (6 existing lines, 5 files):

| File | Lines at HEAD | Change |
|---|---|---|
| `docs/sql-server-to-azure-migration.md` | 200 | "up to 100 links" becomes "up to 100 databases" (and the 500) |
| `reference/decision-rules.md` | 230, 360 | "MI Links" and "links" become "databases" |
| recommend `SKILL.md` | 641 | "Links: **100** on GP/BC, **500** on Next-gen GP, one link/database" |
| recommend `schemas/input.schema.json`, `schemas/output.schema.json` | 267, 329 | Same, in two descriptions |

Lines 50, 172 and 213 say "MI Link capacity" without a unit and stay.

Row 17, multiple-database mode (3 existing lines, about 62 new, 11 files):

| File | Lines at HEAD | Change | Existing |
|---|---|---|---|
| `docs/sql-server-to-azure-migration.md` | new rows after 200 and after 369 | The new mode as its own row, and its source requirements next to the single-database ones (369 stays: it describes the single-database mode) | (+5) |
| `reference/decision-rules.md` | 186 (+ after 360 and 557) | Keep single-database criteria separate. Apply row 17's GA support table to multi-database mode, not a preview gate. | Prior estimate only |
| `docs/sql-server-to-azure-migration-prerequisite.md` | 178–181 (+ P08 inputs) | Ask mode and remaining capacity; validate build, edition, SSMS and directional update-policy requirements. Align P08-007 rehearsal evidence with P08-009 and row 17. | Re-scope with P08-007 |
| `reference/input-contract.md`; the prerequisite skill's `input-contract.md` | after 213; 199-226 | A new field and its vocabulary section | (+13) |
| both skills' `schemas/input.schema.json`; `advisor-fact-mappings.json`; `questions.json`; `path-catalog.json` P08 | new properties | The field in both schemas, its mapping, its question and the P08 question fields | (+27) |
| recommend `SKILL.md` | 148 (+ a new question and a gates row after 641) | Edition row ("Enterprise, Standard or Developer" holds for the single-database mode only); the new question | 1 (+5) |

#### Row 28b, only if adopted (3 existing lines, about 41 new, 6 files)

| File | Lines at HEAD | Change | Existing |
|---|---|---|---|
| `reference/decision-rules.md` | 117-119 (+ new rows) | The three answer rows by licence type | 3 (+4) |
| `docs/sql-server-to-azure-migration.md` | 530-548 | §15.1 text for the finer rule | (+4) |
| recommend `schemas/input.schema.json`, recommend `SKILL.md`, `reference/input-contract.md` | new | A licence-type field (portable VCF, existing reservation with its expiry, unknown) | (+25) |
| `advisor-fact-mappings.json` | new | Map it to `avs_vcf_subscription_status` | (+8) |

If today's rule is kept, there is nothing to do here.

#### Row 15, Arc to Azure SQL Database (6 existing lines, about 10 new, 3 files)

| File | Lines at HEAD | Change | Existing |
|---|---|---|---|
| `docs/sql-server-to-azure-migration.md` | 15, 138, 150 (+ new rows in §4.1 after 167 and in §5.3) | "MI and VM targets both GA" and the Arc row of §3 gain the preview SQL Database route | 3 (+3) |
| `reference/decision-rules.md` | 309, 355 (+ 349-353 and a new §B3 row) | The Arc-orchestrated route, its floor and its preview gate; the hand-off limit of line 355 extended to this route | 2 (+6) |
| recommend `SKILL.md` | 640 | Gates table | 1 (+1) |

That is the option that documents the route and does not hand it off (the precedent of `decision-rules.md`
355). To carry `controlPlane=azure-arc` to the prerequisite plan instead, add the Arc orchestration rows to
the prerequisite KB (about 20 new lines across `prerequisite.md`, `path-catalog.json`, `questions.json` and
the contracts) and `controlPlanes` for DMS in `migration-methods.json` 15 (1 line).

#### Prerequisite rows 31 to 34 and 39, rows 5 and 6 (11 existing lines)

| Row | File | Lines at HEAD | Change | Existing |
|---|---|---|---|---|
| 31 | `docs/sql-server-to-azure-migration-prerequisite.md` | 243 | Applicability: add AVS-hosted and containerised SQL Server | 1 |
| 32 | same | 290 | Any publisher, distributor or subscriber that is Linux-hosted or containerised | 1 |
| 33 | same | 292 | Drop the container condition | 1 |
| 34 | same | 413 | Add an AVS-hosted SQL Server with no public endpoint | 1 |
| 39 | same | 155 | The anchor and the checked date | 1 |
| 5 | `migration.md`, `decision-rules.md`, recommend `SKILL.md` | 319; 428; 299 and 639 | "minutes" is labelled as our estimate; `decision-rules.data.json` 102 keeps the value | 4 |
| 6 | `reference/claims-registry.json` | 225-226 (227-228 by the script) | `source_url` and `source_section` | 2 |

### Order of work (16 November baseline)

For the consolidated scope, prioritise 1/16, 17/35, 28 and 42/43; then 44, 15, 19, 31–33, 30/41 and 45. Include 46–48 in the relevant assessment, BACPAC and sync guidance. Bundle remaining low-priority edits by KB. Keep 28b out of implementation until decided.

1. Text only: rows 31 to 34, 39, 5 and 6 (11 lines; the script re-baselines row 6).
2. Connectivity in one version: rows 4, 29, 20 and 41, the matrix first (22 lines with the stamp).
3. Row 28 (12 lines).
4. Fabric, rows 1 and 16 (47 lines): the rule text first, then the prerequisite KB (P11 and P16), then the
   catalog and the coverage map.
5. Row 19, minimal option (4 lines).
6. Rows 17 and 35 together (9 existing lines, about 62 new), then row 15 (6 existing, about 10 new; decide
   first how the hand-off is handled).
7. Row 28b only after the decision.
8. One release for everything (see Release). The prerequisite document moves to v1.12 with rows 1, 16, 17,
   28, 31 to 34 and 39.

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

- **11000-11999 serves three unrelated things.** Azure SQL Database redirect (`connectivity.md` 74, 79,
  452, 459, 678, 717): correct, leave it. Managed Instance redirect (row 4): disputed, and the Bicep and
  ARM quickstarts still create the rule, so the dispute stays open. The MI Link distributed availability
  group endpoint, paired with 5022 in `migration.md` and `decision-rules.md`, is documented on a page
  nobody has re-read. Leave it alone.
- **Changelog rows record what was true at the time.** Do not rewrite them, in any knowledge
  base.
- **`SKILL.md` repeats rows 1, 5, 15, 17 and 35** in its factual-gates table (recommend `SKILL.md` 639, 640,
  641 and 645). Fix both copies, or remove that table first, which also cuts the skill's token count.
- **Row 28: check a date against its source, not against this knowledge base.** The run proposed
  the dates already in HEAD. The sources say 31 Oct 2026 for pay-as-you-go and 1 Nov 2025 for new
  deployments. The 16 Nov run now proposes row 28b's finer eligibility rule, still with HEAD's dates.
- **Rows 1 and 16 rewrite the same rule lines** (`decision-rules.md` 96, 165, 380-382). Decide what a
  refused assistant falls back to (Azure SQL Database today) before touching them. Row 16 also starts with
  the §8 cell: `migration.md` 343 reads `✅ (DACPAC)`; decide whether it becomes a plain ✅ or a qualified
  cell that states the empty-database condition.
- **Row 19: keep the OS pair.** Linux log shipping is documented only Linux to Linux. The 16 Nov run words
  the fix "Windows and Linux endpoints", which does not say whether a mixed pair is supported: keep the
  OS-pair condition in the rule.
- **Row 35: the instance-wide database limit still applies in multiple-database mode.** Do not
  relax `database_count`.
- **Connectivity rows 4, 20, 29 and 41 share one version stamp.** The connectivity KB,
  `connectivity-matrix.json` and `get-connection-details/SKILL.md` (lines 17, 121, 151) must carry the same
  version, and the changelog needs a row for it. A change to the document needs its version bump in the
  same commit, so land the four rows together. The matrix is canonical: edit it first, then the prose. Keep
  `3342`, `1433 to 65535` and `11000` (the SQL Database public-endpoint Redirect range) in both files: row 4
  must not remove them.
- **The prerequisite document needs a bump too.** `docs/sql-server-to-azure-migration-prerequisite.md`
  declares v1.11 on line 3, and an edit needs its version bump in the same commit. Rows 1, 16, 17, 28, 31 to
  34 and 39 all edit it. The stamp is quoted in 6 more lines (prerequisite `SKILL.md` 126 and 256, both
  contracts line 4, `path-catalog.json` 3, `schemas/output.schema.json` 28).

## Release

Rows 1, 5, 15, 16, 17, 19, 28 and 35 touch `reference/decision-rules.md`, which forces the full
coordinated release across every surface the README lists. Ship all the rows above in one release, then
align microsoft/microsoft-sql by pull request, issue first. Three version lines move:

- **Advisor KB, v3.15 to v3.16** (v3.15.0 shipped on 23 November with the official publication's content): about 20 stamped files, rewritten by
  `node tools/artifacts/check-artifacts.mjs --fix-prose`, plus the PDF, its preview image, the poster PNG
  and the six SVG mirrors, which are regenerated. The size reference is commit `47eb448`, where about 20 of
  its 29 files carry the stamp; a patch release touches 6 files (`f9e57c8`).
- **Prerequisite KB, v1.11 to v1.12:** 7 lines in 6 files (`prerequisite.md` 3, prerequisite `SKILL.md` 126
  and 256, both contracts line 4, `path-catalog.json` 3, `schemas/output.schema.json` 28).
- **Connectivity KB, v0.10 to v0.11:** 5 lines in 3 files and a changelog row (counted in the
  implementation audit).

## Not doing

The 22 findings below are not retained. Row 30 moved back to To do on 23 November: the production warning is correct, but the diagnostic itself is wrong in Strict mode. Nothing is to be edited in the
knowledge base for them. They stay recorded so that the weekly check does not raise them again as new.
The four re-baseline rows (13, 21, 25, 37) still need their claim re-baselined by the script, after
revalidating the source and the section (see "Weekly check gaps").

| # | Finding | Decision | Why |
|---|---|---|---|
| 2 | DMS and AVS shown with a dash | Already fixed | The matrix shows AVS as unsupported (`migration.md` 335, v3.3). |
| 3 | AVS log shipping and `BACKUP-BLOB-PATH` | Already fixed | The gate applies only when Blob is chosen as the transport (`decision-rules.md` 323). The Windows-only wording left is row 19. |
| 7 | AVS vMotion "hours" | Already fixed | `migration.md` 441 separates HCX live from bulk and cold. |
| 8 | BACPAC and `BACKUP-BLOB-PATH` | Already fixed in the rules | `decision-rules.md` 40 and 556 scope it to "only when that workflow stages the file in Blob". For a Fabric import, P11-004 follows in row 16. |
| 13 | Appliance sizes | Re-baseline only | P28-003 matches the page (VMware 32 GB, 8 vCPU, about 80 GB). |
| 14 | One anchor and two 403/429 links (14 Sept) | Closed | The artifact expired. The 2 Nov and 9 Nov reports list no 403/429 link; the broken anchor is now row 39. |
| 21 | SqlClient TLS defaults drift | Re-baseline after row 41 | The defaults in HEAD still match the page. The Learn table also has two rows HEAD lacks (5.1 certificate pinning, 7.0.3 pin validation fails closed), and the 13 Nov servicing releases (row 41) change §5.3. Re-baseline `conn-sqlclient-encryption-defaults` once row 41 lands, after revalidating the source and the section. |
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
| 38 | P27 overlay and P28 | Optional, not retained | P27 attaches only to a method path, and the catalog has no row-level data. |

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
  Rows 31 to 34, proposed on 2 Nov, are absent from the 9 and 16 Nov reports and still open.
- The 14 drifted claims have barely moved since 14 Sept (12 were already drifted then; the list was identical on 9 and 16 Nov): nobody
  re-baselines a claim until its rule is edited, so the report keeps raising the same list. After the
  10 Nov audit, six of them sit behind retained rows (1, 4 and 29, 5, 17, 20 and 41) and one behind row 6. Five were re-read and still
  match their source, but revalidate the source and the section before each re-baseline (see the last bullet): the Azure Data Studio and Data Migration Assistant
  retirement dates, the
  private endpoint redirect, ODBC Entra and Azure Migrate appliance claims (the SqlClient claim waits for row 41). Two
  (Azure Hybrid Benefit applicability, cross-cloud sources) were not re-read in full.
- The link checker says "exited non-zero (`0`)", which contradicts itself. On 9 Nov one link of 559 failed
  and the classifier could not attribute it; on 16 Nov two failed, it attributed one (a 502 on a Tech
  Community post cited at `migration.md` 470, which answers 200 on three retries, so transient) and
  could not attribute the other. Seven weeks running means a defect of the classifier, not a
  transient failure. The prerequisite contract test "could not confirm every source and anchor it cites"
  for as long, while the source verifier found 218 of 218 resolving until 9 Nov, when it found the
  broken anchor of row 39 (still the only one on 16 Nov), which is probably what the contract test was
  trying to say.
- The 10 Nov audit found three more gaps. The claims verifier falls back to the whole page when a
  claim's section heading is missing (`tools/weekly-check/verify-claims.mjs`, `sectionFromText`), so a
  vanished section looks like ordinary drift and a blind re-baseline locks a whole-page hash (row 6). The run's "companion updated (`path-catalog.json`)" box is
  generated even where the catalog has no row-level data (P11-010, P13-011, P13-013 and P21-009 exist
  only in the prerequisite markdown). The run takes dates from the knowledge base instead of from the
  source (row 28).
- The run's corrections need reading against the source before they are applied: on 10 Nov three of
  its proposals were wrong or incomplete (rows 20, 28 and 35), and on 16 Nov the one for row 41
  misstates the trigger.

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
| 41 | https://techcommunity.microsoft.com/t5/sql-server-blog/microsoft-data-sqlclient-7-1-2-7-0-4-and-6-1-8-are-now-available/ba-p/4573321 ; https://learn.microsoft.com/en-us/sql/connect/ado-net/encryption-and-certificate-validation |

## Out of scope

Blind behaviour evaluation: the protocol shows the model the expected answer before asking it
to score itself. Recorded so it is not lost. Microsoft has an open pull request proposing an
evaluation framework.
