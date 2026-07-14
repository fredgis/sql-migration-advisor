---
title: "Legacy inventory: ContosoSales on SQL Server 2016"
description: "The technical inventory the SQL Migration Advisor reasons from: edition, size, features in use, and the dependencies that become migration blockers."
author: "HVE-SQL demo"
ms.date: 2026-07-07
ms.topic: reference
---

## Platform

| Attribute | Value |
| ----------- | ------- |
| Product | SQL Server 2016, Service Pack 2 |
| Edition | Standard |
| Host | Windows Server 2016 virtual machine |
| Licensing | Covered by Software Assurance (Azure Hybrid Benefit eligible) |
| Encryption | Transparent Data Encryption enabled with a server certificate |
| Databases | `ContosoSales` (primary), `ContosoArchive` (history) |
| Compatibility level | 120 |
| Collation | `SQL_Latin1_General_CP1_CI_AS` |
| Approximate data size | About 90 GB across both databases |

## Features in active use

These features are exercised by the application every day. They rule out a lightweight, fully managed target like Azure SQL Database, which does not support them or supports them only partially. Combined with the hard blockers below, they steer the target toward SQL Server on an Azure VM, where every one keeps working unchanged.

* SQL Agent jobs. A nightly close job runs stored procedures and an export step on a schedule.
* Service Broker. Messages pass between the ordering and invoicing modules through a queue and service.
* Cross-database queries. Reporting procedures in `ContosoSales` join to tables in `ContosoArchive` using three-part names.
* Database Mail. Operational alerts are sent from a stored procedure when the nightly close fails.

## Dependencies that become blockers

These are real dependencies of the current system. On a managed target each would need remediation; on a SQL Server VM most keep working, which is exactly what decides the target.

* `xp_cmdshell`. The nightly close calls `xp_cmdshell` to move an export file to a network share. It is unsupported on both Azure SQL Database and Managed Instance, so a managed target would force it to be replaced. On a SQL Server VM it runs as-is.
* FILESTREAM. Scanned invoice images are stored with FILESTREAM. It is unsupported on Azure SQL Database and Managed Instance, so a managed target would push the data into a different store, application rework the constraints rule out. On a SQL Server VM it stays on local NTFS unchanged.
* CLR assembly. A signed assembly computes regional tax. It runs on a SQL Server VM without the Managed Instance restrictions, so it needs no change.
* Linked server. A linked server reaches the on-premises ERP for a nightly product feed. Connectivity and the linked server definition must be re-established from Azure.

## Objects present in this repository

The SQL under `../source-env/sql` builds a faithful subset of the above so a tool or a reviewer can inspect real objects:

* Deprecated data types (`text`, `ntext`, `image`) on legacy columns.
* A cross-database view and procedure spanning `ContosoSales` and `ContosoArchive`.
* Service Broker enabled with a queue and service.
* A SQL Agent job for the nightly close.
* A stored procedure that references `xp_cmdshell`.
* A stored procedure that sends mail through `sp_send_dbmail`.

FILESTREAM, the CLR assembly, and the linked server are documented here rather than physically created, because they require instance-level configuration or external systems that a portable demo should not assume. The advisor treats them as stated dependencies, which is exactly how a real interview would capture them.
