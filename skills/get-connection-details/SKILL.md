---
name: get-connection-details
description: Produce the exact connection string, ports, DNS and identity prerequisites for an Azure SQL family target, and diagnose a connection that is failing. Use when a developer asks how to connect an application to Azure SQL Database, Azure SQL Managed Instance, SQL Server on Azure VM, Fabric SQL database or Fabric Warehouse, when a connection fails with a login or timeout error, or when a connection works from one network and not another. Not for choosing a migration target or method.
---

# get-connection-details

> **Status: draft, v0.6.** This skill is under design. It is not registered in any plugin
> manifest, not covered by the test suite, and must not be presented to a user as ready.
> Its knowledge base is [`docs/sql-server-to-azure-migration-connectivity.md`](../../docs/sql-server-to-azure-migration-connectivity.md) v0.6.

## What this skill does

Two jobs that look like one, because the user rarely knows which of the two they have:

1. **Compose.** Given a target, a network path, an authentication mode and a client driver,
   produce the connection string, the ports that must be open, the DNS requirements and the
   identity prerequisites.
2. **Diagnose.** Given a failure — an error number, a timeout, or "it works from my laptop but not
   from the app service" — name the probable cause and the first thing to check.

It does not choose a migration target. That is `recommend-migration-path`. This skill picks up
where that one stops: *you are on Managed Instance — here is how you connect, and here is what to
open.*

## What this skill never does

- **Never emits a credential.** No password, key, SAS token or client secret, ever, including in
  examples. Use `<placeholder>` markers and point at managed identity or Key Vault.
- **Never invents a keyword.** Driver syntax differs per driver and is not inferable. If the
  knowledge base marks a value UNKNOWN, say so and name the page to read.
- **Never claims to have run a check it did not run.** Propose the command; report only what was
  actually executed.
- **Never guesses the Fabric SQL database FQDN.** Microsoft documents two conflicting forms; tell
  the user to read the portal's Connection strings pane.

## Why the output composes

Connectivity is not a rules graph. Each element of the answer depends on a small, independent
slice of the input:

| Output | Depends on |
| --- | --- |
| FQDN | target × network path |
| Port(s) | target × connection policy |
| Auth keyword | auth mode × driver |
| Network prerequisites | network path |
| Identity prerequisites | auth mode × target |

This is why the skill can be tested exhaustively, and why it does not need the ordered ranking
phases that `recommend-migration-path` requires.

## Interview

Ask one question at a time. Accept "I don't know" and carry it as unknown rather than defaulting.

1. **Which target?** `azure-sql-database` · `azure-sql-managed-instance` · `sql-server-on-azure-vm`
   · `fabric-sql-database` · `fabric-warehouse`
2. **Which network path?** `public-endpoint` · `private-endpoint` · `vnet-local` ·
   `service-endpoint`
3. **Where does the client run?** Inside Azure, or outside. This is not cosmetic: under the
   `Default` connection policy it changes the required ports.
4. **Which authentication mode?** `entra-default` · `entra-interactive` · `entra-device-code` ·
   `entra-managed-identity-system` · `entra-managed-identity-user` · `entra-service-principal` ·
   `entra-integrated` · `sql-authentication`
5. **Which driver or client?** `dotnet-sqlclient` · `jdbc` · `odbc` · `pyodbc` · `go-mssqldb` ·
   `sqlcmd` · `ssms`
6. **If diagnosing:** the exact error number and message text.

Skip any question the user has already answered, and skip the driver question when the user only
wants ports.

## Answer shape

One card, always in the same order, so a reader can find the port without reading prose:

1. **Verdict line** — the target, the endpoint and the port, stated before anything else.
2. **Connection string**, with placeholders, never secrets.
3. **A table of what must be true** — ports, DNS, identity — each row actionable as written.
4. **What will break it**, when a documented trap applies to this combination.
5. **A verification command**, so the answer is falsifiable in seconds.
6. **Knowledge-base version**, so the answer is reproducible and citable.

State the knowledge-base version in every card. A reader who cannot tell which facts answered
cannot judge how much to trust the advice, nor reproduce it later.

**Representative output — composing a connection**

> **Azure SQL Managed Instance** · public endpoint · **port 3342** · connection type **Proxy (forced)**
> KB **v0.6** · sourced and quoted
>
> The public endpoint does not listen on 1433. A string naming 1433 resolves the right server and
> times out, which is why this reads as a network fault rather than a configuration one.
>
> ```text
> Server = <mi-name>.public.<dns-zone>.database.windows.net,3342
> authentication=ActiveDirectoryManagedIdentity
> ```
>
> | | Requirement |
> | --- | --- |
> | Port | 3342 inbound, **across the entire subnet range** — never a single IP, it can change |
> | Connection type | Proxy, forced. The instance-level setting is ignored on this endpoint |
> | DNS | `<mi-name>.public.<dns-zone>.database.windows.net` — always the name, never the address |
> | Identity | The App Service managed identity must exist **as a user inside the database** |
> | Not usable for | Failover groups and Managed Instance link — client traffic only |
>
> **What will break it** — setting the instance connection type to Redirect. It is ignored here, so
> the change looks applied and does nothing.
>
> **Verify** — `Test-NetConnection <mi-name>.public.<dns-zone>.database.windows.net -Port 3342`

