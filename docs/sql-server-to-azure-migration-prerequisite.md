# SQL Server to Azure migration prerequisite knowledge base

> **Version:** v1.0 | **Last verified:** 2026-08-13 | **Companion skill:** `generate-migration-prerequisite-plan`
> **Scope:** prerequisite planning for the 22 migration paths defined below

This knowledge base begins after a migration target and method have been selected. It converts that
selection into a sourced readiness plan. It does not select the destination, deploy resources,
change configuration, execute migration, remediate findings or certify production readiness.

## 1. How to apply this knowledge base

Apply:

1. every applicable requirement in **§3 Common prerequisites**;
2. the single selected path section in **§4–§25**;
3. only conditional rows whose applicability statement is true.

Runtime status is not stored in this document. The companion skill evaluates each stable
prerequisite ID as `confirmed`, `missing`, `unknown`, or `not_applicable`.

| Requirement type | Meaning |
| --- | --- |
| `required` | Must be satisfied for the selected path. |
| `conditional` | Required only when its applicability condition is true. |
| `recommended` | Reduces delivery risk but does not block readiness by itself. |

An item can be **blocking** even when conditional. `confirmed` requires a typed fact or verified
evidence record; free-text confidence statements are not evidence. Blank, declined, ambiguous and
unrecognized answers remain `unknown`.

## 2. Path catalog

| # | Path ID | Target | Method | Support label |
| ---: | --- | --- | --- | --- |
| 1 | P01 | SQL Server on Azure VM | Distributed Availability Group | Microsoft-supported |
| 2 | P02 | SQL Server on Azure VM | Always On Availability Group | Microsoft-supported |
| 3 | P03 | SQL Server on Azure VM | Log Shipping | Microsoft-supported |
| 4 | P04 | SQL Server on Azure VM | Native Backup/Restore | Microsoft-supported |
| 5 | P05 | SQL Server on Azure VM | Standalone Assessment then Native Backup/Restore | Microsoft-supported |
| 6 | P06 | SQL Server on Azure VM | Azure Migrate Replication | Microsoft-supported |
| 7 | P07 | Azure VMware Solution | VMware HCX / vMotion | Microsoft-supported |
| 8 | P08 | Azure SQL Managed Instance | Managed Instance Link | Microsoft-supported |
| 9 | P09 | Azure SQL Managed Instance | Log Replay Service | Microsoft-supported |
| 10 | P10 | Azure SQL Managed Instance | Native Backup/Restore | Microsoft-supported |
| 11 | P11 | Azure SQL Database | BACPAC / SqlPackage | Microsoft-supported |
| 12 | P12 | Azure SQL Database | Modern DMS Offline | Microsoft-supported |
| 13 | P13 | SQL MI / SQL DB / Fabric SQL DB | Transactional Replication | Microsoft-supported with target-specific limits |
| 14 | P14 | Azure SQL Database | Data Box Seed then Delta Synchronization | Composed pattern, not one migration service |
| 15 | P15 | Azure SQL Database | Striim Online CDC | Third-party migration runtime |
| 16 | P16 | SQL Database in Fabric | Fabric Migration Assistant | Preview tool; GA target |
| 17 | P17 | Arc-enabled SQL Managed Instance | Native Backup/Restore Direct | Microsoft-supported |
| 18 | P18 | Arc-enabled SQL Managed Instance | Native Backup/Restore after Endpoint Availability | Microsoft-supported |
| 19 | P19 | SQL Server Container | Backup/Restore through Mounted Volume | Microsoft-supported engine pattern |
| 20 | P20 | SQL MI / SQL DB | bcp | Microsoft-supported utility |
| 21 | P21 | SQL MI / SQL DB / Fabric SQL DB | Azure Data Factory Copy | Microsoft-supported |
| 22 | P22 | SQL MI / SQL DB | Smart Bulk Copy | Archived Azure sample; not a product or service |

## 3. Common prerequisites

