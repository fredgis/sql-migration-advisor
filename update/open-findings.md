# Knowledge base findings — open

Findings from the weekly check of 14 September 2026, re-verified against Microsoft
documentation on 15 September. Nothing here is applied yet.

This file is the record. Tick a row when it lands, and say in which release.

Scope note: this covers the three knowledge bases and the decision rules. The test engine
under `tests/` is a harness, not the product, and is out of scope here.

---

## 1. Wrong today

A reader following the knowledge base right now would be misled.

### 1.1 Fabric Migration Assistant is no longer Preview

- **Where** `docs/sql-server-to-azure-migration.md` lines 135 and 234
- **We say** the target is GA and "only the Fabric Migration Assistant is Preview", with
  "Preview tool limits", and that Private Link is unsupported
- **Microsoft says** the page carries no Preview marking at all, and never mentions Private
  Link. What it excludes is the virtual network data gateway. The 20 MB DACPAC ceiling and
  "on-premises data gateway only" both hold
- **Do** drop the Preview wording from both lines, replace "no Private Link" with "virtual
  network data gateways are not supported", keep the DACPAC and gateway limits
- **Watch** the Preview marking is the argument that keeps Fabric eligible while the
  assistant is limited. Removing it changes what the rules can say about the target, so read
  `reference/decision-rules.md` §B3 Fabric before editing
- **Source** https://learn.microsoft.com/en-us/fabric/database/sql/migration-assistant
- **Size** 2 lines, 1 file, plus a rules read

### 1.2 The Managed Instance redirect port range is gone from the source

- **Where** `docs/sql-server-to-azure-migration-connectivity.md` lines 74, 79, 120, 126, 141,
  452, 459, 593, 603, 678, 717
- **We say** the redirect connection type needs outbound 11000-11999 to regional Azure SQL
  IPs as well as 1433, and a standing section calls the question disputed
- **Microsoft says** the range does not appear anywhere on the connection types page. The
  only stated prerequisite is 1433 across the instance subnet address range, plus DNS
  resolution. Redirect became the default in October 2025 and `proxyOverride=Default` is
  deprecated as an alias for it
- **Do** state 1433 across the subnet range as the requirement, retire the disputed section
  and its table of conflicting sources, add the October 2025 default and the deprecated alias
- **Watch** this is about **client connections to Managed Instance**. It is not the MI Link
  replication port set. The 5022 and 11000-11999 pairs in
  `docs/sql-server-to-azure-migration.md` and `reference/decision-rules.md` describe the
  distributed availability group endpoint, documented on a different page that has not been
  re-read. Leave them alone
- **Watch** changelog rows at lines 748 to 751 record what was true at the time. Do not
  rewrite them
- **Source** https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/connection-types-overview
- **Size** about 11 lines in 1 file, one of which is a section to remove

### 1.3 DMS does not target Azure VMware Solution

- **Where** `docs/sql-server-to-azure-migration.md` §8 summary matrix, DMS row, AVS column
- **We say** the cell is marked with a dash, which reads as an indirect route
- **Microsoft says** the DMS scenario status page lists six targets and AVS is not among
  them. Confirmed by a full-text scan, not an impression
- **Do** change the cell to a cross
- **Watch** the matrix is mirrored in
  `skills/generate-migration-prerequisite-plan/reference/advisor-coverage.json` and in the
  published rule graph. All three have to agree
- **Source** https://learn.microsoft.com/en-us/azure/dms/resource-scenario-status
- **Size** 1 cell, 3 surfaces

### 1.4 A transport gate is applied to methods that do not use the transport

- **Where** `reference/decision-rules.md`, `BACKUP-BLOB-PATH`, 5 occurrences
- **We say** the gate applies to the AVS log shipping row, and to BACPAC generally
- **Microsoft says** log shipping uses transaction log backups on a shared or local folder;
  Azure Blob is not inherent to it. A BACPAC can be imported directly from a local file with
  SqlPackage
- **Do** remove the gate from the AVS log shipping row and require a proven backup share
  instead. For BACPAC, apply it only when the chosen workflow stages the file in Blob
- **Watch** one piece of evidence that the log shipping change is right: the SQL VM row next
  to it already omits the gate, so the two rows contradict each other today
- **Watch** the BACPAC half needs a decision, because "does this workflow stage in Blob" is
  not a fact the interview collects today. Either add it or state a default
- **Source** https://learn.microsoft.com/en-us/sql/database-engine/log-shipping/about-log-shipping-sql-server
  and https://learn.microsoft.com/en-us/azure/azure-sql/database/database-import
- **Size** log shipping is 1 row. BACPAC is 1 row plus a decision

---

## 2. Claims with no source behind them

Not wrong, but nothing supports them.

### 2.1 Minimum achievable downtime for AVS