**Representative output — diagnosing a failure**

> **Error 18456 from one network only** · probable cause **DNS override**, not credentials
> KB **v0.6** · sourced and quoted
>
> The gateway validates the FQDN it receives against the target server. A name pinned to a retired
> gateway address is rejected by design, and the rejection is reported as a login failure. The same
> cause produces **40532** and **40615**.
>
> | | Check |
> | --- | --- |
> | First | `hosts` file, static CNAME, or a private DNS zone pinning the server FQDN |
> | Then | Client resolution against authoritative DNS — a mismatch confirms the override |
> | Not this | The credential. It is correct, which is why it works from every other network |
>
> **Why every instinct is wrong here** — the symptom names authentication, so the natural next
> steps are resetting the secret and re-granting the user. Both find nothing, because nothing is
> wrong with either.
>
> **Verify** — `Resolve-DnsName -Name "<server>.database.windows.net" -DnsOnly`, compared with
> authoritative DNS.

Examples use sanitised placeholders. Keep customer names, tenant details, server names and
subscription identifiers out of them.

**When a fact is missing, say so in the same card.** A row the knowledge base lists as open
research is reported as unknown with the page to read, never filled with a plausible value. An
invented connection keyword fails at runtime and costs more than an admitted gap.

## The traps this skill exists to catch

These are the failures that recur, and each is a fact a general-purpose answer usually gets wrong.

| Trap | What actually happens |
| --- | --- |
| **MI public endpoint is port 3342** | A client pointed at 1433 never connects |
| **MI redirect needs 1433 across the whole subnet range** | Not 11000–11999 — that belongs to Azure SQL Database redirect and to MI link |
| **SQL Database redirect needs 1433 *and* 11000–11999** | Opening 1433 alone survives the handshake, then fails |
| **`Default` policy changes with client location** | The same app has different firewall needs in Azure and on a laptop |
| **Private endpoint keeps the same FQDN** | Only DNS changes; resolving to the public address is the silent failure |
| **A pinned FQDN breaks when a gateway is retired** | Produces 18456 / 40532 / 40615, which all look like credential problems |
| **SqlClient 7.0 moved Entra out of the core package** | A failed connection whose cause is a missing NuGet package |
| **Fabric Warehouse forbids SQL authentication** | Eliminates a whole class of connection string |
| **`proxyOverride=Default` means opposite things** | Redirect if set after October 2025, Proxy if before |

## Verification

Where the environment allows, propose — and only then run — a check that makes the answer
falsifiable:

- reachability on the port the target actually uses,
- name resolution, and whether it returns a private or public address,
- a minimal login attempt.

If a tool is missing or the network is unavailable, say the check could not be run. Never report a
check that did not execute.

## Sources and contracts

All facts come from [`docs/sql-server-to-azure-migration-connectivity.md`](../../docs/sql-server-to-azure-migration-connectivity.md)
and its structured source [`reference/connectivity-matrix.json`](reference/connectivity-matrix.json).

The interview and the answer are governed by this skill's own contracts:

- [`reference/input-contract.md`](reference/input-contract.md) — the identifiers the interview may
  produce, the three absence markers, question order, and the combinations that are invalid rather
  than merely unusual.
- [`reference/output-contract.md`](reference/output-contract.md) — the two card shapes, the 13
  invariants checked before an answer is shown, the machine-readable form, and when to refuse.

These are **separate from** the `recommend-migration-path` contracts at the repository root. The
two skills share a repository and a plugin, not a vocabulary.

**Every stated fact carries a source and a matched quote.** That is the floor, not a guarantee: a
quote proves the cell it supports, not the whole row, not the scope of the claim. Three external
audits each found rows where that distinction had been lost — see §7.6 of the knowledge base.

Anything that could not be quoted is **not stated at all**. It appears in the open-research list
(§7.5), and the skill says it does not know rather than reasoning towards a plausible answer.

One fact is an open **conflict**: whether MI redirect requires 11000–11999 alongside 1433 (§7.1).
State both readings and the safe recommendation. The Fabric FQDNs (§7.2) are portal-derived and
must never be composed.

## Not yet built

Honest inventory of what this draft lacks, so nobody mistakes it for finished:

- No golden scenarios and no gate proving the skill *applies* the matrix. The existing gate proves
  the documents agree with each other, which is a weaker claim.
- Go and `pyodbc` syntax is missing: no page was retrieved, and it cannot be inferred from the ODBC
  or JDBC spelling.
- Fabric SQL database private-endpoint behaviour is unknown.
- No volatility-based review dates. Drift detection catches a page that *changes*; nothing catches
  a fact that has simply aged.
