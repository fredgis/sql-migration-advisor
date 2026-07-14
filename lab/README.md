# HVE Squad hands-on lab — migrate ContosoSales to Azure (VM to VM)

A complete, self-contained hands-on lab: take a legacy SQL Server 2016 workload
(`ContosoSales`) from a freshly deployed source VM, through the SQL Migration
Advisor interview, to a **SQL Server on Azure VM** target — a lift-and-shift
**VM-to-VM** migration driven step by step by the HVE Squad and the full HVE
framework (Research-Plan-Implement-Review spine, council, human gates, scribe,
durable memory).

## Start here

**[docs/04-lab-vm-to-vm.md](docs/04-lab-vm-to-vm.md)** — the full guided lab,
Module 0 through Module 7.

## Prerequisites (quick view)

* Windows with **PowerShell 7+**, **VS Code** + **GitHub Copilot** (agent mode enabled), **Git**, and the **APM CLI** ([microsoft/apm](https://github.com/microsoft/apm), open source — install it with `irm https://aka.ms/apm-windows | iex`).
* **Azure CLI** (`az`) with Bicep support, `az login` completed, and Owner or Contributor on a subscription.

> [!IMPORTANT]
> Clone and run this lab from a plain local path such as `C:\labs`, not a file-sync folder like OneDrive or Dropbox, which can lock files while `apm install` writes.

## What's in this folder

| Path | Purpose |
| --- | --- |
| [docs/04-lab-vm-to-vm.md](docs/04-lab-vm-to-vm.md) | The guided lab (the entry point). |
| [source-env/](source-env/) | Bicep, PowerShell, and SQL that stand up and seed the legacy SQL Server 2016 source (Module 1). |
| [knowledge-docs/](knowledge-docs/) | The inventory and constraints the advisor reads to reason about the target (Modules 2-3). |
| [copilot/coding-agent-task.md](copilot/coding-agent-task.md) | Optional cloud coding-agent variant (Module 7). |
| [apm.yml](apm.yml) / `apm.lock.yaml` | Installs the HVE Squad (pinned to `v0.8.23`) via `apm install`. |

## First commands

```powershell
cd <path-to-this-lab-folder>
az login
apm install
curl https://api.ipify.org   # note your public IP for the source deploy
```

Then follow [docs/04-lab-vm-to-vm.md](docs/04-lab-vm-to-vm.md) from Module 0.
