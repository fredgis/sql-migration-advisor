---
title: "Migration constraints"
description: "The non-negotiable constraints the recommendation must satisfy: downtime window, data residency, compliance, operational continuity, and budget guidance."
author: "HVE-SQL demo"
ms.date: 2026-07-07
ms.topic: reference
---

## Timing

The platform end-of-support date is 2026-07-14. The recommendation and the plan must acknowledge that the window to migrate without paying for Extended Security Updates is short. A migration method that fits a single weekend maintenance window is strongly preferred.

## Downtime

The business can accept up to four hours of downtime during a Saturday night maintenance window. A method that keeps cutover downtime near zero is preferred, because it de-risks the weekend and leaves room for validation.

## Data residency and compliance

* All data must remain within the EU data boundary. The source runs in West Europe today, and an EU region such as France Central satisfies the requirement.
* The system holds customer personal data, so encryption at rest must be preserved and access must be controlled.
* Transparent Data Encryption is in use today and the equivalent protection must exist on the target.

## Operational continuity

* The nightly close and its schedule must keep working after migration.
* The messaging between the ordering and invoicing modules must keep working.
* Operational alerting must continue in some form.

These three requirements are the reason the target must support scheduled jobs, Service Broker, and mail. They are the strongest single input to the target decision.

## Networking

* The target must be reachable privately from the application tier. Public endpoints for the database are not acceptable.
* Connectivity to the on-premises ERP must be re-established for the nightly feed.

## Budget guidance

* The workload is steady and predictable, so reserved capacity is on the table.
* Software Assurance is in place, so Azure Hybrid Benefit should be applied and its saving shown explicitly.
* The recommendation should compare the ongoing cost against the avoided Extended Security Updates cost, so the business case is visible.

## Out of scope for the demo

* Application code changes beyond what the blockers strictly require.
* Migrating the on-premises ERP itself.
* Provisioning the production target. The demo plans, prices, and validates with what-if only.
