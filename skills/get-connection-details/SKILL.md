---
name: get-connection-details
description: Produce the exact connection string, ports, DNS and identity prerequisites for an Azure SQL family target, and diagnose a connection that is failing. Use when a developer asks how to connect an application to Azure SQL Database, Azure SQL Managed Instance, SQL Server on Azure VM, Fabric SQL database or Fabric Warehouse, when a connection fails with a login or timeout error, or when a connection works from one network and not another. Not for choosing a migration target or method.
---

# get-connection-details

> **Status: draft, v0.1.** This skill is under design. It is not registered in any plugin
> manifest, not covered by the test suite, and must not be presented to a user as ready.
> Its knowledge base is [`docs/sql-server-to-azure-migration-connectivity.md`](../../docs/sql-server-to-azure-migration-connectivity.md) v0.1.

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

1. **Connection string**, with placeholders, never secrets.
2. **Ports that must be open**, stated as a firewall or NSG rule, not as a number in prose.
3. **DNS requirement**, including the private DNS zone when a private endpoint is in play.
4. **Identity prerequisites** — the Entra admin, the contained database user, the role assignment.
5. **A verification command the user can run**, so the answer is falsifiable.
6. **Confidence and source**, naming the knowledge-base section behind each claim.

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

## Sources

All facts come from [`docs/sql-server-to-azure-migration-connectivity.md`](../../docs/sql-server-to-azure-migration-connectivity.md)
and its structured source [`reference/connectivity-matrix.json`](reference/connectivity-matrix.json).

**Every stated fact is VERIFIED** — its supporting sentence was matched against the live Microsoft
page. There is no middle tier of confidence, because connectivity is a closed domain: a port is
3342 or it is not. Agreement between research runs was rejected as evidence, since two models
agreeing usually means one shared training bias.

Anything that could not be quoted is **not stated at all**. It appears in the knowledge base's
open-research list (§7.5), and the skill must say it does not know rather than reason towards a
plausible answer.

Open contradictions are in §7. The Fabric SQL database FQDN (§7.2) is unresolved and must be
surfaced to the user rather than decided.

## Not yet built

Honest inventory of what this draft lacks, so nobody mistakes it for finished:

- No input contract, no output contract.
- No golden scenarios, no CI gate, no entry in the plugin manifests. Nothing yet guarantees that
  the prose and the structured matrix agree.
- Go and `sqlcmd` syntax is missing and **blocking** for those clients: no page was retrieved, and
  it cannot be inferred from the ODBC or JDBC spelling.
- Fabric SQL database private-endpoint behaviour and SQL-authentication support are unknown.
