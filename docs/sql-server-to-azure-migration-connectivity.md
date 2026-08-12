# SQL Server to Azure — connectivity knowledge base

> **Version.** v0.1 — 12 August 2026. Draft. This document is **not** wired into the
> `recommend-migration-path` skill and does not change any of its facts.
>
> **Scope.** How an application connects to an Azure SQL family target, and why a connection
> fails. It deliberately excludes migration methods, tuning, pricing and licensing, which live in
> [`sql-server-to-azure-migration.md`](sql-server-to-azure-migration.md).
>
> **Provenance.** Built from six independent research runs against learn.microsoft.com, merged and
> cross-checked. Where the runs disagreed, the disagreement is recorded in §7 rather than averaged
> away. Rows marked **VERIFIED** were re-fetched and matched against the live page during the
> merge; rows marked **CONSENSUS** were reported identically by two or more independent runs but
> not individually re-fetched.

---

## 1. Why this document exists

The migration advisor answers *where should this estate go*. It stops at the recommendation.

The question that immediately follows — *how do I actually connect to it, and why is it refusing
me* — is a different problem with a different shape. Migration rules interact: size changes the
target, which changes the eligible methods, which reopens the network question. Connectivity
does not interact in that way. It **composes**:

| Output element | Determined by |
| --- | --- |
| FQDN | target × network path |
| Port(s) | target × connection policy |
| Auth keyword | auth mode × driver |
| Network prerequisites | network path |
| Identity prerequisites | auth mode × target |

Five small tables that compose, rather than a graph of rules that influence one another. That is
why this knowledge base is short, and why its facts can be enumerated and tested exhaustively.

---

## 2. Endpoint shape by target

### 2.1 Azure SQL Database

| Property | Value | Status |
| --- | --- | --- |
| FQDN | `<server>.database.windows.net` | VERIFIED |
| Port | 1433 | VERIFIED |
| Connection policy | `Redirect` \| `Proxy` \| `Default` | VERIFIED |

> "Clients connect to the gateway that has a public IP address and listens on port 1433."
> — [Connectivity architecture](https://learn.microsoft.com/en-us/azure/azure-sql/database/connectivity-architecture)

**The port set depends on the policy, and this is the most common cause of a connection that works
from one network and not another.**

- **Redirect** needs *both*: outbound **11000–11999** to all Azure SQL IPs in the region, **and**
  outbound **1433** to the gateway. Opening 1433 alone appears to work during the handshake and
  then fails.

  > "Allow outbound communication from the client to all Azure SQL IP addresses in the region on
  > ports in the range of 11000 to 11999."

- **Proxy** needs only outbound **1433** to the gateway IP ranges.

- **Default** is `Redirect` for clients inside Azure and `Proxy` for clients outside. A client's
  location therefore silently changes its firewall requirements.

  > "`Redirect` for all client connections originating inside of Azure (for example, from an Azure
  > Virtual Machine)." / "`Proxy` for all client connections originating outside (for example,
  > connections from your local workstation)."

**Dedicated administrator connection** needs TCP **1434** and **14000–14999**, and only for that
purpose.

> "Open TCP ports 1434 and 14000-14999 to enable Connecting with DAC."

### 2.2 Azure SQL Managed Instance

Managed Instance has **three endpoints with three different behaviours**, and conflating them is
the single most frequent MI connectivity mistake.

| Endpoint | FQDN | Port | Connection type | Status |
| --- | --- | --- | --- | --- |
| VNet-local (default) | `<mi_name>.<dns_zone>.database.windows.net` | **1433** | redirect (default since Oct 2025) or proxy | VERIFIED |
| Public | `<mi_name>.public.<dns_zone>.database.windows.net` | **3342** | Proxy, forced | VERIFIED |
| Private endpoint | same as VNet-local unless configured otherwise | **1433** | Proxy, forced | VERIFIED |

> "The VNet-local endpoint accepts connections on port 1433."
> "Public endpoint accepts connections on port 3342."
> "Public endpoint always uses the Proxy connection type regardless of the connection type setting."
> "Private endpoints always use the Proxy connection type regardless of the connection type setting."
> — [Connectivity architecture for MI](https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/connectivity-architecture-overview)

**Port 3342 is not a typo and not optional.** A client pointed at the public endpoint on 1433 will
never connect.

**MI redirect requires 1433 across the whole subnet range — not 11000–11999.**