- **Where** `docs/sql-server-to-azure-migration.md` §12, 5 vMotion mentions
- **We say** roughly hours, with vMotion in brackets
- **Problem** §11 of the same document describes HCX live migration as near zero. A minimum
  achievable column has to reflect the live option, not the bulk one
- **Do** separate HCX vMotion, which is near zero for eligible virtual machines, from bulk
  and cold modes, which need an outage
- **Size** 1 cell plus a sentence

### 2.2 Log Replay Service cutover on General Purpose

- **Where** `reference/decision-rules.md`, LRS rows
- **We say** minutes on General Purpose, hours on Business Critical
- **Microsoft says** the Business Critical half is supported word for word, "up to several
  hours, potentially". The word "minutes" appears nowhere on the page. Separately, a single
  LRS job is cancelled automatically after 30 days, which we do not carry at all
- **Do** drop the General Purpose figure, keep the Business Critical wording, add the 30 day
  ceiling
- **Source** https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/log-replay-service-migrate
- **Size** 1 row plus 1 new line

### 2.3 Arc migration has one minimum source version, and it cannot

- **Where** `reference/decision-rules.md`, 7 Arc version rows
- **We say** a single floor
- **Microsoft says** three different ones. The overview page says SQL Server 2014. The LRS
  preparation page goes down to 2012 RTM. The MI Link preparation page requires 2016 SP3 with
  a matching Azure Connect pack and excludes everything before 2016. No Windows Server floor
  is stated anywhere in that documentation set
- **Do** split into three floors, one per method, and remove any Windows Server floor
- **Source** https://learn.microsoft.com/en-us/sql/sql-server/azure-arc/migration-overview
- **Size** 3 rows where there is 1

---

## 3. Citations that no longer prove what we use them for

The facts may still hold. The page no longer says so.

### 3.1 Azure Hybrid Benefit for SQL Server on Azure VM

- **Where** `docs/sql-server-to-azure-migration.md`, 5 mentions
- **Problem** the cited page now covers Azure SQL Database and Managed Instance only, and
  does not mention the VM case either way. Virtual machine eligibility moved to a separate
  page
- **Do** re-point the VM citation to
  https://learn.microsoft.com/en-us/azure/azure-sql/virtual-machines/windows/licensing-model-azure-hybrid-benefit-ahb-change
- **Size** 1 citation

### 3.2 Azure Data Studio replacements

- **Where** `docs/sql-server-to-azure-migration.md`, 11 mentions of SSMS 22
- **Problem** the retirement date of 28 February 2026 is exact. The replacement list is not.
  The page leads with Visual Studio Code and the MSSQL extension, which we do not cite at all.
  It never writes "SSMS 22", it scopes Arc to migration assessment, and it never names DMS
- **Do** put VS Code with the MSSQL extension first, drop the version number from SSMS, scope
  Arc to assessment
- **Source** https://learn.microsoft.com/en-us/sql/tools/whats-happening-azure-data-studio
- **Size** 1 row plus the mentions that repeat it

### 3.3 Data Migration Assistant replacements

- **Problem** the retirement date of 16 July 2025 is exact. The page names none of the three
  replacements we attribute to it, and its unretired body still recommends the migration
  extension inside the now retired Azure Data Studio. It is an archived page
- **Do** keep the date, source the replacements elsewhere, mark the page archived
- **Size** 1 citation

### 3.4 Cross-cloud sources for DMS

- **Problem** the cited page names Amazon RDS for SQL Server and nothing else. AWS EC2, GCP
  Compute Engine and GCP Cloud SQL do not appear on it. Those sources are enumerated on the
  LRS overview page instead
- **Do** re-point or remove. The same page is the source for finding 1.3, so one read answers
  both
- **Size** 1 citation

---

## 4. Housekeeping

- **Azure Migrate appliance memory** the VMware appliance is 32 GB RAM, 8 vCPU, around 80 GB
  disk, on Windows Server 2022 or 2025, and Windows Server 2016 or earlier is actively
  blocked by the onboarding script. The Hyper-V row is 16 GB. Check the prerequisite catalogue
  does not carry the Hyper-V figure for VMware. 2 lines to read
- **One moved anchor** a section heading moved at Microsoft, so a citation links correctly
  but no longer lands on the passage. The URL is in the `weekly-review` artifact of run
  34861988927, not in the issue body
- **Two links returning 403 or 429** classified unverified rather than healthy. Likely bot
  protection. Same artifact

---

## Release note

Findings 1.1, 1.2 and 1.4, and all of section 2, touch `reference/decision-rules.md`. Editing
that file forces the full coordinated release across every surface the README lists.

## Out of scope here

Blind behaviour evaluation. The current protocol shows the model the expected answer before
asking it to score itself, so it measures agreement rather than behaviour. Recorded so it is
not lost. Microsoft has an open pull request proposing an evaluation framework for migration
skills, which may cover it.
