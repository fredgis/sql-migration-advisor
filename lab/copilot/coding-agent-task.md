---
title: "Cloud coding-agent task"
description: "A ready-to-assign GitHub issue body that hands the migration planning to the GitHub Copilot coding agent with the same guardrails as the interactive run."
author: "HVE-SQL demo"
ms.date: 2026-07-07
ms.topic: how-to
---

## How to use this

Push this repository to GitHub, create a new issue, paste the title and body below, and assign the issue to the GitHub Copilot coding agent. The agent works in the cloud and returns a pull request. Review that pull request as the closing beat of the demo.

Everything below the divider is the issue content.

---

## Issue title

Plan the ContosoSales SQL Server 2016 to Azure migration (advisory plus target IaC, no deploy)

## Issue body

Use the HVE Squad and its SQL Migration Advisor to plan the migration of the `ContosoSales` SQL Server 2016 database to Azure. Extended support for SQL Server 2016 ends on 2026-07-14, so treat this as time-sensitive. Work only inside this repository and open a pull request with your results.

### Context to read first

* `knowledge-docs/contoso-background.md` for the business situation.
* `knowledge-docs/legacy-inventory.md` for the platform, features, and dependencies.
* `knowledge-docs/migration-constraints.md` for downtime, residency, and budget constraints.
* `source-env/sql/` for the actual database objects.

### Deliverables

1. A recommendation card that names the target Azure service, the migration method, the downtime class, the blockers each paired with a remediation, and the cost levers. Cite Microsoft Learn and do not recommend any retired tool.
2. An indicative monthly cost for the recommended target, showing the price with and without Azure Hybrid Benefit.
3. An HLD and an LLD for the target, aligned to landing-zone patterns.
4. Target infrastructure as code under `target-env/infra/bicep`, authored from the LLD, using Azure Verified Modules where available.
5. A short migration runbook that sequences the cutover inside a single weekend window.

### Guardrails

* Do not deploy anything. Do not perform any impactful action against any Azure subscription.
* If a validation step is possible, limit it to a what-if or a static build. Do not create resources.
* Keep all changes inside this repository and summarize them in the pull request description.
* If you find an unremediated blocker that would make the target non-viable, stop and escalate in the pull request rather than working around it silently.

### Definition of done

* The pull request contains the recommendation card, the cost estimate, the HLD and LLD, the target Bicep, and the runbook.
* The Bicep builds cleanly.
* No Azure resources were created.