> "Traffic from your SQL clients to the SQL managed instance must be permitted on port 1433 across
> the instance's subnet address range."
> — [Connection types](https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/connection-types-overview) — VERIFIED

This contradicts widely repeated guidance, including one of the research runs behind this
document. See §7.1: the 11000–11999 range belongs to **Azure SQL Database** redirect and to MI
**link/replication**, not to MI client connectivity.

Redirect also requires a client driver implementing **TDS 7.4 or newer**; older clients silently
fall back to proxy rather than failing.

> "The benefits of the redirect connection type are only available for SQL clients that support TDS
> version 7.4 or newer, which was released with SQL Server 2012."

**Always allow the whole subnet range, never a single IP**, on any MI endpoint.

> "always use its domain name and allow inbound traffic on the required ports across the entire
> subnet range, as the underlying IP address can occasionally change."

The public endpoint carries client traffic only.

> "Public endpoints only carry client traffic and can't be used for data replication between two
> instances, such as failover groups or Managed Instance link."

### 2.3 SQL Server on Azure VM

| Property | Value | Status |
| --- | --- | --- |
| FQDN with a public DNS label | `<dns-label>.<region>.cloudapp.azure.com` | CONSENSUS (2 runs) |
| Port, default instance | 1433 | CONSENSUS |
| Connection policy | Not applicable — no gateway, no Redirect/Proxy concept | CONSENSUS |

This is an IaaS target: the connection reaches the guest operating system, so the SQL Server
configuration, the Windows firewall and the NSG all apply, and none of the PaaS gateway behaviour
does. Named instances and non-default ports behave exactly as they do on-premises.

### 2.4 Fabric SQL database

| Property | Value | Status |
| --- | --- | --- |
| Connection policy | `Default` only, cannot be changed | VERIFIED |
| FQDN | **Contradictory in Microsoft's own documentation** — see §7.2 | — |

> "Currently, the only supported connection policy for SQL database in Microsoft Fabric is
> **Default**." — [Connect to your SQL database](https://learn.microsoft.com/en-us/fabric/database/sql/connect)

Because `Default` means Redirect inside Azure and Proxy outside, a Fabric SQL database client
running inside Azure inherits the 11000–11999 requirement **and cannot opt out of it**. This
follows from combining two documented facts; it is not stated in one place. Treat as inferred.

### 2.5 Fabric Warehouse

| Property | Value | Status |
| --- | --- | --- |
| FQDN | `<server-unique-identifier>.<tenant>.fabric.microsoft.com` | VERIFIED |
| Port | 1433 | VERIFIED |

> "The SQL connection string requires TCP port 1433 to be open. TCP 1433 is the standard SQL Server
> port number." — [Warehouse connectivity](https://learn.microsoft.com/en-us/fabric/data-warehouse/connectivity)

Firewall clearance cannot be done by hostname.

> "You can't use the Fully Qualified Domain Name (FQDN) of the TDS Endpoint alone."

---

## 3. Authentication

### 3.1 What each target accepts

| Target | Entra | SQL authentication | Status |
| --- | --- | --- | --- |
| Azure SQL Database | supported | supported | VERIFIED |
| Azure SQL Managed Instance | supported | supported | VERIFIED |
| SQL Server on Azure VM | supported when Entra is configured | supported | CONSENSUS |
| Fabric SQL database | supported | **UNKNOWN — do not assume** | — |
| Fabric Warehouse | user principals and service principals only | **not supported** | VERIFIED |