| ID | Prerequisite | Type | Blocking | Owner | Applicability | Evidence required | Official source | Verified |
| --- | --- | --- | :---: | --- | --- | --- | --- | --- |
| COM-001 | Establish the exact source SQL Server version, build, edition, operating system and hosting location, and verify them against the selected path's support floor. | required | Yes | SQL platform owner | All paths | Sanitized inventory export and version/build query | [SQL Server migration overview](https://learn.microsoft.com/en-us/data-migration/sql-server/overview) | 2026-08-13 |
| COM-002 | Complete a database-feature and instance-object inventory, including blockers, logins, jobs, credentials, linked servers, server configuration, encryption and application dependencies. | required | Yes | Database architect | All paths | Assessment export plus signed exception list | [Create an Azure SQL assessment](https://learn.microsoft.com/en-us/azure/migrate/how-to-create-azure-sql-assessment) | 2026-08-13 |
| COM-003 | Confirm target subscription/workspace, region, service tier, compute, storage, database-count limits, HA design and capacity headroom. | required | Yes | Azure/Fabric platform owner | All Azure/Fabric targets | Approved sizing record and quota/capacity evidence | [Azure SQL deployment options](https://learn.microsoft.com/en-us/azure/azure-sql/azure-sql-iaas-vs-paas-what-is-overview) | 2026-08-13 |
| COM-004 | Assign least-privilege source, target, Azure, Fabric or Kubernetes roles required for assessment, configuration, copy, monitoring and cutover. | required | Yes | Security owner | All paths | Sanitized role assignment and database permission export | [Azure RBAC best practices](https://learn.microsoft.com/en-us/azure/role-based-access-control/best-practices) | 2026-08-13 |
| COM-005 | Validate end-to-end routing, DNS, firewall/NSG rules, proxies, TLS inspection and required service endpoints from the actual migration runtime. | required | Yes | Network owner | All paths with a remote source or target | Timestamped connectivity tests from each required hop | [Azure Architecture Framework — network security](https://learn.microsoft.com/en-us/azure/well-architected/security/networking) | 2026-08-13 |
| COM-006 | Inventory TDE, backup encryption, Always Encrypted and key dependencies; establish certificate/key custody and restore procedures before data movement. | conditional | Yes | Security and DBA owners | Encryption is enabled or encrypted backups are used | Certificate metadata, protected escrow reference and test-restore evidence; never include private keys | [SQL Server encryption](https://learn.microsoft.com/en-us/sql/relational-databases/security/encryption/sql-server-encryption) | 2026-08-13 |
| COM-007 | Capture a representative performance baseline, database size, backup throughput, network throughput and peak transaction/change rate for sizing and catch-up estimates. | required | Yes | Performance owner | All paths | Query Store/DMV baseline and measured transfer test | [Query Store best practices](https://learn.microsoft.com/en-us/sql/relational-databases/performance/best-practice-with-the-query-store) | 2026-08-13 |
| COM-008 | Agree measurable downtime, RPO, RTO, freeze window, final synchronization threshold and go/no-go authority. | required | Yes | Business and service owners | All paths | Approved cutover acceptance criteria | [Reliability in the Azure Well-Architected Framework](https://learn.microsoft.com/en-us/azure/well-architected/reliability/) | 2026-08-13 |
| COM-009 | Inventory connection strings, drivers, certificates, DNS aliases, jobs, integration endpoints and application owners; define the traffic-switch sequence. | required | Yes | Application owner | All paths | Sanitized dependency map and owner-approved switch plan | [Azure SQL connectivity troubleshooting](https://learn.microsoft.com/en-us/azure/azure-sql/database/troubleshoot-common-connectivity-issues) | 2026-08-13 |
| COM-010 | Define technical and business validation: row/object counts, checksums or samples, consistency, security, jobs, performance and application acceptance. | required | Yes | Test lead | All paths | Approved test plan, expected results and sign-off roles | [Monitor and tune SQL Server performance](https://learn.microsoft.com/en-us/sql/relational-databases/performance/monitor-and-tune-for-performance) | 2026-08-13 |
| COM-011 | Define the rollback method, last reversible point, data-divergence treatment, decision deadline, retention period and owner. | required | Yes | Migration lead | All paths | Rehearsed rollback runbook and signed decision matrix | [SQL Server backup and restore](https://learn.microsoft.com/en-us/sql/relational-databases/backup-restore/back-up-and-restore-of-sql-server-databases) | 2026-08-13 |
| COM-012 | Assign every missing or unknown prerequisite to an owner and retain a sanitized evidence register with collection date and source. | required | No | Migration PM | All paths | Action register and evidence index | [Operational Excellence checklist](https://learn.microsoft.com/en-us/azure/well-architected/operational-excellence/checklist) | 2026-08-13 |

## 4. P01 — SQL Server on Azure VM: Distributed Availability Group

Use when an existing on-premises AG will remain separate from a new Azure AG and the two AGs will
be joined by a distributed AG for migration.

| ID | Prerequisite | Type | Blocking | Owner | Applicability | Evidence required | Official source | Verified |
| --- | --- | --- | :---: | --- | --- | --- | --- | --- |
| P01-001 | Confirm an existing healthy source AG and SQL Server 2016 or later on replicas participating in the distributed AG; define forwarder and global primary roles. | required | Yes | DBA | P01 | Replica/build inventory and AG health query | [Migrate an availability group to Azure VMs](https://learn.microsoft.com/en-us/data-migration/sql-server/virtual-machines/availability-group-migrate) | 2026-08-13 |
| P01-002 | Provide compatible endpoint authentication: AD DS/domain trust or explicitly designed certificate-based endpoints for workgroup/cross-domain operation. | required | Yes | Identity and DBA owners | P01 | Domain/trust diagram or certificate endpoint configuration | [Availability group prerequisites and restrictions](https://learn.microsoft.com/en-us/sql/database-engine/availability-groups/windows/prereqs-restrictions-recommendations-always-on-availability) | 2026-08-13 |
| P01-003 | Open and test HADR endpoint traffic in both directions, listener/application traffic, DNS resolution and any Azure load-balancer or distributed network name path. | required | Yes | Network owner | P01 | Port tests and listener resolution from each replica/application zone | [Availability groups on Azure VMs](https://learn.microsoft.com/en-us/azure/azure-sql/virtual-machines/windows/availability-group-overview) | 2026-08-13 |
| P01-004 | Validate WSFC quorum, witness placement, node votes, failure domains and the behavior during WAN or site isolation. | required | Yes | Windows cluster owner | WSFC-based design | Cluster validation report and documented quorum model | [WSFC quorum modes and voting configuration](https://learn.microsoft.com/en-us/sql/sql-server/failover-clusters/windows/wsfc-quorum-modes-and-voting-configuration-sql-server) | 2026-08-13 |
| P01-005 | Seed the Azure AG, prove synchronization/catch-up at peak change rate, rehearse distributed-AG failover and define the final writable side and rollback boundary. | required | Yes | Migration lead | P01 | Rehearsal record, synchronization metrics and cutover runbook | [Distributed availability groups](https://learn.microsoft.com/en-us/sql/database-engine/availability-groups/windows/distributed-availability-groups) | 2026-08-13 |

## 5. P02 — SQL Server on Azure VM: Always On Availability Group

Use when Azure VM replicas are added to or replace replicas in one WSFC availability group.

| ID | Prerequisite | Type | Blocking | Owner | Applicability | Evidence required | Official source | Verified |
| --- | --- | --- | :---: | --- | --- | --- | --- | --- |
| P02-001 | Confirm SQL Server 2012 or later, edition/build compatibility, an existing healthy AG or an approved new-AG design, and compatible database state. | required | Yes | DBA | P02 | Replica/build inventory and AG health query | [Migrate an availability group to Azure VMs](https://learn.microsoft.com/en-us/data-migration/sql-server/virtual-machines/availability-group-migrate) | 2026-08-13 |
| P02-002 | Join replicas to the required AD DS/WSFC security boundary or document a supported certificate-based workgroup AG design. | required | Yes | Identity and cluster owners | P02 | Domain/cluster membership or endpoint-certificate design | [Availability group prerequisites and restrictions](https://learn.microsoft.com/en-us/sql/database-engine/availability-groups/windows/prereqs-restrictions-recommendations-always-on-availability) | 2026-08-13 |
| P02-003 | Configure and test HADR endpoints, listener name/IP, DNS, NSGs/firewalls and the selected Azure listener pattern. | required | Yes | Network and DBA owners | P02 | Listener resolution and connection tests from applications and replicas | [Configure an availability group listener on Azure VMs](https://learn.microsoft.com/en-us/azure/azure-sql/virtual-machines/windows/availability-group-listener-powershell-configure) | 2026-08-13 |
| P02-004 | Validate cluster quorum, witness, fault-domain placement and loss-of-site behavior before moving the primary. | required | Yes | Cluster owner | WSFC-based design | Cluster validation report and failover rehearsal | [WSFC quorum modes and voting configuration](https://learn.microsoft.com/en-us/sql/sql-server/failover-clusters/windows/wsfc-quorum-modes-and-voting-configuration-sql-server) | 2026-08-13 |
| P02-005 | Prove seeding, log-send/redo capacity, synchronization, planned failover, application reconnection and rollback to the prior primary. | required | Yes | Migration lead | P02 | Peak-load synchronization metrics and rehearsal evidence | [Always On availability groups overview](https://learn.microsoft.com/en-us/sql/database-engine/availability-groups/windows/overview-of-always-on-availability-groups-sql-server) | 2026-08-13 |

## 6. P03 — SQL Server on Azure VM: Log Shipping

| ID | Prerequisite | Type | Blocking | Owner | Applicability | Evidence required | Official source | Verified |
| --- | --- | --- | :---: | --- | --- | --- | --- | --- |
| P03-001 | Use a Windows SQL Server source database in the full or bulk-logged recovery model and a target SQL Server version equal to or later than the source. | required | Yes | DBA | P03 | Version/OS query and recovery-model query | [About log shipping](https://learn.microsoft.com/en-us/sql/database-engine/log-shipping/about-log-shipping-sql-server) | 2026-08-13 |
| P03-002 | Establish a restorable full backup and unbroken log-backup chain; prove restore order and choose `NORECOVERY` or `STANDBY` deliberately. | required | Yes | DBA | P03 | Backup history, `RESTORE VERIFYONLY`, restore rehearsal and gap check | [Configure log shipping](https://learn.microsoft.com/en-us/sql/database-engine/log-shipping/configure-log-shipping-sql-server) | 2026-08-13 |
| P03-003 | Configure SQL Server Agent, backup/copy/restore jobs, service-account access, secure transfer location, retention and threshold alerts. | required | Yes | DBA and security owners | P03 | Job schedules, ACL export and monitor-server alerts | [View a log shipping report](https://learn.microsoft.com/en-us/sql/database-engine/log-shipping/view-the-log-shipping-report-sql-server-management-studio) | 2026-08-13 |
| P03-004 | Restore the TDE certificate/private key or backup-encryption certificate on the Azure VM before the first encrypted database restore. | conditional | Yes | Security owner | Source database or backups are encrypted | Certificate metadata and successful encrypted test restore | [Move a TDE-protected database](https://learn.microsoft.com/en-us/sql/relational-databases/security/encryption/move-a-tde-protected-database-to-another-sql-server) | 2026-08-13 |
| P03-005 | Script final application stop, tail/log backup, final copy/restore, recovery, orphaned-user/login handling, validation and rollback before writes diverge. | required | Yes | Migration lead | P03 | Timed cutover and rollback rehearsal | [Fail over to a log shipping secondary](https://learn.microsoft.com/en-us/sql/database-engine/log-shipping/fail-over-to-a-log-shipping-secondary-sql-server) | 2026-08-13 |

## 7. P04 — SQL Server on Azure VM: Native Backup/Restore

| ID | Prerequisite | Type | Blocking | Owner | Applicability | Evidence required | Official source | Verified |
| --- | --- | --- | :---: | --- | --- | --- | --- | --- |
| P04-001 | Provision a target SQL Server version equal to or later than the source with compatible edition features, collation, storage layout and sufficient data/log/tempdb capacity. | required | Yes | SQL platform owner | P04 | Build/edition comparison and approved storage design | [SQL Server to Azure VM migration guide](https://learn.microsoft.com/en-us/data-migration/sql-server/virtual-machines/guide) | 2026-08-13 |
| P04-002 | Produce a complete valid backup set and prove it with checksum/verification plus a representative test restore; include differential/log backups when reducing downtime. | required | Yes | DBA | P04 | Backup headers, `RESTORE VERIFYONLY` and test-restore result | [Restore a database backup](https://learn.microsoft.com/en-us/sql/relational-databases/backup-restore/restore-a-database-backup-using-ssms) | 2026-08-13 |
| P04-003 | Select a supported transfer path and prove capacity and HTTPS reachability; for Backup to URL use the correct Blob type, credential/SAS model and striping limits for the source version. | required | Yes | DBA and network owners | Backup is transferred through Azure Storage | Measured transfer test and sanitized storage-access configuration | [SQL Server Backup to URL](https://learn.microsoft.com/en-us/sql/relational-databases/backup-restore/sql-server-backup-to-url) | 2026-08-13 |
| P04-004 | Import TDE and backup-encryption certificates/keys before restore and protect the key password outside the plan. | conditional | Yes | Security owner | TDE or encrypted backup | Successful encrypted test restore and protected escrow reference | [Move a TDE-protected database](https://learn.microsoft.com/en-us/sql/relational-databases/security/encryption/move-a-tde-protected-database-to-another-sql-server) | 2026-08-13 |
| P04-005 | Script file relocation, login/SID preservation, jobs, credentials, linked servers, database owner, compatibility level and application switch. | required | Yes | DBA and application owners | P04 | Migration scripts and validation output | [Manage metadata when making a database available elsewhere](https://learn.microsoft.com/en-us/sql/relational-databases/databases/manage-metadata-when-making-a-database-available-on-another-server) | 2026-08-13 |

## 8. P05 — SQL Server on Azure VM: Standalone Assessment then Native Backup/Restore

| ID | Prerequisite | Type | Blocking | Owner | Applicability | Evidence required | Official source | Verified |
| --- | --- | --- | :---: | --- | --- | --- | --- | --- |
| P05-001 | Run a current SQL assessment and inventory every database and instance object in scope before sizing or provisioning the VM. | required | Yes | Database architect | P05 | Assessment export with collection date | [Create an Azure SQL assessment](https://learn.microsoft.com/en-us/azure/migrate/how-to-create-azure-sql-assessment) | 2026-08-13 |
| P05-002 | Resolve assessment blockers, select the target SQL/Windows build and VM/storage design, and record accepted compatibility or performance risks. | required | Yes | Solution architect | P05 | Approved remediation/exception register and target design | [SQL Server to Azure VM migration guide](https://learn.microsoft.com/en-us/data-migration/sql-server/virtual-machines/guide) | 2026-08-13 |
| P05-003 | Create and prove the full/differential/log backup chain needed for the agreed outage and database count. | required | Yes | DBA | P05 | Backup history and test restore | [Backup and restore of SQL Server databases](https://learn.microsoft.com/en-us/sql/relational-databases/backup-restore/back-up-and-restore-of-sql-server-databases) | 2026-08-13 |
| P05-004 | Benchmark the selected file-copy or Backup-to-URL path and prove storage authentication and HTTPS/firewall access. | required | Yes | Network and DBA owners | P05 | Transfer benchmark and connection test | [SQL Server Backup to URL](https://learn.microsoft.com/en-us/sql/relational-databases/backup-restore/sql-server-backup-to-url) | 2026-08-13 |
| P05-005 | Include all assessed instance objects and compatibility findings in rehearsal, cutover, validation and rollback plans. | required | Yes | Migration lead | P05 | Rehearsal report tied to assessment findings | [Post-migration validation and optimization](https://learn.microsoft.com/en-us/data-migration/sql-server/virtual-machines/guide#post-migration) | 2026-08-13 |

## 9. P06 — SQL Server on Azure VM: Azure Migrate Replication

| ID | Prerequisite | Type | Blocking | Owner | Applicability | Evidence required | Official source | Verified |
| --- | --- | --- | :---: | --- | --- | --- | --- | --- |
| P06-001 | Match the source platform, guest OS, disk, boot, encryption and VM characteristics to the Azure Migrate support matrix for VMware, Hyper-V or physical/other. | required | Yes | Infrastructure owner | P06 | Platform inventory and support-matrix review | [Azure Migrate support matrix](https://learn.microsoft.com/en-us/azure/migrate/migrate-support-matrix) | 2026-08-13 |
| P06-002 | Create the Azure Migrate project and deploy/register a correctly sized appliance or replication components with healthy discovery and dependency data. | required | Yes | Azure migration engineer | P06 | Appliance health/export and discovered-machine record | [Azure Migrate appliance](https://learn.microsoft.com/en-us/azure/migrate/migrate-appliance) | 2026-08-13 |
| P06-003 | Provide documented source credentials, Azure RBAC, replication storage, required outbound URLs and source-to-Azure bandwidth. | required | Yes | Security and network owners | P06 | Sanitized permissions and connectivity/throughput tests | [Azure Migrate migration services](https://learn.microsoft.com/en-us/azure/migrate/migrate-services-overview) | 2026-08-13 |
| P06-004 | Approve VM sizing, disk mapping, availability design, target VNet/subnet, NSGs, DNS and any post-migration SQL licensing/management configuration. | required | Yes | Azure platform owner | P06 | Assessment recommendation and target design | [Assess servers for migration to Azure VMs](https://learn.microsoft.com/en-us/azure/migrate/tutorial-assess-vmware-azure-vm) | 2026-08-13 |
| P06-005 | Complete a test migration into an isolated test network and validate boot, SQL services, storage, application dependencies and cleanup. | required | Yes | Test lead | P06 | Successful test-migration report | [Test migrated VMware VMs](https://learn.microsoft.com/en-us/azure/migrate/tutorial-migrate-vmware#run-a-test-migration) | 2026-08-13 |
| P06-006 | Define final replication/cutover, source shutdown, IP/DNS changes, post-cutover agent cleanup and rollback/reprotect limits. | required | Yes | Migration lead | P06 | Timed cutover runbook and rollback decision point | [Migrate VMware VMs](https://learn.microsoft.com/en-us/azure/migrate/tutorial-migrate-vmware) | 2026-08-13 |

## 10. P07 — Azure VMware Solution: VMware HCX / vMotion

| ID | Prerequisite | Type | Blocking | Owner | Applicability | Evidence required | Official source | Verified |
| --- | --- | --- | :---: | --- | --- | --- | --- | --- |
| P07-001 | Deploy an AVS private cloud with approved region, host capacity, ExpressRoute connectivity, identity/DNS integration and routable workload networks. | required | Yes | AVS platform owner | P07 | AVS design and connectivity test | [Azure VMware Solution overview](https://learn.microsoft.com/en-us/azure/azure-vmware/introduction) | 2026-08-13 |
| P07-002 | Deploy and pair HCX Connector/Cloud Manager, create a healthy service mesh, network profiles, compute profiles and network extensions required by the selected HCX migration type. | required | Yes | VMware owner | P07 | HCX health export and service-mesh validation | [Configure VMware HCX](https://learn.microsoft.com/en-us/azure/azure-vmware/configure-vmware-hcx) | 2026-08-13 |
| P07-003 | Confirm vSphere/HCX compatibility, VMware Tools, VM hardware, disk, snapshot, affinity, MAC/IP-retention and encryption constraints for every SQL VM. | required | Yes | VMware owner | P07 | HCX readiness inventory and resolved exception list | [HCX migration considerations](https://learn.microsoft.com/en-us/azure/azure-vmware/architecture-migrate) | 2026-08-13 |
| P07-004 | Validate SQL licensing, AD/DNS, application latency, backup, monitoring and all north-south/east-west dependencies after relocation. | required | Yes | SQL and application owners | P07 | Dependency map and AVS performance test | [AVS network design considerations](https://learn.microsoft.com/en-us/azure/azure-vmware/architecture-network-design-considerations) | 2026-08-13 |
| P07-005 | Perform an HCX test migration or mobility rehearsal and verify SQL consistency, application access, throughput and rollback before production. | required | Yes | Test lead | P07 | Rehearsal report and defect closure | [AVS migration architecture with HCX](https://learn.microsoft.com/en-us/azure/azure-vmware/architecture-migrate) | 2026-08-13 |
| P07-006 | Define the HCX migration wave, final synchronization, DNS/routing switch, rollback eligibility and the point after which reverse migration is no longer safe. | required | Yes | Migration lead | P07 | Approved wave and rollback runbook | [Plan an AVS deployment](https://learn.microsoft.com/en-us/azure/azure-vmware/plan-private-cloud-deployment) | 2026-08-13 |

## 11. P08 — Azure SQL Managed Instance: Managed Instance Link

| ID | Prerequisite | Type | Blocking | Owner | Applicability | Evidence required | Official source | Verified |
| --- | --- | --- | :---: | --- | --- | --- | --- | --- |
| P08-001 | Meet the documented SQL Server version/build, edition and OS supportability for the required link direction; enable Always On availability groups. | required | Yes | DBA | P08 | Build/edition/OS export and HADR-enabled evidence | [Managed Instance link overview](https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/managed-instance-link-feature-overview) | 2026-08-13 |
| P08-002 | Provision SQL MI with a compatible service tier/update policy, sufficient storage/compute and supported database configuration. | required | Yes | Azure SQL owner | P08 | MI configuration, update-policy and sizing record | [Managed Instance update policy](https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/update-policy) | 2026-08-13 |
| P08-003 | Apply the documented SQL Server/MI/Azure permissions, required startup trace flags, certificates and Azure CA trust chain. | required | Yes | DBA and security owners | P08 | Sanitized role/permission export and certificate-chain validation | [Prepare for Managed Instance link](https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/managed-instance-link-preparation) | 2026-08-13 |
| P08-004 | Open and test the complete documented network set: MI subnet NSG and SQL host/corporate firewall rules for TCP 5022 and the MI HADR range 11000–11999 as applicable, with working DNS/routing. | required | Yes | Network owner | P08 | Bidirectional port tests and HADR-port query | [Managed Instance link network preparation](https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/managed-instance-link-preparation#network-ports-between-the-environments) | 2026-08-13 |
| P08-005 | Resolve database eligibility issues such as unsupported state/configuration, existing AG conflicts, encryption/key dependencies and non-default persistent-version-store placement. | required | Yes | DBA | P08 | Database preflight queries and resolved exception list | [Managed Instance link best practices](https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/managed-instance-link-best-practices) | 2026-08-13 |
| P08-006 | Confirm one-link-per-database design, link/database-count limits, MI capacity and enough log/redo throughput for peak change rate. | required | Yes | Database architect | P08 | Capacity calculation and peak-load link rehearsal | [Managed Instance resource limits](https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/resource-limits) | 2026-08-13 |
| P08-007 | Rehearse planned failover, application switch and the documented failback option; distinguish online link failback support from offline backup restore. | required | Yes | Migration lead | P08 | Timed failover/failback rehearsal | [Fail over Managed Instance link](https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/managed-instance-link-failover-how-to) | 2026-08-13 |

## 12. P09 — Azure SQL Managed Instance: Log Replay Service

| ID | Prerequisite | Type | Blocking | Owner | Applicability | Evidence required | Official source | Verified |
| --- | --- | --- | :---: | --- | --- | --- | --- | --- |
| P09-001 | Use a supported SQL Server 2008–2022 source database in the full recovery model. | required | Yes | DBA | Standalone LRS | Version and recovery-model query | [Log Replay Service migration](https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/log-replay-service-migrate) | 2026-08-13 |
| P09-002 | Produce an unbroken full/differential/log backup chain with unique names and chronological availability; prove restore validity before starting LRS. | required | Yes | DBA | P09 | Backup history, checksum/verification and test restore | [Log Replay Service migration](https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/log-replay-service-migrate) | 2026-08-13 |
| P09-003 | Prepare Azure Blob containers/layout and grant the documented Read/List-only SAS or managed-identity access without exposing write/delete privileges. | required | Yes | Storage and security owners | P09 | Sanitized container layout, role/SAS scope and Blob access test | [Migrate with LRS using managed identity](https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/log-replay-service-migrate#configure-security) | 2026-08-13 |
| P09-004 | Upload the TDE certificate before replaying a TDE-protected database. | conditional | Yes | Security owner | Source database uses TDE | Certificate upload evidence and encrypted restore preflight | [Migrate a TDE certificate to SQL MI](https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/tde-certificate-migrate) | 2026-08-13 |
| P09-005 | Fit initial load, continuous replay and cutover inside LRS's maximum 30-day migration-job window. | required | Yes | Migration lead | P09 | Throughput/change-rate estimate with contingency | [Log Replay Service limitations](https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/log-replay-service-migrate#limitations) | 2026-08-13 |
| P09-006 | Respect MI database limits and LRS concurrency limits; account for the target remaining unavailable in restoring state until cutover. | required | Yes | Azure SQL owner | P09 | Batch/concurrency plan and application acceptance | [Managed Instance resource limits](https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/resource-limits) | 2026-08-13 |
| P09-007 | For Business Critical, include post-cutover replica seeding that can take hours; keep the final backup small and monitor completion. | conditional | Yes | Azure SQL owner | Target tier is Business Critical | BC rehearsal timing and cutover plan | [Log Replay Service migration](https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/log-replay-service-migrate) | 2026-08-13 |
| P09-008 | Treat stopping LRS as destructive to the restoring target database; document restart-from-beginning and source-retention consequences. | required | Yes | Migration lead | P09 | Approved rollback decision matrix | [Stop LRS](https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/log-replay-service-migrate#stop-the-migration) | 2026-08-13 |

## 13. P10 — Azure SQL Managed Instance: Native Backup/Restore

| ID | Prerequisite | Type | Blocking | Owner | Applicability | Evidence required | Official source | Verified |
| --- | --- | --- | :---: | --- | --- | --- | --- | --- |
| P10-001 | Confirm native restore is supported for the source version/database and accept an offline migration with no source log replay after the selected backup set. | required | Yes | Database architect | P10 | Version support check and approved outage | [Restore a database to SQL MI](https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/restore-sample-database-quickstart) | 2026-08-13 |
| P10-002 | Create a valid `.bak` backup set with checksum/verification and a representative restore rehearsal. | required | Yes | DBA | P10 | Backup headers, verification and rehearsal result | [Copy-only backups](https://learn.microsoft.com/en-us/sql/relational-databases/backup-restore/copy-only-backups-sql-server) | 2026-08-13 |
| P10-003 | Confirm MI tier, storage, database-count and restore concurrency/capacity for the complete wave. | required | Yes | Azure SQL owner | P10 | Capacity and batching calculation | [Managed Instance resource limits](https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/resource-limits) | 2026-08-13 |
| P10-004 | Place backups in supported Azure Blob storage and prove the chosen SAS/credential, firewall and HTTPS access from the MI restore operation. | required | Yes | Storage and network owners | P10 | Sanitized storage configuration and test restore | [Restore a database to SQL MI](https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/restore-sample-database-quickstart) | 2026-08-13 |
| P10-005 | Upload the source TDE certificate to MI before restoring a TDE-protected database. | conditional | Yes | Security owner | TDE enabled | Certificate migration evidence and test restore | [Migrate a TDE certificate to SQL MI](https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/tde-certificate-migrate) | 2026-08-13 |
| P10-006 | Script instance-level objects because master/msdb are not migrated by restoring a user database. | required | Yes | DBA | P10 | Login/job/credential/server-object deployment and validation scripts | [T-SQL differences between SQL Server and SQL MI](https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/transact-sql-tsql-differences-sql-server) | 2026-08-13 |
| P10-007 | Define final-write stop, backup/upload/restore timing, validation, connection switch and source retention for rollback. | required | Yes | Migration lead | P10 | Timed rehearsal and rollback runbook | [SQL MI migration overview](https://learn.microsoft.com/en-us/data-migration/sql-server/managed-instance/overview) | 2026-08-13 |

## 14. P11 — Azure SQL Database: BACPAC / SqlPackage

| ID | Prerequisite | Type | Blocking | Owner | Applicability | Evidence required | Official source | Verified |
| --- | --- | --- | :---: | --- | --- | --- | --- | --- |
| P11-001 | Assess and remediate unsupported schema, instance-scoped dependencies, three-part names, security objects and data types before export/import. | required | Yes | Database developer | P11 | Compatibility assessment and successful schema deployment test | [Azure SQL Database migration overview](https://learn.microsoft.com/en-us/data-migration/sql-server/database/overview) | 2026-08-13 |
| P11-002 | Produce a transactionally consistent export by preventing writes or using a transactionally consistent copy; treat a live export without consistency control as unsafe. | required | Yes | DBA | P11 | Export procedure and consistency evidence | [Export a BACPAC with SqlPackage](https://learn.microsoft.com/en-us/sql/tools/sqlpackage/sqlpackage-export) | 2026-08-13 |
| P11-003 | Use a current supported SqlPackage version and a workstation/agent with sufficient local disk, memory and execution time; do not rely on portal import/export for large workloads without testing. | required | Yes | Migration engineer | P11 | Tool version and full-scale rehearsal metrics | [SqlPackage](https://learn.microsoft.com/en-us/sql/tools/sqlpackage/sqlpackage) | 2026-08-13 |
| P11-004 | Prove source/target authentication, Azure SQL firewall/private connectivity and Blob access when the BACPAC is staged in Azure Storage. | required | Yes | Network and security owners | P11 | Sanitized connection and Blob access tests | [Import a BACPAC to Azure SQL Database](https://learn.microsoft.com/en-us/azure/azure-sql/database/database-import) | 2026-08-13 |
| P11-005 | Create or select an empty target with sufficient service tier/storage and define how users, contained identities and application authentication will be recreated. | required | Yes | Azure SQL owner | P11 | Target configuration and identity deployment scripts | [Database import](https://learn.microsoft.com/en-us/azure/azure-sql/database/database-import) | 2026-08-13 |
| P11-006 | Rehearse export/import, reconcile schema/data, validate performance and record the source-retention rollback window. | required | Yes | Test lead | P11 | Rehearsal report and reconciliation output | [Import a BACPAC with SqlPackage](https://learn.microsoft.com/en-us/sql/tools/sqlpackage/sqlpackage-import) | 2026-08-13 |

## 15. P12 — Azure SQL Database: Modern DMS Offline

| ID | Prerequisite | Type | Blocking | Owner | Applicability | Evidence required | Official source | Verified |
| --- | --- | --- | :---: | --- | --- | --- | --- | --- |
| P12-001 | Complete Azure SQL Database assessment and schema migration/remediation before moving data; DMS data movement does not make instance-level features compatible. | required | Yes | Database architect | P12 | Assessment output and successful schema deployment | [Azure Database Migration Service overview](https://learn.microsoft.com/en-us/azure/dms/dms-overview) | 2026-08-13 |
| P12-002 | Use the current DMS portal/automation experience and prepare its required migration runtime, project and region; do not build on retired DMS classic SQL scenarios. | required | Yes | Azure migration engineer | P12 | DMS resource/project configuration and current-tool evidence | [Azure Database Migration Service overview](https://learn.microsoft.com/en-us/azure/dms/dms-overview) | 2026-08-13 |
| P12-003 | Grant the documented source SQL permissions, target Azure SQL permissions and Azure RBAC without embedding credentials in the migration artifact. | required | Yes | Security owner | P12 | Sanitized permission checks | [DMS prerequisites for SQL Server migrations](https://learn.microsoft.com/en-us/azure/dms/tutorial-sql-server-to-azure-sql) | 2026-08-13 |
| P12-004 | Validate source connectivity, target firewall/private connectivity, DNS, HTTPS/Azure service access and any required staging storage from the DMS runtime. | required | Yes | Network owner | P12 | Runtime-originated connectivity tests | [DMS network scenarios](https://learn.microsoft.com/en-us/azure/dms/resource-scenario-status) | 2026-08-13 |
| P12-005 | Reserve an offline window long enough to stop writes, run the complete data copy, reconcile and switch applications; DMS to Azure SQL Database is not an online cutover path. | required | Yes | Business owner | P12 | Approved outage and full-scale duration test | [Azure SQL Database migration overview](https://learn.microsoft.com/en-us/data-migration/sql-server/database/overview) | 2026-08-13 |
| P12-006 | Define migration monitoring, failed-table restart/retry, row reconciliation, target performance validation and source-retention rollback. | required | Yes | Migration lead | P12 | Rehearsal report and exception-handling runbook | [Migrate SQL Server to Azure SQL Database with DMS](https://learn.microsoft.com/en-us/data-migration/sql-server/database/database-migration-service) | 2026-08-13 |

## 16. P13 — SQL MI / SQL DB / Fabric SQL DB: Transactional Replication

| ID | Prerequisite | Type | Blocking | Owner | Applicability | Evidence required | Official source | Verified |
| --- | --- | --- | :---: | --- | --- | --- | --- | --- |
| P13-001 | Use a target-supported topology: Azure SQL Database and Fabric SQL database are push subscribers for snapshot/one-way transactional replication; peer-to-peer and merge are not supported there. | required | Yes | Replication architect | Target is SQL DB or Fabric SQL DB | Documented publisher/distributor/subscriber topology | [Replicate to Azure SQL Database](https://learn.microsoft.com/en-us/azure/azure-sql/database/replication-to-sql-database) | 2026-08-13 |
| P13-002 | Add or validate primary keys for every replicated table and resolve article-level key/filter requirements before snapshot generation. | required | Yes | Database developer | P13 | Table/key inventory and article script | [Replicate to Azure SQL Database](https://learn.microsoft.com/en-us/azure/azure-sql/database/replication-to-sql-database) | 2026-08-13 |
| P13-003 | Meet target-specific version rules: SQL Server 2016+ publisher for Azure SQL Database, SQL Server 2022 RTM CU12+ for Fabric SQL database, and the documented MI update-policy matrix for MI roles. | required | Yes | DBA | P13 | Publisher/distributor builds and MI update-policy evidence | [Transactional replication with SQL MI](https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/replication-transactional-overview) | 2026-08-13 |
| P13-004 | Configure SQL Agent, distributor database/storage, snapshot folder, agent identities, target logins and end-to-end network access. | required | Yes | DBA and network owners | P13 | Agent-profile, ACL and connectivity evidence | [Configure distribution](https://learn.microsoft.com/en-us/sql/relational-databases/replication/configure-distribution) | 2026-08-13 |
| P13-005 | Resolve target-incompatible data types, FILESTREAM/spatial/hierarchy conversions, partition/index behavior and schema changes before publication. | required | Yes | Database developer | P13 | Article compatibility test and exception register | [Replication to Azure SQL Database limitations](https://learn.microsoft.com/en-us/azure/azure-sql/database/replication-to-sql-database#limitations) | 2026-08-13 |
| P13-006 | Prove snapshot duration, replication latency and distribution retention at peak change rate; define final quiesce, drain-to-zero and subscription removal. | required | Yes | Migration lead | P13 | Replication Monitor evidence and cutover rehearsal | [Monitor replication](https://learn.microsoft.com/en-us/sql/relational-databases/replication/monitor/monitoring-replication) | 2026-08-13 |
| P13-007 | Keep a separately validated rollback path; replication direction does not reverse automatically after target writes begin. | required | Yes | Migration lead | P13 | Data-divergence and rollback procedure | [Replication administration best practices](https://learn.microsoft.com/en-us/sql/relational-databases/replication/administration/best-practices-for-replication-administration) | 2026-08-13 |

## 17. P14 — Azure SQL Database: Data Box Seed then Delta Synchronization

This is a **composed pattern**. Data Box transports files; it does not restore a SQL Server backup
into Azure SQL Database and does not supply CDC. The seed artifact and delta mechanism must each be
supported by their owning product.

| ID | Prerequisite | Type | Blocking | Owner | Applicability | Evidence required | Official source | Verified |
| --- | --- | --- | :---: | --- | --- | --- | --- | --- |
| P14-001 | Demonstrate that network transfer is impractical and define a SQL DB-compatible seed artifact such as BACPAC or bulk files; a `.bak` alone cannot be restored to Azure SQL Database. | required | Yes | Migration architect | P14 | Transfer model and seed-format proof | [Azure Data Box overview](https://learn.microsoft.com/en-us/azure/databox/data-box-overview) | 2026-08-13 |
| P14-002 | Deploy/remediate the target schema independently and prove that seed files preserve required types, keys, identities, constraints and load order. | required | Yes | Database developer | P14 | Schema deployment and seed-import rehearsal | [Azure SQL Database migration overview](https://learn.microsoft.com/en-us/data-migration/sql-server/database/overview) | 2026-08-13 |
| P14-003 | Order a Data Box option available in the target region, prepare the destination storage account, encryption/access, copy host, checksum validation, chain of custody and return logistics. | required | Yes | Storage owner | P14 | Order readiness checklist and checksum report | [Order Azure Data Box](https://learn.microsoft.com/en-us/azure/databox/data-box-deploy-ordered) | 2026-08-13 |
| P14-004 | Select and separately validate a supported delta mechanism, such as transactional replication or Striim CDC; define the seed-consistency point/LSN and do not treat Data Box as the delta service. | required | Yes | Data movement architect | P14 | Delta product design and seed-to-CDC continuity rehearsal | [Replicate to Azure SQL Database](https://learn.microsoft.com/en-us/azure/azure-sql/database/replication-to-sql-database) | 2026-08-13 |
| P14-005 | Size staging storage and import runtime, preserve immutable seed manifests, reconcile seed plus deltas, drain the delta stream and define rollback after target writes. | required | Yes | Migration lead | P14 | Full-scale rehearsal, manifest and cutover runbook | [Data Box copy and validate](https://learn.microsoft.com/en-us/azure/databox/data-box-deploy-copy-data) | 2026-08-13 |

## 18. P15 — Azure SQL Database: Striim Online CDC

Striim is third-party software. Microsoft sources define Azure SQL prerequisites; Striim's official
documentation defines the Striim runtime, SQL reader/writer and licensing requirements.

| ID | Prerequisite | Type | Blocking | Owner | Applicability | Evidence required | Official source | Verified |
| --- | --- | --- | :---: | --- | --- | --- | --- | --- |
| P15-001 | Approve Striim product/version, deployment model, license/support terms, runtime sizing and recovery/HA design. | required | Yes | Procurement and platform owners | P15 | License/support entitlement and approved architecture | [Running Striim in Azure](https://www.striim.com/docs/platform/en/running-striim-in-azure.html) | 2026-08-13 |
| P15-002 | Deploy and remediate the Azure SQL Database schema before data load; map unsupported source objects and SQL Server data types explicitly. | required | Yes | Database developer | P15 | Schema deployment and mapping test | [Striim Database Writer](https://www.striim.com/docs/en/database-writer.html) | 2026-08-13 |
| P15-003 | Prepare the Striim runtime, supported Java/OS/resources, JDBC driver, metadata/recovery storage and required service/network ports. | required | Yes | Striim platform owner | P15 | Runtime health, version, port and recovery configuration evidence | [Striim system requirements](https://www.striim.com/docs/platform/en/system-requirements.html) | 2026-08-13 |
| P15-004 | Configure the SQL Server reader prerequisites, CDC/transaction-log access, SQL Agent where required and least-privilege source account. | required | Yes | Source DBA | P15 | Reader preflight and CDC/log retention evidence | [Configure SQL Server for the MS SQL Reader](https://developer.striim.com/onlinedocs/en/configuring-sql-server-to-use-ms-sql-reader.html) | 2026-08-13 |
| P15-005 | Configure Azure SQL firewall/private connectivity, target identity/permissions and writer behavior for keys, missing tables, DDL, retries and duplicates. | required | Yes | Azure SQL and network owners | P15 | End-to-end connection and writer behavior test | [Azure SQL firewall configuration](https://learn.microsoft.com/en-us/azure/azure-sql/database/firewall-configure) | 2026-08-13 |
| P15-006 | Rehearse initial load to continuous CDC, preserve the required LSN, monitor lag/recovery, drain changes and validate exact cutover ordering. | required | Yes | Migration lead | P15 | Peak-load rehearsal and LSN/lag evidence | [Switch from initial load to continuous replication](https://developer.striim.com/onlinedocs/en/switching-from-initial-load-to-continuous-replication-of-sql-server-sources.html) | 2026-08-13 |
| P15-007 | Define product-specific incident escalation and an independent rollback/data-divergence plan before allowing target writes. | required | Yes | Service owner | P15 | Support contacts, recovery test and rollback runbook | [Build pipelines from SQL Server](https://developer.striim.com/onlinedocs/en/building-pipelines-from-sql-server.html) | 2026-08-13 |

## 19. P16 — SQL Database in Fabric: Fabric Migration Assistant

The **SQL database in Fabric target is GA**. The **Migration Assistant is Preview** and its preview
limits must not be generalized to every ingestion method supported by the target.

| ID | Prerequisite | Type | Blocking | Owner | Applicability | Evidence required | Official source | Verified |
| --- | --- | --- | :---: | --- | --- | --- | --- | --- |
| P16-001 | Confirm Fabric capacity, tenant/region availability and a workspace that supports creation of SQL database in Fabric. | required | Yes | Fabric capacity owner | P16 | Capacity/workspace configuration | [SQL database in Fabric overview](https://learn.microsoft.com/en-us/fabric/database/sql/overview) | 2026-08-13 |
| P16-002 | Assign the documented workspace role and source/target permissions needed to create the database, upload/deploy schema and run the copy job. | required | Yes | Fabric administrator | P16 | Sanitized workspace and database role export | [Fabric Migration Assistant](https://learn.microsoft.com/en-us/fabric/database/sql/migration-assistant) | 2026-08-13 |
| P16-003 | Deploy an on-premises data gateway for the assistant's on-prem source flow; VNet gateway and Private Link are not supported by this assistant path. | required | Yes | Network and Fabric owners | On-premises source through Migration Assistant | Gateway health and source connection test | [Fabric Migration Assistant](https://learn.microsoft.com/en-us/fabric/database/sql/migration-assistant) | 2026-08-13 |
| P16-004 | Generate a compatible DACPAC no larger than the assistant's documented 20 MB upload limit and resolve AI-assisted/manual schema issues before data copy. | required | Yes | Database developer | P16 | DACPAC size, deployment report and resolved issue list | [Migrate using a DACPAC](https://learn.microsoft.com/en-us/fabric/database/sql/migrate-with-migration-assistant-using-dacpac) | 2026-08-13 |
| P16-005 | Use Microsoft Entra authentication for the Fabric SQL target and update application identities/connection strings accordingly. | required | Yes | Identity and application owners | P16 | Entra login test and application connection rehearsal | [Connect to SQL database in Fabric](https://learn.microsoft.com/en-us/fabric/database/sql/connect) | 2026-08-13 |
| P16-006 | Rehearse schema deployment, copy-job throughput, reconciliation and application acceptance; define manual cleanup/rollback because the assistant has no documented automated rollback. | required | Yes | Migration lead | P16 | Rehearsal report and cleanup/rollback runbook | [Fabric Migration Assistant](https://learn.microsoft.com/en-us/fabric/database/sql/migration-assistant) | 2026-08-13 |

## 20. P17 — Arc-enabled SQL Managed Instance: Native Backup/Restore Direct

Direct means the backup is placed or downloaded through the Kubernetes pod/PVC or supported Blob
workflow without depending on a separately exposed client-facing SQL endpoint for transfer.

| ID | Prerequisite | Type | Blocking | Owner | Applicability | Evidence required | Official source | Verified |
| --- | --- | --- | :---: | --- | --- | --- | --- | --- | --- |
| P17-001 | Deploy a supported Kubernetes distribution/runtime and healthy Arc data controller/SQL MI; the container runtime must be `containerd`. | required | Yes | Kubernetes platform owner | P17 | Cluster/version/runtime and Arc health export | [Create Arc-enabled SQL Managed Instance](https://learn.microsoft.com/en-us/azure/azure-arc/data/create-sql-managed-instance) | 2026-08-13 |
| P17-002 | Use direct connectivity mode and satisfy its outbound Azure endpoints, extensions, identity and monitoring prerequisites; indirect mode is retired. | required | Yes | Arc platform owner | P17 | Connectivity mode and extension health | [Arc data connectivity](https://learn.microsoft.com/en-us/azure/azure-arc/data/connectivity) | 2026-08-13 |
| P17-003 | Configure the backup storage class at deployment with `ReadWriteMany` capability and sufficient PVC capacity; changing the backup storage class after deployment is unsupported. | required | Yes | Kubernetes storage owner | P17 | StorageClass/PVC YAML, RWX test and capacity record | [Arc data storage configuration](https://learn.microsoft.com/en-us/azure/azure-arc/data/storage-configuration) | 2026-08-13 |
| P17-004 | Produce and validate a SQL Server backup chain compatible with the target engine and place/download files through the documented `kubectl exec`, `kubectl cp` or Azure Blob workflow. | required | Yes | DBA | P17 | Backup verification and in-pod/PVC file manifest | [Migrate to Arc-enabled SQL MI](https://learn.microsoft.com/en-us/azure/azure-arc/data/migrate-to-managed-instance) | 2026-08-13 |
| P17-005 | Transfer TDE/backup-encryption material into the target SQL instance securely before restoring encrypted databases. | conditional | Yes | Security owner | TDE or encrypted backup | Successful encrypted restore rehearsal and protected escrow reference | [Migrate to Arc-enabled SQL MI](https://learn.microsoft.com/en-us/azure/azure-arc/data/migrate-to-managed-instance) | 2026-08-13 |
| P17-006 | Monitor restore/PVC consumption and validate the restored database, identities and application path; use Azure Monitor/Log Analytics rather than retired bundled Grafana/OpenSearch dashboards. | required | Yes | Operations owner | P17 | Restore output, monitoring signal and validation report | [Arc-enabled data services release notes](https://learn.microsoft.com/en-us/azure/azure-arc/data/release-notes) | 2026-08-13 |

## 21. P18 — Arc-enabled SQL Managed Instance: Native Backup/Restore after Endpoint Availability

Use this overlay when restore administration or validation depends on a client-facing Arc SQL MI
service endpoint that must first be stable and reachable.

| ID | Prerequisite | Type | Blocking | Owner | Applicability | Evidence required | Official source | Verified |
| --- | --- | --- | :---: | --- | --- | --- | --- | --- | --- |
| P18-001 | Deploy a supported Kubernetes distribution/runtime and healthy Arc data controller/SQL MI with `containerd`. | required | Yes | Kubernetes platform owner | P18 | Cluster/version/runtime and Arc health export | [Create Arc-enabled SQL Managed Instance](https://learn.microsoft.com/en-us/azure/azure-arc/data/create-sql-managed-instance) | 2026-08-13 |
| P18-002 | Use direct connectivity mode and validate required Azure outbound connectivity and extensions; indirect mode is retired. | required | Yes | Arc platform owner | P18 | Connectivity mode and extension health | [Arc data connectivity](https://learn.microsoft.com/en-us/azure/azure-arc/data/connectivity) | 2026-08-13 |
| P18-003 | Configure RWX backup storage and sufficient PVC capacity before deployment/restore. | required | Yes | Kubernetes storage owner | P18 | StorageClass/PVC YAML and capacity test | [Arc data storage configuration](https://learn.microsoft.com/en-us/azure/azure-arc/data/storage-configuration) | 2026-08-13 |
| P18-004 | Expose and test a stable SQL endpoint: prefer LoadBalancer or the Business Critical external AG-listener service where available; document NodePort address-change risk, DNS, TLS and network policy. | required | Yes | Network and Kubernetes owners | P18 | Service YAML, endpoint/DNS resolution and client TLS connection test | [Arc SQL MI high availability](https://learn.microsoft.com/en-us/azure/azure-arc/data/managed-instance-high-availability) | 2026-08-13 |
| P18-005 | Validate and transfer the backup chain and encryption material, then test restore through the approved endpoint/storage workflow. | required | Yes | DBA and security owners | P18 | Backup verification and endpoint-based restore rehearsal | [Migrate to Arc-enabled SQL MI](https://learn.microsoft.com/en-us/azure/azure-arc/data/migrate-to-managed-instance) | 2026-08-13 |
| P18-006 | Validate failover/reconnection, application DNS behavior, monitoring, cutover and endpoint rollback before production use. | required | Yes | Migration lead | P18 | Failover and reconnection rehearsal | [Arc SQL MI high availability](https://learn.microsoft.com/en-us/azure/azure-arc/data/managed-instance-high-availability) | 2026-08-13 |

## 22. P19 — SQL Server Container: Backup/Restore through Mounted Volume

| ID | Prerequisite | Type | Blocking | Owner | Applicability | Evidence required | Official source | Verified |
| --- | --- | --- | :---: | --- | --- | --- | --- | --- | --- |
| P19-001 | Select a supported Microsoft SQL Server Linux container image compatible with the source backup, pin the image tag and accept Linux/container feature differences. | required | Yes | Container and SQL owners | P19 | Image digest/tag, source version and compatibility assessment | [Deploy SQL Server Linux containers](https://learn.microsoft.com/en-us/sql/linux/sql-server-linux-docker-container-deployment) | 2026-08-13 |
| P19-002 | Mount persistent storage for `/var/opt/mssql` and a backup path with correct ownership, permissions, access mode, capacity and retention outside the container writable layer. | required | Yes | Container storage owner | P19 | Deployment/PVC/volume configuration and write test | [Configure SQL Server containers](https://learn.microsoft.com/en-us/sql/linux/sql-server-linux-docker-container-configure) | 2026-08-13 |
| P19-003 | Copy a verified backup set to the mounted volume and test `RESTORE FILELISTONLY` plus restore with explicit Linux target paths. | required | Yes | DBA | P19 | Backup verification, mounted-file manifest and restore rehearsal | [Restore a SQL Server database in a Linux container](https://learn.microsoft.com/en-us/sql/linux/tutorial-restore-backup-in-sql-server-container) | 2026-08-13 |
| P19-004 | Import TDE/backup-encryption certificates and master keys into the containerized instance before restore. | conditional | Yes | Security owner | TDE or encrypted backup | Successful encrypted restore rehearsal | [Move a TDE-protected database](https://learn.microsoft.com/en-us/sql/relational-databases/security/encryption/move-a-tde-protected-database-to-another-sql-server) | 2026-08-13 |
| P19-005 | Provide secrets through the platform's secret mechanism, expose only required ports, define resource limits/health checks and protect the persistent volume. | required | Yes | Container security owner | P19 | Sanitized secret reference, network policy and health-check evidence | [Secure SQL Server Linux containers](https://learn.microsoft.com/en-us/sql/linux/sql-server-linux-docker-container-security) | 2026-08-13 |
| P19-006 | Rehearse container replacement/restart with the mounted data, database recovery, application reconnection and rollback to the source. | required | Yes | Operations owner | P19 | Restart/recovery and cutover rehearsal | [Configure and customize SQL Server containers](https://learn.microsoft.com/en-us/sql/linux/sql-server-linux-docker-container-configure) | 2026-08-13 |

## 23. P20 — SQL MI / SQL DB: bcp

| ID | Prerequisite | Type | Blocking | Owner | Applicability | Evidence required | Official source | Verified |
| --- | --- | --- | :---: | --- | --- | --- | --- | --- | --- |
| P20-001 | Install a current `bcp`/ODBC toolchain on an approved copy host and record exact versions, architecture and authentication support. | required | Yes | Migration engineer | P20 | `bcp -v`, ODBC version and host build record | [bcp utility](https://learn.microsoft.com/en-us/sql/tools/bcp-utility) | 2026-08-13 |
| P20-002 | Create and validate the target schema first; define table order, keys, identities, constraints, triggers, computed columns, collations and type/format mappings. | required | Yes | Database developer | P20 | Target schema deployment and format-file/load rehearsal | [Use native or character format](https://learn.microsoft.com/en-us/sql/relational-databases/import-export/use-native-format-to-import-or-export-data-sql-server) | 2026-08-13 |
| P20-003 | Grant least-privilege source SELECT and target INSERT/bulk permissions and prove TLS, DNS, firewall/private connectivity and authentication from the copy host. | required | Yes | Security and network owners | P20 | Sanitized permissions and connection tests | [Azure SQL connectivity architecture](https://learn.microsoft.com/en-us/azure/azure-sql/database/connectivity-architecture) | 2026-08-13 |
| P20-004 | Benchmark batch size, packet size, parallelism, file layout, error files, encoding and transaction-log impact at production scale. | required | Yes | Performance owner | P20 | Full-scale benchmark and chosen command manifest without secrets | [Bulk import and export of data](https://learn.microsoft.com/en-us/sql/relational-databases/import-export/bulk-import-and-export-of-data-sql-server) | 2026-08-13 |
| P20-005 | Establish a consistency window, freeze or delta process; bcp is data movement, not continuous synchronization or schema migration. | required | Yes | Migration lead | P20 | Consistency/cutover design and rehearsal | [bcp utility](https://learn.microsoft.com/en-us/sql/tools/bcp-utility) | 2026-08-13 |
| P20-006 | Reconcile row counts, keys, aggregates and rejected rows; rebuild/enable objects in controlled order and retain source/export files for rollback. | required | Yes | Test lead | P20 | Reconciliation report and rollback manifest | [Bulk import data using bcp](https://learn.microsoft.com/en-us/sql/relational-databases/import-export/import-and-export-bulk-data-by-using-the-bcp-utility-sql-server) | 2026-08-13 |

## 24. P21 — SQL MI / SQL DB / Fabric SQL DB: Azure Data Factory Copy

| ID | Prerequisite | Type | Blocking | Owner | Applicability | Evidence required | Official source | Verified |
| --- | --- | --- | :---: | --- | --- | --- | --- | --- | --- |
| P21-001 | Select and deploy the correct integration runtime/gateway for source reachability: Azure IR, managed VNet/private endpoint, self-hosted IR or Fabric gateway as supported by the chosen connector. | required | Yes | Data integration owner | P21 | Runtime/gateway health and topology record | [Integration runtime concepts](https://learn.microsoft.com/en-us/azure/data-factory/concepts-integration-runtime) | 2026-08-13 |
| P21-002 | Configure source and target connections with least-privilege managed identity/service principal/SQL credentials and Key Vault or managed credential storage. | required | Yes | Security owner | P21 | Sanitized linked-connection tests and identity permissions | [Store ADF credentials in Key Vault](https://learn.microsoft.com/en-us/azure/data-factory/store-credentials-in-key-vault) | 2026-08-13 |
| P21-003 | Deploy and validate the target schema and explicit column/type mapping; define identity, key, constraint, trigger, computed-column and upsert behavior. | required | Yes | Database developer | P21 | Mapping document and successful representative copy | [Copy activity schema and type mapping](https://learn.microsoft.com/en-us/azure/data-factory/copy-activity-schema-and-type-mapping) | 2026-08-13 |
| P21-004 | Validate target-specific connector/network requirements for Azure SQL Database, SQL MI or Fabric SQL database, including firewall, private endpoint/VNet and MI endpoint choices. | required | Yes | Network owner | P21 | Runtime-originated connection tests | [Azure SQL Database connector](https://learn.microsoft.com/en-us/azure/data-factory/connector-azure-sql-database) | 2026-08-13 |
| P21-005 | Benchmark DIUs, parallel copy, partitioning, staging, batch write, source impact and target log/compute capacity with production-size data. | required | Yes | Performance owner | P21 | Full-scale copy metrics and approved tuning values | [Copy activity performance features](https://learn.microsoft.com/en-us/azure/data-factory/copy-activity-performance-features) | 2026-08-13 |
| P21-006 | Configure monitoring, retries, fault-tolerance policy, incompatible-row handling, session logs and data-consistency verification without silently skipping required data. | required | Yes | Operations owner | P21 | Monitoring alerts, retry test and session/reconciliation logs | [Copy activity data consistency](https://learn.microsoft.com/en-us/azure/data-factory/copy-activity-data-consistency) | 2026-08-13 |
| P21-007 | Define seed consistency, incremental/delta logic where needed, final drain, application switch and rollback; Copy Activity alone is not an automatic CDC cutover. | required | Yes | Migration lead | P21 | End-to-end pipeline rehearsal and cutover runbook | [Copy activity overview](https://learn.microsoft.com/en-us/azure/data-factory/copy-activity-overview) | 2026-08-13 |

## 25. P22 — SQL MI / SQL DB: Smart Bulk Copy

> [!CAUTION]
> Smart Bulk Copy is **not** an Azure migration service or supported product with an SLA. Its
> `Azure-Samples/smartbulkcopy` repository was archived read-only on **2026-06-15**, its former
> Microsoft Learn sample page no longer exists, and the published runtime depends on retired
> technology. Treat new use as an explicitly accepted field-tool risk, not a Microsoft support
> claim.

| ID | Prerequisite | Type | Blocking | Owner | Applicability | Evidence required | Official source | Verified |
| --- | --- | --- | :---: | --- | --- | --- | --- | --- | --- |
| P22-001 | Obtain explicit architecture/security acceptance for an archived sample; pin source commit/version and hashes, scan dependencies, define ownership, and prove a supportable build/runtime or choose another path. | required | Yes | Architecture and security owners | P22 | Signed risk acceptance, source hash, dependency scan and reproducible build | [Azure-Samples Smart Bulk Copy repository](https://github.com/Azure-Samples/smartbulkcopy) | 2026-08-13 |
| P22-002 | Create the target schema independently and validate keys, identities, constraints, triggers, temporal tables, columnstore and all required source data types; the sample is data-only. | required | Yes | Database developer | P22 | Schema deployment and type-coverage rehearsal | [Smart Bulk Copy FAQ](https://github.com/Azure-Samples/smartbulkcopy/blob/master/docs/FAQ.md) | 2026-08-13 |
| P22-003 | Use sanitized source/target connection configuration, supported authentication/TLS, least-privilege permissions and proven network reachability from the execution host. | required | Yes | Security and network owners | P22 | Connection tests and protected configuration reference | [Smart Bulk Copy configuration](https://github.com/Azure-Samples/smartbulkcopy/blob/master/docs/CONFIG.md) | 2026-08-13 |
| P22-004 | Design and benchmark partition keys, parallel readers/writers, batch size, table ordering and source/target resource impact; non-partitioned large tables require explicit strategy. | required | Yes | Performance owner | P22 | Production-scale benchmark and approved configuration | [Smart Bulk Copy README](https://github.com/Azure-Samples/smartbulkcopy/blob/master/README.md) | 2026-08-13 |
| P22-005 | Test every required data type and feature; treat undocumented or workaround-based behavior such as FILESTREAM, spatial/hierarchy conversions or large XML as unresolved until proven. | required | Yes | Test lead | P22 | Type/feature test matrix and reconciliation results | [Smart Bulk Copy FAQ](https://github.com/Azure-Samples/smartbulkcopy/blob/master/docs/FAQ.md) | 2026-08-13 |
| P22-006 | Define a write freeze or separately supported delta mechanism, capture errors/logs, reconcile all rows and keep a source/export rollback path. | required | Yes | Migration lead | P22 | End-to-end rehearsal, error review and rollback runbook | [Smart Bulk Copy repository](https://github.com/Azure-Samples/smartbulkcopy) | 2026-08-13 |

## 26. Knowledge-base integrity rules

The companion skill must reject or expose a policy-integrity failure when:

- a selected path is not one of P01–P22;
- a prerequisite lacks a stable ID, applicability, type, blocking flag, owner, evidence, public
  official source or verification date;
- an unknown is defaulted to confirmed or not applicable;
- a free-text claim is treated as verified evidence;
- a preview, third-party, composed pattern or archived sample is described as first-party GA
  service support;
- Markdown and JSON statuses differ;
- Smart Bulk Copy is described as an Azure service or supported product;
- Data Box is described as directly restoring SQL Server backups into Azure SQL Database;
- Fabric Migration Assistant limits are generalized to all Fabric SQL database ingestion paths;
- Arc-enabled SQL MI indirect connectivity or retired bundled dashboards are presented as current.

## 27. Maintenance policy

- Revalidate public sources and service limits before every release.
- Update `last verified` dates only after checking the linked primary source.
- Preserve prerequisite IDs; deprecate rather than renumber published IDs.
- Record product-status changes such as Preview/GA/retired/archived explicitly.
- Keep customer-specific evidence and identifiers out of this repository.
