---
name: get-connection-details
description: "Azure SQL connection failures and connection setup. Use when an app or tool cannot reach Azure SQL Database, Managed Instance, SQL Server on Azure VM or Fabric: connection timeouts, login errors 18456 or 40615, a connection that works from one network but not another, or which port, connection string, firewall or NSG rule to use. Prefer this over general debugging when the failure is a SQL connection."
allowed-tools: ask_user
---

# get-connection-details

Connection configuration and failure diagnosis for the Azure SQL family.

Facts carry a status. **VERIFIED** means a Microsoft page and a matching quote sit behind that exact
row. **DERIVED** means the page is cited but the row carries no quote of its own — say so rather
than presenting it as verified. **CONFLICT** and **OPEN** must be surfaced to the user, never
resolved silently. Ten source pages are re-checked weekly for drift; that is ten pages, not every
fact.

Knowledge base: [`docs/sql-server-to-azure-migration-connectivity.md`](../../docs/sql-server-to-azure-migration-connectivity.md) v0.7 ·
structured source: [`reference/connectivity-matrix.json`](reference/connectivity-matrix.json)

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
3. **What is the actual hostname you connect to?** Read from the portal, not composed. This is the
   single most common source of a wrong answer: the MI public endpoint inserts `.public.` and is a
   different host from the VNet-local one, and both Fabric hostnames must be read rather than built.
4. **Where does the client run?** Inside Azure, or outside. Under the `Default` connection policy
   this changes the required ports.
5. **Which authentication mode?** `entra-default` · `entra-interactive` · `entra-device-code` ·
   `entra-managed-identity-system` · `entra-managed-identity-user` · `entra-service-principal` ·
   `entra-integrated` · `windows-integrated` · `sql-authentication`
6. **Which driver or client, and which version?** `dotnet-sqlclient` · `jdbc` · `odbc` · `pyodbc` ·
   `go-mssqldb` · `sqlcmd` · `bcp` · `ssms`. The version decides whether a keyword exists at all,
   and for `sqlcmd` you also need to know whether it is the Go or the ODBC build.
7. **If diagnosing:** the exact error number, its state where available, and the message text.

**Ask these when they apply, because the answer changes without them:**

- **MI public endpoint** — is it enabled? It is off by default.
- **MI private endpoint** — is it in the *same* virtual network as the instance, or a different one?
  The DNS answer differs, and the same-VNet case is not researched here.
- **Azure SQL** — is `Public network access` enabled, and what minimum TLS version is set?
  Both refuse the connection before any port or DNS question matters.
- **SQL Server on Azure VM** — version and edition, and whether the VM is domain-joined. Entra needs
  SQL Server 2022 or later; Developer and Express images do not enable TCP/IP.
- **ODBC or interactive modes** — which client operating system. Several ODBC modes are Windows-only.
- **Managed identity** — system-assigned or user-assigned, and the client ID if user-assigned.

Skip any question the user has already answered, and skip the driver question when the user only
wants ports. When a needed answer is unavailable, say which part of the answer it blocks rather
than producing a value that looks complete.

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
> KB **v0.7** · endpoint and port VERIFIED · JDBC keyword VERIFIED
>
> The public endpoint is a **different hostname** from the VNet-local one — `.public.` is inserted —
> and it must be enabled on the instance. A string built for the VNet-local endpoint cannot reach it
> by changing networks: both the host and the port change.
>
> ```text
> jdbc:sqlserver://<mi-name>.public.<dns-zone>.database.windows.net:3342;databaseName=<database>;authentication=ActiveDirectoryManagedIdentity;encrypt=true;trustServerCertificate=false
> ```
>
> | | Requirement |
> | --- | --- |
> | Public endpoint | Must be **enabled** on the instance. It is off by default |
> | Hostname | `<mi-name>.public.<dns-zone>.database.windows.net` — read it from the portal, do not compose it |
> | Port | 3342 inbound, across the subnet range — the underlying address can change |
> | Connection type | Proxy, forced. The instance-level setting is ignored on this endpoint |
> | Driver | `ActiveDirectoryManagedIdentity` needs JDBC 12.2+; for a user-assigned identity add `msiClientId` |
> | Identity | The managed identity must exist **as a user inside the target database** |
> | Not usable for | Failover groups and Managed Instance link — client traffic only |
>
> **What will break it** — setting the instance connection type to Redirect. It is ignored here, so
> the change looks applied and does nothing.
>
> **Verify** — `Test-NetConnection <mi-name>.public.<dns-zone>.database.windows.net -Port 3342`.
> Success proves TCP reaches that port and nothing more; a failure does not by itself identify the
> NSG as the cause.

