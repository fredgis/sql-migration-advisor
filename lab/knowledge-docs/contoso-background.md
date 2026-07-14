---
title: "Contoso Distribution background"
description: "Business context for the ContosoSales workload: what the company does, what the system does, and why the migration is happening now."
author: "HVE-SQL demo"
ms.date: 2026-07-07
ms.topic: concept
---

## The company

Contoso Distribution is a regional wholesaler supplying independent retailers across Western Europe. It carries roughly twelve thousand active product lines and processes several thousand orders a day at peak. The business runs lean, with a small IT team that keeps a handful of line-of-business systems alive.

## The system

`ContosoSales` is the order and invoicing system. It captures orders, prices them against customer-specific contracts, manages stock reservations, and produces invoices. A companion database, `ContosoArchive`, holds closed orders older than eighteen months and is queried directly by reporting procedures in `ContosoSales`.

The system has grown by accretion. Over the years the team added a nightly close job, a messaging layer between the ordering and invoicing modules, a tax calculation component, and a feed to the on-premises ERP. Each addition solved a real problem, and each one now shows up as a migration consideration.

## Why now

The workload runs on SQL Server 2016 on a Windows virtual machine that is out of hardware warranty. The trigger is the platform end-of-support date: extended support for SQL Server 2016 ends on 2026-07-14. After that date the workload runs without security updates unless the company buys Extended Security Updates, which is a recurring cost with no modernization benefit.

Leadership has asked for a plan that moves the workload to Azure, keeps downtime inside a single weekend maintenance window, preserves the operational behaviour the business depends on, and comes with a credible monthly price. The team is comfortable with a managed platform as long as the existing scheduled jobs and messaging keep working.

## What the team values in a recommendation

* A target that keeps the existing operational features working with the least rework.
* An honest list of what will break, each with a way to fix it.
* A migration method that fits the weekend window.
* A price that reflects the licensing they already own.