> "SQL Authentication isn't supported." — [Warehouse connectivity](https://learn.microsoft.com/en-us/fabric/data-warehouse/connectivity) — VERIFIED

Fabric Warehouse's prohibition eliminates an entire class of connection string, and it is the
first thing to check when a Warehouse connection fails with a credential error. **Do not
generalise it to Fabric SQL database**: the Fabric SQL database documentation is silent on the
point, and silence is not a prohibition.

### 3.2 The prerequisite everyone forgets

An Entra principal that can sign in to Azure still cannot open a database it has no user in.
Creating the contained user is a separate, explicit step, and its absence produces a login failure
that looks like a credential problem.

---

## 4. Driver syntax

The same concept is spelled differently by every driver. This table exists because that difference
is the actual cause of the failure, not the concept.

| Auth mode | .NET SqlClient | JDBC | ODBC / pyodbc |
| --- | --- | --- | --- |
| Default credential chain | `Active Directory Default` (3.0.0+) | `ActiveDirectoryDefault` (12.2+) | UNKNOWN |
| Interactive | `Active Directory Interactive` (2.0.0+) | `ActiveDirectoryInteractive` (9.2+) | `Authentication=ActiveDirectoryInteractive` |
| Integrated | `Active Directory Integrated` (2.0.0+) | `ActiveDirectoryIntegrated` (6.0+) | `Authentication=ActiveDirectoryIntegrated` |
| Service principal | `Active Directory Service Principal` (2.0.0+) | `ActiveDirectoryServicePrincipal` (9.2+) | `Authentication=ActiveDirectoryServicePrincipal` |
| Service principal, certificate | UNKNOWN | `ActiveDirectoryServicePrincipalCertificate` (12.4+) | UNKNOWN |
| Managed identity | `Active Directory Managed Identity` / `Active Directory MSI` (2.1.0+) | `ActiveDirectoryManagedIdentity` (12.2+), `ActiveDirectoryMSI` (8.3.1+) | `Authentication=ActiveDirectoryMsi` |
| Device code | `Active Directory Device Code Flow` (2.1.0+) | UNKNOWN | UNKNOWN |
| Workload identity | `Active Directory Workload Identity` (5.2.0+) | UNKNOWN | UNKNOWN |
| SQL authentication | user id / password | user / password | `Authentication=SqlPassword` |

.NET values carry **spaces**; JDBC and ODBC values do not. Sources: the
[SqlClient](https://learn.microsoft.com/en-us/sql/connect/ado-net/sql/azure-active-directory-authentication)
and [JDBC](https://learn.microsoft.com/en-us/sql/connect/jdbc/connecting-using-azure-active-directory-authentication)
Entra authentication pages — both VERIFIED. ODBC values are CONSENSUS from the research runs and
should be re-verified before they are relied on.

For a user-assigned managed identity, the client ID is supplied separately: `msiClientId` in JDBC,
`UID` in ODBC.

### 4.1 A breaking change worth its own diagnostic

> "Starting with **Microsoft.Data.SqlClient 7.0**, Azure and Microsoft Entra ID dependencies are no
> longer included in the core `Microsoft.Data.SqlClient` package."

Entra authentication stops working after a major-version upgrade unless
`Microsoft.Data.SqlClient.Extensions.Azure` is added. The symptom is a failed connection; the cause
is a **missing NuGet package**. Nothing about the network or the identity is wrong.

### 4.2 Fabric Warehouse connection string specifics

- `MultipleActiveResultSets` must be absent or `false` — MARS is not supported.
- `InitialCatalog` should be the warehouse item name; omitting it connects to `master`.

---

## 5. Network paths

### 5.1 Private DNS zones

| Target | Private DNS zone | Public forwarder |
| --- | --- | --- |
| Azure SQL Database | `privatelink.database.windows.net` | `database.windows.net` |
| Azure SQL Managed Instance | `privatelink.{dnsPrefix}.database.windows.net` | `{dnsPrefix}.database.windows.net` |
| Microsoft Fabric (workspace) | `privatelink.fabric.microsoft.com` | `fabric.microsoft.com` |

Source: [Private endpoint DNS configuration](https://learn.microsoft.com/en-us/azure/private-link/private-endpoint-dns) — VERIFIED.

The FQDN does not change when a private endpoint is used; **DNS resolution changes**. A private
endpoint that resolves to the public address is the classic silent failure: the name is right, the
route is wrong.

Clients on a private endpoint do not need the gateway ranges.

> "Clients connecting to private endpoints don't need connectivity to any of these ranges because a
> private endpoint has direct connectivity to the gateways."

### 5.2 Never pin an FQDN to an IP

> "Never pin Azure SQL server FQDNs to specific IP addresses in hosts files, static CNAME records,
> or private DNS zones. Azure SQL gateways are dynamic and change over time."

> "Login attempts that go directly to an IP address (or to a stale IP through a DNS override) fail
> by design. The Azure SQL gateway requires the correct FQDN to route connections to the intended
> server."

This produces login failures — **18456, 40532, 40615** — that appear to be credential problems and
are isolated to particular client networks. It is the highest-value diagnostic in this document,
because every symptom points away from the cause.

---

## 6. Error number to cause

| Error | Meaning | Check first |
| --- | --- | --- |
| **40615** | Server firewall rejected the client IP | Firewall rules on the logical server |
| **18456** | Login failed | Login exists and is enabled; contained user created; **or a DNS override — see §5.2** |
| **40532** | Login failed, routing form | Same DNS-override family as 18456 |
| **5** | Cannot connect | Outbound 1433 open on every firewall in the path |
| **26 / 40** | Server not found or unreachable | Server name; remote connections enabled |
| **10053** | Transport-level error, connection aborted | Client-side interception, proxy, or network appliance |
| **40613** | Database not currently available | Retry with backoff; check for an open DAC session |
| **40197** | Service error during upgrade or failover | The embedded sub-code; retry |
| **40501 / 49918** | Service busy | Resource limits for the tier |
| **4221** | Read-secondary login failed on HADR wait | Long write transactions on the primary |
| **24804 / 6005 / 6008** | Fabric transient loss or workspace unavailable | Sign in again and retry |

Sources: [Troubleshoot common connection issues](https://learn.microsoft.com/en-us/azure/azure-sql/database/troubleshoot-common-errors-issues)
and [Warehouse connectivity](https://learn.microsoft.com/en-us/fabric/data-warehouse/connectivity) — VERIFIED.

Timeouts are not a distinct error number. The documented guidance is a connection timeout of **at
least 30 seconds**, and retry logic for anything cloud-connected.

---

## 7. Contradictions and open questions

These are recorded rather than resolved. A reader who needs certainty should re-fetch the source.

### 7.1 MI redirect ports — settled, but against the grain

One research run stated that MI redirect requires "inbound TCP 1433 **AND** TCP 11000-11999 to the
entire MI subnet range". The current Microsoft page states only 1433 across the subnet range, and
that quote was re-fetched and matched during the merge.

**Reading:** 11000–11999 is an **Azure SQL Database** redirect requirement and an MI
**link/replication** requirement. It is not an MI client-connectivity requirement. The redirect
default changed in October 2025, so older material — and any model trained on it — will disagree.
Confidence: high, but expect pushback.

### 7.2 Fabric SQL database FQDN — unresolved

The same Microsoft page gives two forms:

- "The server name of the SQL database is similar to the server name of Azure SQL Database,
  `<server-unique-identifier>.database.windows.net`"
- "For example, `tcp:<servername>.database.fabric.microsoft.com,1433`"

**Reading:** both appear in production. A skill must **not** pick one silently; it should tell the
user to read the value from the portal's Connection strings pane. Confidence: low.

### 7.3 `proxyOverride=Default` means opposite things

> "Starting in October 2025, when you deploy or update a SQL managed instance programatically ...
> and set the `proxyOverride` parameter to `Default`, the value is interpreted as `Redirect`."
> "SQL managed instances with the `proxyOverride` value set to `Default` before October 2025 are
> converted to `Proxy`."

The same stored value maps to opposite behaviours depending on when it was set. A diagnostic must
read the **effective** value and never infer from `Default`. Confidence: high.

### 7.4 Vocabulary gaps

Three authentication modes have no canonical token yet, and all three are documented prominently:

- **`entra-default`** — the `DefaultAzureCredential` chain. Not a synonym for managed identity: it
  includes managed identity, developer tooling and the CLI. Most-documented mode in both SqlClient
  and JDBC.
- **service principal with certificate** — JDBC 12.4+.
- **workload identity** — SqlClient 5.2.0+.

### 7.5 Unverified areas

ODBC, pyodbc, Go and sqlcmd syntax is CONSENSUS only. Errors 4060 and 40532 lack a dedicated
quotable entry. Fabric SQL database private-endpoint behaviour was not retrieved. Fabric SQL
database SQL-authentication support is unknown and must not be inferred from Fabric Warehouse.

---

## 8. Document version & changelog

| Version | Date | Changes |
| --- | --- | --- |
| v0.1 | 2026-08-12 | Initial draft, merged from six independent research runs against learn.microsoft.com. Five facts re-fetched and matched during the merge: MI public endpoint port 3342, MI redirect on 1433 across the subnet range, Fabric Warehouse SQL-authentication prohibition, the MI private DNS zone form, and the JDBC `ActiveDirectoryDefault` keyword. One inter-run contradiction resolved against the live page (§7.1) and two left open (§7.2, §7.5). Not wired into any skill; no fact in `sql-server-to-azure-migration.md` changed. |
