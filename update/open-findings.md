# Open knowledge base findings

Source: the weekly knowledge-base checks of 14 September to 16 November 2026 (issue #75). The 40
findings open on 10 November were audited that day against the live Microsoft sources and the text now
in HEAD (last knowledge-base commit: 13 September); the 16 November check added one finding, row 41.
The file has three parts: **To do** (18 findings kept with their corrected fix, plus one decision, 28b),
**Implementation audit** (added 16 November: the lines to change for each one, a revised criticality and
a size) and **Not doing** (the 23 others, with the reason). The 10 November audit is
recorded in the comment of 10 November on issue #75
(https://github.com/fredgis/sql-migration-advisor/issues/75#issuecomment-6774890874), and the corrections
made after a review of the plan are in the follow-up comment
(https://github.com/fredgis/sql-migration-advisor/issues/75#issuecomment-6775214583). Row numbers are
the ones used since the findings were first recorded, so there are gaps. Rows are ordered by revised
criticality. Nothing applied yet. Tick a row when it lands and say in which release.

## To do

Criticality, revised on 16 November once the lines were read (it now measures what a customer who
follows HEAD gets wrong; on 10 November it measured the distance between HEAD and the source):
**High** = a wrong decision or a wrong deadline, **Medium** = incomplete or over-conservative (the answer
stays safe, but an option, a caveat or a prerequisite is missing), **Low** = wording, label, citation or
watch-list. The old values are in the summary table of the implementation audit. Regression risk: 🔴 the
executable mirror (`tests/engine/evaluate.mjs`) or golden scenarios must change, 🟠 data, matrix or
regex-checked text, 🟢 prose only.

| # | Where | What we say | What the source says now | Fix | Criticality | Regression risk |
|---|---|---|---|---|---|---|
| 1 | `migration.md` 107, 135, 230, 234, 238, 377, 378, 474, 622; `decision-rules.md` 49, 96, 165, 378, 380; both `SKILL.md`; `README.md` 180; `prerequisite.md` 57, 327-328, 334; `path-catalog.json` 533 (`supportStatus: preview_tool_ga_target`); `tests/engine/evaluate.mjs` 264-266 and the refusal at 290-295; the poster, the rule graph and `examples/sample-recommendation.md` (full list in the audit below) | The Fabric Migration Assistant is Preview, with "no Private Link", and a preview-acceptance gate applies to it | Generally Available since August 2026 (Fabric What's new). Doc of 24 Aug 2026: DACPAC up to 20 MB, on-premises data gateway only, VNet data gateway unsupported, no preview marking, Private Link never mentioned | Drop Preview everywhere. Replace "no Private Link" with "no VNet data gateway". Remove the preview-acceptance gate for the assistant. Do with row 16 | High | 🔴 engine gate and 9 Fabric scenarios: 6 carry "preview accepted / not acceptable" in their inputs, 3 expect "Migration Assistant Preview gates apply only if that path is chosen" |
| 28 | `migration.md` 538-540, 544; `decision-rules.md` §A1 `AVS-LICENSING` 109-111, 124; `prerequisite.md` P27-003 (531); `path-catalog.json` 922-924; `tests/run-tests.mjs` 542-543 | Pay-as-you-go retires 15 Oct 2026, new sales end 31 Oct 2026, reserved instances end 30 Aug 2027; "a recommendation made today on a pay-as-you-go assumption fails in under two months" | Azure Updates 569535 and the Learn portable VCF licensing reference: from 1 Nov 2025 new deployments must use portable VCF; license-included pay-as-you-go must transition by **31 Oct 2026**; reserved instances end 30 Aug 2027, and a reservation expiring earlier ends its benefit at expiry. The 15 Oct date appears only as 15 Oct 2025 (vDefend cores). The run proposed HEAD's own dates | Dates and wording only: re-date the table from the sources, rewrite the "under two months" wording in the past tense, keep "AVS is not retiring". P27-003 (`prerequisite.md` 531) repeats both wrong dates in its applicability cell and changes with them. Leave the changelog rows (v2.10 in `migration.md` and `README.md`) as they are. The eligibility rule is a separate decision, row 28b | High | 🟠 `tests/run-tests.mjs` 541-543 requires "15 October 2026" and "31 October 2026" in the knowledge base, the rules and the prerequisite document, so the gate changes with the text. Nothing else reads the dates: the mirror does not, and the three catalog fields have no reader |
| 16 | `migration.md` §5.4 (new row), §8 BACPAC row (343); `decision-rules.md` 381-382; `prerequisite.md` 223-230 (the P11 heading and its note that P11 does not cover Fabric), 237 (P11-004), 616-617; `advisor-coverage.json` 325-332; `path-catalog.json` 356-363 (P11 target variants); `tests/engine/evaluate.mjs` 972; `tests/run-tests.mjs` 2255-2321 | Fabric takes a DACPAC only, and the rules forbid offering a BACPAC import ("do not substitute a BACPAC import") | Fabric "SqlPackage for SQL database in Fabric": a .bacpac can be imported into an empty SQL database with `sqlpackage /action:import`. The Fabric migration overview lists "SqlPackage and Copy job". `evaluate.mjs` 659 already lists bacpac for Fabric | Lift the prohibition, but do not turn a refused assistant into a BACPAC recommendation automatically: the import needs an empty target database, a source that fits the Fabric T-SQL surface (the page says it may need altering) and a volume to qualify. Keep DACPAC as the assistant's schema path. Give BACPAC to Fabric a prerequisite path (P11 has no Fabric variant today) and separate the SqlPackage constraints from the assistant's (P16). Bring back the residual of the dropped row 8: `evaluate.mjs` 972 still treats every BACPAC as Blob-bound, so a local SqlPackage fallback can be rejected for a Blob reason. Do with row 1 | Medium | 🔴 3 scenarios send a refused assistant to Azure SQL Database and must be re-decided: `fabric-dacpac-too-large-remediation`, `fabric-small-database-with-an-oversized-dacpac-needs-another-path`, `fabric-preview-refused-keeps-the-ga-target-through-another-path` (the last one also forbids a Fabric answer) |
| 19 | `decision-rules.md` 304, 323; `migration-methods.json` 20; `prerequisite.md` P03-006 (121); `path-catalog.json` 116-128 (P03 question fields); `tests/engine/evaluate.mjs` 516-519; scenario `dms-online-to-sql-vm-linux-source` (4208); the rule graph (247, 249) and the poster (375) | Log shipping needs a Windows source ("Windows-only"). `migration.md` 192 already says Windows and Linux, so HEAD contradicts itself | Learn "Get started with log shipping on Linux": SQL Server Agent on both servers plus a CIFS/Samba share, Linux to Linux. Windows to Linux is not documented | Replace the Windows-only gate with an OS-pair condition instead of removing it: Windows to Windows as today; Linux to Linux documented (and P03-006 already assumes it); Windows to Linux and Linux to Windows neither documented nor excluded, so ask or leave to confirm; destination OS unknown, ask and do not promote log shipping. No contract collects the target OS (P03 asks `source_os` only), so either add a target-OS fact (contract, both schemas, `advisor-fact-mappings.json`, question) or keep the cross-OS case as "to confirm". The line audit recommends the second: about 12 lines, against about 175 new lines in 10 more files for a new fact. Keep the version and log-chain checks | Medium | 🔴 scenario `dms-online-to-sql-vm-linux-source` has no target OS and must not flip automatically; `chooseSqlVmMethod` returns DMS online for a Linux source with a minimal window. Add scenarios for Linux to Linux, cross-OS and unknown target OS, and keep Windows to Windows unchanged |
| 17 | `migration.md` 200, 369; `decision-rules.md` 50, 186, 357-360, 557; `prerequisite.md` P08-006 (178) and new P08 rows; `reference/input-contract.md` §4 and §8 (192, 213); both skills' `schemas/input.schema.json`; `advisor-fact-mappings.json`; `questions.json` (43-44); `path-catalog.json` P08 (question fields only); both `SKILL.md`; `tests/engine/evaluate.mjs` 529-536, 580-590, 623-630 | One link per database, always | Learn MI link overview, the "Extend an Always On availability group" page and the Azure SQL blog of 29 Sep: multiple-database mode (preview) replicates all databases of an availability group over one link, and an existing availability group is not required (SSMS can place standalone databases in a new single-node AG). Needs SQL Server 2022 CU27+ or 2025 CU9+ (Windows or Linux), Enterprise or Developer (not Standard), MI update policy SQL Server 2025 or Always-up-to-date, SSMS 22.10.2+. Cannot coexist with single-database links on one instance, and the mode cannot be changed in place. The pages differ on the SQL Server 2022 update policy: the overview states the general rule, the detailed page excludes the 2022 policy for this mode, and the blog expects support "in the coming weeks" | Keep one link per database for the single-database mode, with its criteria unchanged (Standard edition and SQL Server 2016 and later stay valid there). Add the multiple-database mode as a distinct mode behind preview acceptance, with its own criteria, never applied to the shared MI Link filter. Flag the 2022 update policy inconsistency instead of hard-coding it. Carry the mode through the canonical contract (every field needs a question, a type, a consumer and a golden scenario, and no hard gate may read an absent field), both schemas and the fact mapping, so the recommendation and the prerequisite plan stay in step. Do with row 35 | Medium | 🔴 new input, gate, contract, schemas, fact mapping and scenarios; the 5 existing capacity scenarios and every single-database scenario stay valid |
| 28b | `decision-rules.md` §A1 `AVS-LICENSING` table; `migration.md` §15.1; `tests/golden-scenarios.json` 1114 (`datacenter-exit-vmware-avs`); both skills' contracts if a licence-type fact is added | The rule table (`decision-rules.md` 115-119) holds AVS at `unknown_requires_assessment` when the licence is license-included or unknown, and makes it eligible on a confirmed portable VCF licence. The mirror (`evaluate.mjs` 377-390) and the scenario (1129-1138) already differ: AVS stays `eligible`, provisional, with the licence only in `evidenceRequired` | Same sources as row 28: new deployments have required portable VCF since 1 Nov 2025, pay-as-you-go had to transition by 31 Oct 2026, reserved instances end 30 Aug 2027 | **Decision needed.** First settle which of the table and the mirror is today's rule. Then keep it (dates fixed by row 28), or adopt the finer one: a valid existing license-included reservation is `eligible_with_remediation` until its term and 30 Aug 2027 at most; an unknown entitlement stays `unknown_requires_assessment`; a new deployment relying on license-included capacity is unsupported, for a commercial reason. The finer rule changes eligibility, so it needs a licence-type fact (portable VCF, existing reservation with its expiry, unknown) carried the same way by both skills. The prerequisite plan already has the fact (`avs_vcf_subscription_status`: schema 509, `questions.json` 74, catalog 937) and P27-003 already states the reservation boundary; the recommendation side has no licence field | Medium | 🔴 scenario `datacenter-exit-vmware-avs` expects AVS `eligible` with no licence answer; the recommendation and the prerequisite plan must give the same qualification and the same unknowns |
| 15 | `migration.md` 15, 150 and a new row in §4.1 (after 167); `decision-rules.md` 309, 349-353 and a new §B3 row; recommend `SKILL.md` 640; `tests/engine/evaluate.mjs` 895-901 and a new candidate | Arc migrates to SQL MI and SQL Server on Azure VM ("MI and VM targets both GA") | Azure Updates 571795 (29 Sep) and Learn: Arc also migrates to Azure SQL Database, Hyperscale included, in public preview, through DMS and a self-hosted integration runtime | Add the target, gated on preview acceptance. The preview concerns the Arc orchestration to Azure SQL Database, not Azure SQL Database itself: a refusal removes only that orchestration and keeps the GA routes to SQL Database. Keep `controlPlane=azure-arc` in the hand-off to the prerequisite plan (the mirror maps DMS to `azure-dms`, `evaluate.mjs` 895-901) | Medium | 🔴 Arc candidate set, preview gate and control-plane mapping in the mirror |
| 41 | `connectivity.md` §5.3 (488-496: the driver-change table and "Driver upgrades changed the defaults, twice"); `connectivity-matrix.json` `tls.breaking_defaults` (890-923; the `tls-sqlclient-*` names exist only as `affected_rules` of the claim); `claims-registry.json` 336-345 (`conn-sqlclient-encryption-defaults`) and its line in `connectivity.md` 721; optional pointers from `migration.md` 470 and `decision-rules.md` 449 | The §5.3 table stops at SqlClient 5.0 and ODBC 18 and says driver upgrades changed the defaults "twice". `HostNameInCertificate` appears only as the client-side answer when the connection name differs from the certificate (`connectivity.md` 408 and 515). The matrix carries no servicing-release diagnostic | SQL Server Blog of 13 Nov 2026, "Microsoft.Data.SqlClient 7.1.2, 7.0.4, and 6.1.8 are now available": the servicing releases tighten certificate validation. A `HostNameInCertificate` value now replaces the server name for validation, so a value that is not in the certificate fails the connection **even when the server name matches** (before, a wrong value was ignored in that case). The error is a certificate name mismatch during the TLS handshake, before login. With a deliberately wrong value, 7.1.2 and 7.0.4 fail on .NET 10 (native and managed networking) and on .NET Framework 4.8.1; 6.1.8 fails only with managed networking (the default on Linux and macOS, opt-in on Windows); 7.1.1 opens everywhere. The Learn page (last updated 29 Sep) has not caught up and ends at 7.0.3. The run's wording "when the connection hostname differs" is inexact: the new check applies when the name matches too | Add the three releases to §5.3 and to the matrix as a certificate-validation change, with this diagnostic first for a new TLS failure after an upgrade: search the connection strings for `HostNameInCertificate`, confirm each value appears in the certificate's subject or subject alternative names, fix or remove it. State the 6.1.8 scope (managed networking only) and correct "twice". Say the source is the blog until Learn is updated. Register the behaviour under claim `conn-sqlclient-encryption-defaults` and update its line in the claims table. Optionally point the retained-server-name pattern at it: a client that sets `HostNameInCertificate` for the old name now fails on these releases even when the connection name matches. Edit the matrix first, then the prose. Then re-baseline the claim (row 21) | Medium | 🟠 matrix entry and the shared connectivity version stamp (see Traps). No golden scenario covers SqlClient TLS |
| 31 | `prerequisite.md` §14 P11-010 (243) | Instance-scoped objects are scripted separately only for SQL MI, SQL VM and Arc-enabled SQL MI | A BACPAC carries only user-database schema and data. P11 also covers SQL containers, and an AVS-hosted SQL Server is a full instance like a SQL VM. The cited sqlpackage page does not state the instance-object point | Extend the applicability to AVS-hosted and containerised SQL Server. Markdown only: `path-catalog.json` has no row-level data, and the gate at `tests/check-prerequisite-skill.mjs` 668-698 accepts it (AVS is exempt, and P11 already serves SQL Server in a container) | Medium | 🟢 |
| 32 | `prerequisite.md` §16 P13-011 (290) | The requirement says "in any role", the applicability says subscriber only | Learn: SQL Server 2017 CU18 and later support replication for instances of SQL Server on Linux, with no role distinction | Apply whenever any publisher, distributor or subscriber is Linux-hosted or containerised. Markdown only | Medium | 🟢 |
| 33 | `prerequisite.md` §16 P13-013 (292) | The UNC snapshot folder applies only when the subscriber is a containerised SQL Server | Learn "Secure the snapshot folder": a remote distributor or pull subscriptions require a UNC share rather than a local path | Drop the container condition and apply to any pull subscription or remote distributor. Markdown only | Medium | 🟢 |
| 29 | `connectivity.md` 102 (the Managed Instance endpoint table; line 83 is the Azure SQL Database policy and stays); `connectivity-matrix.json` 87 (`connection_type`) | The endpoint table and the matrix row say "redirect (default since October 2025) or proxy" without the alias detail. The rule itself is already there: §7.3 (626-634) and the matrix entry `mi-proxyoverride-default` (775-787) state that the effective value decides, and `get-connection-details/SKILL.md` 197 that the meaning depends on when the value was set | Learn "Connection types" (re-read 16 Nov): `proxyOverride=Default` is deprecated and now works as an alias of Redirect; since Oct 2025 a programmatic deployment or update with `Default` is interpreted as Redirect and the value is never preserved; instances set to Default before Oct 2025 "are converted to Proxy" | Add "alias, deprecated, never stored" to the cell in line 102 and to the matrix field in line 87, and point both at §7.3. Do with row 4 | Low | 🟠 matrix field |
| 4 | Managed Instance lines only: `connectivity.md` 102, 120-142 (the redirect-ports block), 584-613 (§7.1), 715; `connectivity-matrix.json` 87-93, 757-773 (`get-connection-details/SKILL.md` 189 and 235 stay true). Not lines 74, 79, 452, 459, 678 and 717: they describe Azure SQL Database, where 11000-11999 is right | HEAD already records the redirect ports as disputed: test 1433 first, open 11000-11999 only if that fails and policy allows it | Learn "Connection types" (re-read 16 Nov): redirect needs port 1433 across the instance's subnet range plus DNS resolution of the instance zone; 11000-11999 appears nowhere on that page or on the two connectivity-architecture pages. The Bicep and ARM quickstarts (re-read 16 Nov) still create an inbound NSG rule for 11000-11999 from the virtual network, so the conflict is current and not a leftover of old templates | HEAD's guidance fits both readings, so the conflict stays open and is not resolved in favour of 1433 alone. Add the missing DNS requirement to §2.2 and to the matrix row 87-93, and date the evidence. Do with row 29. Do not touch the MI Link range 11000-11999 | Low | 🟠 matrix text. No golden scenario covers redirect ports (the 28 golden mentions of 11000 are MI Link) |
| 34 | `prerequisite.md` §24 P21-009 (413) | The private-sink self-hosted integration runtime names SQL VM, Arc-enabled SQL MI and containers, not AVS | The Data Factory SQL Server connector requires a self-hosted integration runtime for stores inside an on-premises network or a virtual network. AVS is not named, so this is an inference | Add an AVS-hosted SQL Server with no public endpoint. Markdown only; AVS is exempt from the gate at `tests/check-prerequisite-skill.mjs` 668-698 | Low | 🟢 |
| 35 | `migration.md` 200; `decision-rules.md` 50, 360; `reference/input-contract.md` 213; recommend `SKILL.md` 172, `input.schema.json` 267 and `output.schema.json` 329; `prerequisite.md` P08-006 (178); `tests/engine/evaluate.mjs` 586; `tests/golden-scenarios.json` 2370 (`why` text) | Link capacity derived straight from `database_count` (100 or 500 "links") | Learn MI link overview: in multiple-database mode every replicated database still counts toward the instance-wide limit (100 for General Purpose and Business Critical, 500 for next-gen); only the number of links changes | Reword "links" to "databases" in the capacity text, keep `database_count` at or below the limit in both modes and check the capacity left on the target (existing databases count against it). Do not relax the check. Do with row 17 | Low | 🟢 wording; 🔴 if the check is relaxed (5 capacity scenarios) |
| 5 | `migration.md` 319; `decision-rules.md` 428; recommend `SKILL.md` 299 and 639 | LRS cutover is minutes on General Purpose, hours on Business Critical | Learn LRS: a job is cancelled after 30 days; Business Critical seeding takes "up to several hours"; no figure for General Purpose. "Minutes" is our own estimate, stored in `decision-rules.data.json` (`businessCutoverDowntimeByTier.default`) | Label "minutes" as our own estimate instead of dropping it. The 30-day ceiling is already in HEAD (`migration.md` 201, `decision-rules.md` 340 and 559) and needs nothing | Low | 🟢 for the label; 🔴 if "minutes" is dropped (13 of 16 LRS scenarios, the data file and `evaluate.mjs` 199) |
| 6 | `reference/claims-registry.json` 223-233, claim `arc-sql-migration-minimum-source-versions` (225 and 226 by hand; 227 and 228 by the script) | The claim watches the "Prerequisites" section of the Arc migration overview | That section no longer exists on the overview. The floors now sit on the Arc to Managed Instance page (MI Link: SQL Server 2016 on Windows Server 2016; LRS: SQL Server 2012 on Windows Server 2012) and the overview gives 2014 for the whole experience. HEAD already splits these floors (`decision-rules.md` 349-353, `migration.md` 371) | Re-point `source_url` and `source_section` to the Arc to MI page, check the section exists, then re-baseline. No knowledge-base text to change. Without it the verifier hashes the whole page (`tools/weekly-check/verify-claims.mjs`, `sectionFromText`) | Low | 🟢 |
| 20 | `connectivity.md` 333, 355, 723; `connectivity-matrix.json` 420 (`min_version`) and 429 (`extra_property`); `claims-registry.json` 376 (the claim's note; `jdbc-auth-keywords` and `jdbc-msi-client-id` are its `affected_rules` names, not matrix keys) | `ActiveDirectoryMSI` needs JDBC 8.3.1; a minimum-version dispute is recorded | The JDBC page contradicts itself: the keyword list says "since 8.3.1", the dedicated section says "supported starting with version 7.2", the dependency table starts at 7.2. `ActiveDirectoryManagedIdentity` needs 12.2, and its keyword entry says the Client ID of a user-assigned managed identity "can also now be set in the `user` property" (re-read on 16 Nov; the run proposed this row on 26 Oct and again on 16 Nov) | Record 7.2 (dedicated section and table) and keep 8.3.1 only as the `msiClientId` boundary. For `ActiveDirectoryManagedIdentity` (12.2 and later) add the `user` property as a way to pass a user-assigned Client ID, next to `msiClientId` for the legacy `ActiveDirectoryMSI`. Keep a note that the page is inconsistent rather than deleting the dispute | Low | 🟠 matrix entry and the shared connectivity version stamp (see Traps); no scenario |
| 39 | `prerequisite.md` 155 (P06-005; the only occurrence of the anchor) | The source link is `tutorial-migrate-vmware#run-a-test-migration` | The anchor is gone. The test-migration steps now sit under `#track-and-migrate-replicating-servers` | Re-point the link and update the checked date | Low | 🟢 |

**About 207 existing lines to edit in 30 files, and about 470 new lines** (about 630 if row 28b is
adopted), of which about 370 are golden scenarios and mirror code. The sizes by finding are in the
implementation audit below; the new-line figures are estimates. The drifted claims are re-baselined by the
script. Two rows are High: 1 and 28. Row 20 is contested inside the Microsoft page itself, rows 31 to 34
and 41 are incomplete as written, and rows 4 and 29 are smaller than they looked, because HEAD already
carries most of the fix. Do rows 1 and 16 together (they move the same Fabric scenarios), rows 4, 20, 29
and 41 in one connectivity version (the same lines and the same stamp), and rows 17 and 35 together.

## Implementation audit

Written on 16 November 2026. Every retained row was re-read against HEAD (`df706e2`) and the live
sources, and every line number below was read in that commit. Nothing was run: the tests were not
executed, so the couplings listed come from reading the gates. "Existing lines" counts the lines of HEAD
that change (a block counts in full when it is rewritten). "New lines" is an estimate, plus or minus a
quarter, and scenario and mirror code make up most of it.

### Summary

| # | Finding | Criticality (10 Nov to 16 Nov) | Why it moved | Existing lines | New lines | Files |
|---|---|---|---|---|---|---|
| 1 | Fabric Migration Assistant is GA | High to **High** | A customer who accepts GA only is told the GA assistant is out | 118 for 1 and 16 together | about 115 | 17 |
| 16 | BACPAC import into Fabric | High to **Medium** | A missed option: the other fallbacks after a refusal still stand | in the Fabric lot | | |
| 28 | AVS dates | High to **High** | Two of the three dates are not in the sources, and "no new sales on 31 Oct" contradicts the 1 Nov 2025 rule | 14 | about 1 | 5 |
| 19 | Log shipping, Linux to Linux (minimal option) | High to **Medium** | A Linux source already goes to DMS online, so the loss is an option, plus a contradiction between `migration.md` 192 and the rules | 12 | about 8 | 6 |
| 17 | MI Link multiple-database mode | Medium to **Medium** | A new preview mode and a new input carried by both skills | 7 | about 200 | 14 |
| 28b | AVS eligibility rule, only if adopted | Medium to **Medium** | A decision; nothing to do if today's rule is kept | 12 | about 160 | 8 |
| 15 | Arc to Azure SQL Database (preview) | Medium to **Medium** | A missing preview route | 6 | about 120 | 5 |
| 41 | SqlClient `HostNameInCertificate` | Medium to **Medium** | A new post-upgrade TLS failure with no diagnostic | 4 | about 20 | 3 |
| 31 | P11-010, instance objects | Medium to **Medium** | A required prerequisite is absent for AVS and container targets | 1 | 0 | 1 |
| 32 | P13-011, replication on Linux | Medium to **Medium** | Same, for a Linux publisher or distributor | 1 | 0 | 1 |
| 33 | P13-013, UNC snapshot folder | Medium to **Medium** | Same, for any pull subscription or remote distributor | 1 | 0 | 1 |
| 29 | MI `Default` alias | High to **Low** | HEAD already states the rule in §7.3, the matrix and `SKILL.md`; only the short form in line 102 lacks the alias | 2 | about 2 | 2 |
| 4 | MI redirect ports | High to **Low** | HEAD already says "test 1433 first", and the quickstarts still create the 11000-11999 rule, so the conflict stays open; only DNS is missing | 4 | about 2 | 2 |
| 35 | Capacity counts databases | Low to **Low** | Wording | 10 | 0 | 9 |
| 34 | P21-009, AVS | Low to **Low** | An inference | 1 | 0 | 1 |
| 5 | LRS "minutes" | Low to **Low** | The 30-day ceiling is already in HEAD, so only the label is left | 4 | 0 | 3 |
| 6 | Claim re-point | Low to **Low** | Restores a blind spot of the weekly check | 2 | 0 | 1 |
| 20 | JDBC minimum version | Low to **Low** | Contested inside the Microsoft page | 6 | about 2 | 3 |
| 39 | Dead anchor | Low to **Low** | One link | 1 | 0 | 1 |
| | Connectivity version stamp (rows 4, 20, 29, 41) | | Gated, see "Gates" | 5 | about 1 | 3 |
| | Prerequisite version stamp (rows 1, 16, 17, 28, 31 to 35, 39) | | Gated, see "Gates" | 8 | 0 | 7 |
| | **Total** | | | **207** | **about 470** | **30** |
| | **Total with 28b adopted** | | | **219** | **about 630** | **30** |

The advisor knowledge-base release (v3.14 to v3.15, about 20 stamped files) is not counted: see Release.

### What the line audit changed in the rows above

- **Rows 4 and 29 are small.** HEAD already carries most of the fix: §7.3 (626-634) and the matrix entry
  `mi-proxyoverride-default` (775-787) state that the effective value decides,
  `get-connection-details/SKILL.md` 197 says the meaning depends on when the value was set, and §2.2
  already says to test 1433 first. The first "Where" cell of row 4 mixed in Azure
  SQL Database lines (74, 79, 452, 459, 678, 717), where 11000-11999 is correct and must not change. The
  Bicep and ARM quickstarts still create the 11000-11999 rule (re-read 16 November), so the first fix's
  "older quickstarts" was wrong: the conflict is current and stays open.
- **Row 5 loses half its fix.** The 30-day ceiling is already in HEAD (`migration.md` 201,
  `decision-rules.md` 340 and 559, `run-tests.mjs` 456-459). Only the "minutes" label is left.
- **Row 28 has a test gate.** `tests/run-tests.mjs` 541-543 asserts the old dates in three documents, and
  `prerequisite.md` 531 repeats them. The first version said nothing read the dates.
- **Rows 1 and 16: more surfaces, fewer test edits.** The poster (300, 391), the rule graph (236, 279, 316,
  342) and `examples/sample-recommendation.md` (64, 122, 239) repeat the Preview wording; README 152 does not
  (only 180 does). The coverage counts are computed from the data (`run-tests.mjs` 1812-1836), so only the
  prose and the description change, not the test. The gate that must be rewritten is
  `matrix-cell-qualifiers-reach-the-guidance` (2255-2321): the `(DACPAC)` cell (`migration.md` 343) is the
  only artefact-qualified cell, the gate demands that the guidance never offers the row's own artefact
  there, which is the opposite of row 16, and a plain cell makes it fail with "checking nothing".
- **Row 19: two more surfaces.** The rule graph (247, 249) and the poster (375) say "Windows source".
- **Rows 20 and 41: matrix keys.** `jdbc-auth-keywords`, `jdbc-msi-client-id` and `tls-sqlclient-*` are claim
  `affected_rules` names, not matrix keys. The matrix lines are 420 and 429 (JDBC) and the
  `tls.breaking_defaults` block, 890-923.
- **Row 28b: the rule and the mirror already disagree** (see its row).
- **Rows 31 to 34 pass the applicability gate** (`check-prerequisite-skill.mjs` 668-698): AVS is exempt, and
  P11 already serves SQL Server in a container.
- **Criticality.** Six High rows become two (1 and 28). Rows 4 and 29 fall to Low because HEAD already holds
  most of the fix, and rows 16 and 19 fall to Medium because the effect is a missed option, not a wrong
  decision.

### Detail by finding

#### Fabric: rows 1 and 16, one lot (118 existing lines, about 115 new, 17 files)

| File | Lines at HEAD | Change | Existing |
|---|---|---|---|
| `docs/sql-server-to-azure-migration.md` | 107, 135, 230, 234, 238, 343, 377, 378, 474, 622 | Drop "Preview" for the assistant; "no Private Link" becomes "no VNet data gateway"; the §8 cell; a new §5.4 row for the BACPAC import into an empty database | 10 (+1 new) |
| `reference/decision-rules.md` | 49, 96, 165, 378, 380, 381, 382 | Remove the preview gate on the assistant (`preview_acceptable` stays for MI-TIER and COPILOT-AGENT); replace "do not substitute a BACPAC import" with its conditions | 7 (+2) |
| `docs/sql-server-to-azure-migration-prerequisite.md` | 57, 223, 225-230, 237, 327-328, 334, 582-583, 616-617 | P16 label and text; the P11 heading and the note saying P11 does not cover Fabric; P11-004 (Blob access) only when the BACPAC is staged in Blob; coverage counts 51 and 7 become 52 and 6; new P11 rows for Fabric (Entra ID only, empty target) | 16 (+2) |
| `README.md` | 180 | "Preview against a GA target" | 1 |
| both `SKILL.md` | recommend 645; prerequisite 181 | Same wording | 2 |
| `reference/migration-methods.json` | 24 | "Preview." | 1 |
| `reference/claims-registry.json` | 101 | Claim text only; keep the claim id `fabric-sql-db-migration-preview-limits`; the script re-baselines the hash | 1 |
| `skills/generate-migration-prerequisite-plan/reference/path-catalog.json` | 356, 533 (and one line in 357-363) | `supportStatus` is no longer `preview_tool_ga_target`; add "SQL database in Fabric" to the P11 `target` and `targetVariants`, which the gate at `check-prerequisite-skill.mjs` 689-698 needs once a P11 row names Fabric | 2 (+1) |
| `.../reference/advisor-coverage.json` | 3, 328-331 | The Fabric by BACPAC cell moves from `out-of-scope` to `path` P11; the description's "51" and "7" become "52" and "6" | 5 (+1) |
| `tools/diagram/poster.html` | 300, 391 | "no Private Link need" and the "Preview, the target is GA" pill (the PNG is regenerated) | 2 |
| `blume/public/rule-graph.html` | 236, 279, 316, 342 | Method note, FABRIC-TARGET note, input values, expected method text | 4 |
| `examples/sample-recommendation.md` | 64, 122, 239 | "only the Fabric Migration Assistant is preview" (the JSON block at 239 is schema-validated by `run-tests.mjs` 2678-2703; text only) | 3 |
| `tests/check-prerequisite-skill.mjs` | 783, 802-804 | `P16 === 'preview_tool_ga_target'` and the two regexes "target is GA" and "Migration Assistant is Preview" | 4 |
| `tests/run-tests.mjs` | 2255-2264, 2317 | The `(DACPAC)` cell gate, see above | 11 (+3) |
| `tests/engine/evaluate.mjs` | 264-266, 269-270, 275-281, 290-295, 477, 972 | Assistant gate (preview, gateway), unknowns text, Private Link regex, refusal to remediate, shortlist text, and the BACPAC treated as Blob-bound | 20 (+15) |
| `tests/golden-scenarios.json` | 110, 1838, 1875, 1912, 1950, 2024, 2080, 2120, 3933 (nine scenarios) | Six inputs carry "preview accepted / not acceptable"; three expect "Migration Assistant Preview gates apply only if that path is chosen"; three are re-decided (`fabric-dacpac-too-large-remediation`, `fabric-small-database-with-an-oversized-dacpac-needs-another-path`, `fabric-preview-refused-keeps-the-ga-target-through-another-path`); the `assertRulePresent` regexes of `fabric-private-link-unsupported` and `fabric-driver-preview-gates-met-validated` follow `decision-rules.md` 380; two new scenarios (a local BACPAC with Blob blocked; a refused assistant qualified to BACPAC) | about 29 (+90) |

`fabric_gateway_type` keeps its option `VNET_OR_PRIVATE_LINK` (`questions.json` 57): it is an input value
and renaming it would break both schemas. Decide the §8 cell first (a plain ✅, or a qualified cell for the
empty-database condition): the gate rewrite follows from it.

#### Row 19, minimal option (12 existing lines, about 8 new, 6 files)

| File | Lines at HEAD | Change | Existing |
|---|---|---|---|
| `reference/decision-rules.md` | 304, 323 | "Windows source" and "Windows-only" become an OS-pair condition: Windows to Windows, Linux to Linux; the mixed pairs and an unknown target OS stay "to confirm" | 2 (+2 new) |
| `reference/migration-methods.json` | 20 | "Windows-only." | 1 |
| `tests/engine/evaluate.mjs` | 516-517, 519 | The comment and the Linux branch: DMS online stays the answer, with a new unknown saying log shipping is documented Linux to Linux only | 3 (+4) |
| `tests/golden-scenarios.json` | 4207-4238 | `dms-online-to-sql-vm-linux-source`: the `why` (4210) and one expected unknown; the scenario does not flip | 3 (+2) |
| `blume/public/rule-graph.html` | 247, 249 | Two notes | 2 |
| `tools/diagram/poster.html` | 375 | "Windows source" | 1 |

`migration.md` 192 and `prerequisite.md` P03-006 (121) already assume Linux: no change. The full option adds
a target-OS fact: both input contracts (about 4 lines), both schemas (about 16), the fact mapping (about 8),
`questions.json` (about 2), the P03 question fields (1), both `SKILL.md` (about 8), the mirror (about 15)
and three scenarios (about 120), so about 175 new lines in 10 more files. Take the minimal option.

#### Row 28, AVS dates (14 existing lines, 5 files)

| File | Lines at HEAD | Change | Existing |
|---|---|---|---|
| `docs/sql-server-to-azure-migration.md` | 538-540, 544 | The three table rows (1 Nov 2025 new deployments need portable VCF; 31 Oct 2026 pay-as-you-go must transition; 30 Aug 2027 reserved instances end) and the "under two months" sentence | 4 |
| `reference/decision-rules.md` | 109-111, 124 | Same table, and "expires before the project starts" | 4 |
| `docs/sql-server-to-azure-migration-prerequisite.md` | 531 | P27-003 applicability cell | 1 |
| `skills/generate-migration-prerequisite-plan/reference/path-catalog.json` | 922-924 | The three date fields; no code reads them, so the field names can follow the new meaning | 3 |
| `tests/run-tests.mjs` | 542-543 | 542 fails once the 15 October date is gone and must change; 543 keeps passing on 31 October 2026, but its message names the old meaning ("end of new license-included sales"); 541 (the 2027 date) stays | 2 |

Do not touch: `README.md` 561 and `migration.md` 688 (changelog rows v2.10), `path-catalog.json` 921 and 925
(still right: the earlier of the reservation's expiry and 30 August 2027; ten months).

#### Connectivity: rows 29, 4, 20 and 41, one version (21 existing lines, about 27 new, 4 files)

| File | Lines at HEAD | Change | Row | Existing |
|---|---|---|---|---|
| `docs/sql-server-to-azure-migration-connectivity.md` | 102 | "alias, deprecated, never stored" in the Managed Instance endpoint table | 29 | 1 |
| | after 634 | One sentence in §7.3 | 29 | (+2 new) |
| | 125, 592 | Record the 16 November re-read of the connection-types page | 4 | 2 |
| | after 145 | The DNS requirement for redirect (new) | 4 | (+2 new) |
| | 333, 355, 723 | JDBC table cell, the client-ID sentence, the claims-table line | 20 | 3 |
| | 488-489, 721 | "changed the defaults, twice", the claims-table line | 41 | 3 |
| | after 496 | Three table rows and the `HostNameInCertificate` diagnostic (new) | 41 | (+9 new) |
| `skills/get-connection-details/reference/connectivity-matrix.json` | 87 | `connection_type` | 29 | 1 |
| | 89, 760 | `client_requirement` gets DNS; the evidence date | 4 | 2 |
| | 420, 429 | `min_version`, and `extra_property` next to the `user` property | 20 | 2 |
| | after 922 | New entry in `tls.breaking_defaults` (890-923) | 41 | (+10 new) |
| `reference/claims-registry.json` | 376 | Claim note (dispute) | 20 | 1 |
| | 347 | Claim note (servicing releases) | 41 | 1 |
| Version stamp | `connectivity.md` 3; the matrix 3; `get-connection-details/SKILL.md` 17, 121, 151 | v0.10 becomes v0.11, plus a changelog row in `connectivity.md` 745 | all | 5 (+1 new) |

Optional pointers for row 41, not counted: `connectivity.md` 408 and 515, `migration.md` 470,
`decision-rules.md` 449, and one gotcha line in `get-connection-details/SKILL.md` 189-198. Edit the matrix
first (it is canonical), then the prose, then the stamp.

#### MI Link: rows 17 and 35

Row 35, wording only (10 existing lines, 9 files):

| File | Lines at HEAD | Change |
|---|---|---|
| `docs/sql-server-to-azure-migration.md` | 200 | "up to 100 links" becomes "up to 100 databases" |
| `reference/decision-rules.md` | 50, 360 | Same |
| `reference/input-contract.md` | 213 | Same |
| recommend `SKILL.md` | 172 | Same |
| recommend `schemas/input.schema.json`, `schemas/output.schema.json` | 267, 329 | Same, in two descriptions |
| `docs/sql-server-to-azure-migration-prerequisite.md` | 178 | P08-006 "link/database-count limits" |
| `tests/engine/evaluate.mjs` | 586 | The message "capacity N links exceeded by M databases" |
| `tests/golden-scenarios.json` | 2370 | The `why` of the capacity scenario |

Row 17, multiple-database mode (7 existing lines, about 200 new, 14 files):

| File | Lines at HEAD | Change | Existing |
|---|---|---|---|
| `docs/sql-server-to-azure-migration.md` | 369 (+ a new row after 200) | Edition and source line; the new mode as its own row | 1 (+3) |
| `reference/decision-rules.md` | 186 (+ after 360 and 557) | MI Link prerequisites sentence; a new rule row and index row (CU27 or CU9, Enterprise or Developer, update policy, coexistence, preview acceptance) | 1 (+7) |
| `docs/sql-server-to-azure-migration-prerequisite.md` | new P08 rows | Version and CU, edition, update policy, SSMS 22.10.2, no coexistence with single-database links | (+3) |
| `reference/input-contract.md`; prerequisite `input-contract.md` | after 213; 199-226 | A new field and its vocabulary section | (+13) |
| both `schemas/input.schema.json`; `advisor-fact-mappings.json`; `questions.json`; `path-catalog.json` P08 | new properties | The field in both schemas, its mapping and its question | (+27) |
| recommend `SKILL.md`; prerequisite `SKILL.md` | 148, 641 (+ a new question) | Edition row, the gates table, the question | 2 (+8) |
| `tests/engine/evaluate.mjs` | 580-590 (+ new gate) | Mode, edition, version and policy gate | 3 (+25) |
| `tests/golden-scenarios.json` | new | Multiple-database eligible; Standard edition refused; preview refused falls back to single-database links | (+120) |

The five existing capacity scenarios and every single-database scenario stay valid.

#### Row 28b, only if adopted (12 existing lines, about 160 new, 8 files)

| File | Lines at HEAD | Change | Existing |
|---|---|---|---|
| `reference/decision-rules.md` | 115-119 (+ new rows) | The three answer rows by licence type | 3 (+4) |
| `docs/sql-server-to-azure-migration.md` | 530-548 | §15.1 text for the finer rule | (+4) |
| `tests/engine/evaluate.mjs` | 377-390 | Read a licence fact; today the function adds an unknown only when the region is missing | 4 (+20) |
| `tests/golden-scenarios.json` | 1113-1146 (`datacenter-exit-vmware-avs`) | Re-decide `eligible` with no licence answer (it expects `eligible`, provisional, low confidence); two or three new scenarios | 5 (+100) |
| recommend `schemas/input.schema.json`, recommend `SKILL.md`, `reference/input-contract.md` | new | A licence-type field (portable VCF, existing reservation with its expiry, unknown) | (+25) |
| `advisor-fact-mappings.json` | new | Map it to `avs_vcf_subscription_status` | (+8) |

If today's rule is kept, there is nothing to do here, except to settle whether the table (115-119) or the
mirror (377-390) is that rule.

#### Row 15, Arc to Azure SQL Database (6 existing lines, about 120 new, 5 files)

| File | Lines at HEAD | Change | Existing |
|---|---|---|---|
| `docs/sql-server-to-azure-migration.md` | 15, 150 (+ new rows in §4.1 after 167 and in §5.1) | "MI and VM targets both GA" gets the preview SQL Database route | 2 (+3) |
| `reference/decision-rules.md` | 309 (+ 349-353 and a new §B3 row) | The Arc-orchestrated route, its floor and its preview gate | 1 (+6) |
| recommend `SKILL.md` | 640 | Gates table | 1 (+1) |
| `tests/engine/evaluate.mjs` | 899-900 (+ new candidate) | `dms` is mapped to `azure-dms` before the Arc checks, so the Arc-orchestrated route needs its own method name to keep `azure-arc`; add the candidate and its preview gate | 2 (+20) |
| `tests/golden-scenarios.json` | new | Arc source to SQL Database with preview accepted; refused, GA routes kept | (+90) |

The nine existing Arc scenarios (942, 975, 1009, 2416, 2790, 2830, 2870, 2979, 3963) are not expected to
change: re-run them.

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

### Gates and tests that pin the text

| Gate | Lines | What it pins | Rows |
|---|---|---|---|
| `tests/run-tests.mjs` | 541-543 | The AVS dates in three documents | 28 |
| `tests/run-tests.mjs` | 1812-1836 | The coverage prose equals the data (computed): `prerequisite.md` 582-583 and `advisor-coverage.json` 3 must follow | 16 |
| `tests/run-tests.mjs` | 2255-2321 | The `(DACPAC)` cell, and B3 never offering BACPAC for Fabric | 16 |
| `tests/run-tests.mjs` | 1283-1297, 1323-1324 | The connectivity KB, its matrix and `get-connection-details/SKILL.md` carry one version; `3342`, `1433 to 65535` and `11000` stay in the KB and the matrix | 4, 20, 29, 41 |
| `tools/weekly-check/check-consistency.mjs` | 288-298 | The same version and a changelog row, in the weekly check | 4, 20, 29, 41 |
| `tests/run-tests.mjs` | 3405-3432 | A change to the connectivity or the prerequisite document without a version bump in the same commit fails | 1, 4, 16, 17, 20, 28, 29, 31 to 35, 39 and 41 |
| `tests/check-prerequisite-skill.mjs` | 783, 802-804 | The P16 label and the "target is GA" and "Migration Assistant is Preview" regexes | 1 |
| `tests/check-prerequisite-skill.mjs` | 668-698 | A row that names a target its path does not serve cannot activate | 16 (P11 must serve Fabric), 31, 34 |
| `tests/run-tests.mjs` | 2678-2703 | The example JSON validates against the output schema | 1 (text only) |

After each lot, run `node tests/run-tests.mjs`, `node tests/check-prerequisite-skill.mjs` and
`node tools/artifacts/check-artifacts.mjs`. None of them was run for this audit.

### Order of work

1. Text only, no engine: rows 31 to 34, 39, 5 and 6 (11 lines; the script re-baselines row 6).
2. Connectivity in one version: rows 4, 29, 20 and 41, the matrix first (21 existing lines).
3. Row 28 with its test gate (14 lines).
4. Fabric, rows 1 and 16 (118 lines): rule text first, then the mirror, then the scenarios, and the DACPAC-cell gate last.
5. Row 19, minimal option (12 lines).
6. Rows 17 and 35 together, then row 15: both need new inputs or routes in both skills.
7. Row 28b only after the decision.
8. One release for everything (see Release).

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
- **`SKILL.md` repeats rows 1, 5, 15 and 17** in its factual-gates table. Fix both copies, or
  remove that table first, which also cuts the skill's token count.
- **Row 28: check a date against its source, not against this knowledge base.** The run proposed
  the dates already in HEAD. The sources say 31 Oct 2026 for pay-as-you-go and 1 Nov 2025 for new
  deployments. The 16 Nov run now proposes row 28b's finer eligibility rule, still with HEAD's dates.
- **Rows 1 and 16 move the same Fabric scenarios.** Decide what a refused assistant falls back to
  (Azure SQL Database today) before touching them.
- **Row 19 flips `dms-online-to-sql-vm-linux-source`.** Linux log shipping is documented only Linux
  to Linux; keep that limit in the rule or the scenario stops being a witness. The 16 Nov run words
  the fix "Windows and Linux endpoints", which does not say whether a mixed pair is supported: keep
  the OS-pair condition.
- **Row 35: the instance-wide database limit still applies in multiple-database mode.** Do not
  relax `database_count`.
- **Connectivity rows 4, 20, 29 and 41 share one version stamp.** The connectivity KB,
  `connectivity-matrix.json` and `get-connection-details/SKILL.md` (lines 17, 121, 151) must carry the same
  version, and the changelog needs a row for it (`tests/run-tests.mjs` 1283-1297 and 1323-1324,
  `tools/weekly-check/check-consistency.mjs` 288-298). The gate at `run-tests.mjs` 3405-3432 also fails a
  change to the document that is not accompanied by a bump in the same commit, so land the four rows in one
  commit. The matrix is canonical: edit it first, then the prose. The `run-tests.mjs` gate also requires `3342`,
  `1433 to 65535` and `11000` (the SQL Database public-endpoint Redirect range) to stay in both files,
  so row 4 must not remove them.
- **The prerequisite document needs a bump too.** `docs/sql-server-to-azure-migration-prerequisite.md`
  declares v1.11 on line 3, and the same gate fails an edit without a bump in the same commit. Rows 1, 16,
  17, 28, 31 to 35 and 39 all edit it.
- **The DACPAC-cell gate argues against row 16.** `run-tests.mjs` 2255-2321 is the only test that reads
  the qualified cell in `migration.md` 343, and its premise is that Fabric never gets a BACPAC. Rewrite it
  with the cell, not after.

## Release

Rows 1, 5, 15, 16, 17, 19, 28 and 35 touch `reference/decision-rules.md`, which forces the full
coordinated release across every surface the README lists. Ship all the rows above in one release, then
align microsoft/microsoft-sql by pull request, issue first. Three version lines move:

- **Advisor KB, v3.14 to v3.15:** about 20 stamped files, rewritten by
  `node tools/artifacts/check-artifacts.mjs --fix-prose`, plus the PDF, its preview image, the poster PNG
  and the six SVG mirrors, which are regenerated. The size reference is commit `47eb448` (29 files, 379
  insertions, 77 deletions, of which about 55 edited lines are stamps in 20 files); a patch release is 6
  files (`f9e57c8`).
- **Prerequisite KB, v1.11 to v1.12:** 8 lines in 7 files (`prerequisite.md` 3, prerequisite `SKILL.md` 126
  and 256, both contracts line 4, `path-catalog.json` 3, `schemas/output.schema.json` 28,
  `tests/plans/valid-p10.json` 4).
- **Connectivity KB, v0.10 to v0.11:** 5 lines in 3 files and a changelog row (counted in the
  implementation audit).

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