**Representative output — diagnosing a failure**

> **Error 18456 from one network only** · leading hypothesis **DNS override**
> KB **v0.7** · the DNS-override behaviour is VERIFIED; the attribution to this case is a hypothesis
>
> The gateway validates the FQDN it receives against the target server. A name pinned to a retired
> gateway address is rejected by design, and the rejection is reported as a login failure. The same
> cause produces **40532** and **40615**.
>
> | | |
> | --- | --- |
> | Hypothesis | A DNS override pins the server FQDN to a stale gateway address |
> | Evidence for | The credential works from other networks, and the failure is confined to one |
> | Discriminating test | Compare client resolution with authoritative DNS. A mismatch confirms it; a match rules it out |
> | If it is ruled out | Next candidates are a network-scoped firewall rule, a proxy or appliance rewriting the connection, and a client-side certificate or TLS policy |
>
> **Why the symptom misleads** — the error names authentication, so the natural next steps are
> resetting the secret and re-granting the user. Both are likely to find nothing here, but the
> credential is not *proven* correct until the discriminating test comes back.
>
> **Verify** — `Resolve-DnsName -Name "<server>.database.windows.net" -DnsOnly`, compared with
> authoritative DNS.

Examples use sanitised placeholders. Keep customer names, tenant details, server names and
subscription identifiers out of them.

**Diagnose in hypotheses, never in exonerations.** State the leading hypothesis, the evidence for
it, and the one test that would disprove it. A passing network check proves only what it tested: it
does not clear the credential, the firewall, DNS, a route table or an appliance in between.

**When a fact is missing, say so in the same card.** A row the knowledge base lists as open
research is reported as unknown with the page to read, never filled with a plausible value. An
invented connection keyword fails at runtime and costs more than an admitted gap.

## The traps this skill exists to catch

These are the failures that recur, and each is a fact a general-purpose answer usually gets wrong.

| Trap | What actually happens |
| --- | --- |
| **MI public endpoint is a different hostname and port** | `.public.` is inserted and the port is 3342. It is not the same string on another network, and the endpoint must be enabled |
| **MI redirect ports are disputed** | The connection-types page documents 1433 across the subnet; Microsoft's own Bicep and ARM quickstarts still create an 11000–11999 rule. Present both, recommend testing 1433 first, and never call opening a range harmless |
| **SQL Database redirect needs 1433 *and* 11000–11999** | Opening 1433 alone survives the handshake, then fails |
| **SQL Database private endpoint needs 1433–65535** | Not the public-endpoint range. Opening 11000–11999 there still fails |
| **`Default` policy changes with client location** | The same app has different firewall needs in Azure and on a laptop |
| **A private endpoint keeps the FQDN, but not always** | For MI, a private endpoint in the *same* VNet as the instance is a different case: the generic `privatelink` zone can disturb the instance. Ask for the topology first |
| **A pinned FQDN breaks when a gateway is retired** | Produces 18456 / 40532 / 40615, which all look like credential problems |
| **SqlClient 7.0 moved Entra out of the core package** | A failed connection whose cause is a missing NuGet package — unless the application supplies its own token, in which case the extension is not needed |
| **Fabric forbids SQL authentication** | On both Fabric surfaces. Eliminates a whole class of connection string |
| **`proxyOverride=Default` means opposite things** | Redirect if set after October 2025, Proxy if before |
| **Public network access and TLS gate the connection first** | Errors 47073 and 47072 fire before any port or DNS question matters |

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
