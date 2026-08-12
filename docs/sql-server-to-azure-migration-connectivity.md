# SQL Server to Azure — connectivity knowledge base

> **Version.** v0.7 — 12 August 2026. Ships in the `sql-migration-advisor` plugin as the
> knowledge base for `get-connection-details`. It changes no fact in
> [`sql-server-to-azure-migration.md`](sql-server-to-azure-migration.md), which serves the
> migration skill and is maintained separately.
>
> **Scope.** How an application connects to an Azure SQL family target, and why a connection
> fails. It deliberately excludes migration methods, tuning, pricing and licensing, which live in
> [`sql-server-to-azure-migration.md`](sql-server-to-azure-migration.md).
>
> **Provenance.** Built from six independent research runs against learn.microsoft.com, merged and
> cross-checked. Where the runs disagreed, the disagreement is recorded in §7 rather than averaged
> away.
>
> **Facts carry a status, and the status is the point.** `VERIFIED` means a Microsoft page **and
> a matching quote** sit behind that exact row — 21 of 58 rows qualify. `DERIVED` means the page
> is cited but the row carries no quote of its own: it is stated, not proven, and must not be
> presented as verified. `CONFLICT` and `OPEN` are surfaced, never resolved silently.
>
> Even `VERIFIED` is a floor rather than a guarantee. A quote proves the cell it supports, not
> the whole row, not the scope of the claim, and not that a page has no later section qualifying
> it. Four external audits each found rows where that distinction had been lost; the fourth
> found it a sixth time. The incidents are in §7.6.
>
> **Agreement between research runs is not evidence** and is never used as one. Two models agreeing
> usually means one shared training bias, and one run in this batch cited a page that returns 404.
> Anything that cannot be quoted is not stated here; it is listed as open research in §7.5.

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
| Private endpoint | see §5.2 — **depends on topology** | **1433** | Proxy, forced | VERIFIED |

> "The VNet-local endpoint accepts connections on port 1433."
> "Public endpoint accepts connections on port 3342."
> "Public endpoint always uses the Proxy connection type regardless of the connection type setting."
> "Private endpoints always use the Proxy connection type regardless of the connection type setting."
> — [Connectivity architecture for MI](https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/connectivity-architecture-overview)

**These are three different hostnames, not three routes to one.** The public endpoint inserts
`.public.` into the name and listens on a different port, so a connection string written for the
VNet-local endpoint cannot reach it by moving the client to another network: **both the host and the
port change**. The public endpoint must also be **enabled** on the instance — it is off by default.

Port 3342 is not a typo and not optional. A client pointed at the public hostname on 1433 will never
connect.

**MI redirect ports are disputed. Test 1433 first; open 11000–11999 only if that fails and your
security policy allows it.**

| Reading | Source |
| --- | --- |
| 1433 across the subnet range, no port range | [Connection types](https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/connection-types-overview), re-fetched twice on 12 Aug 2026 |
| 1433 **and 11000–11999** | Microsoft's own [Bicep](https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/create-bicep-quickstart) and [ARM](https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/create-template-quickstart) quickstarts still provision an NSG rule for the range. An external audit also quotes a variant of the connection-types page stating the range "remains authoritative until further notice" |

> "Traffic from your SQL clients to the SQL managed instance must be permitted on port 1433 across
> the instance's subnet address range."

v0.3 declared this settled in favour of 1433-only and dismissed a research run that said otherwise.
That was the same mistake as the P0s: **a quote proving what one page says was read as proving what
Microsoft requires.**

**Opening a port range is not free.** v0.5 said that recommending both ranges costs only "unused
ports inside the customer's own subnet" and that nothing breaks. That was cavalier: a wider range
enlarges the exposed surface and can breach a least-privilege policy the customer is audited
against. It is a decision for the operator, not a default.

**So the guidance is a sequence, not a blanket rule:** configure 1433 across the subnet range, test
the actual topology, and add 11000–11999 only if the connection fails and policy permits. Say which
reading each recommendation rests on.

Redirect also requires a client driver implementing **TDS 7.4 or newer**; older clients silently
fall back to proxy rather than failing.

> "The benefits of the redirect connection type are only available for SQL clients that support TDS
> version 7.4 or newer, which was released with SQL Server 2012."

**The subnet-range rule applies per endpoint, not universally.**

| Endpoint | Rule |
| --- | --- |
| VNet-local | Allow the required ports **across the entire subnet range** — the underlying IP can change |
| Public | Allow 3342 **across the entire subnet range** — same reason |
| **Private endpoint** | **A fixed address in the consumer VNet.** The subnet-range rule does not apply |

> "always use its domain name and allow inbound traffic on the required ports across the entire
> subnet range, as the underlying IP address can occasionally change."
> — [Connectivity architecture for MI](https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/connectivity-architecture-overview), on the VNet-local endpoint

A private endpoint behaves differently by design. It carries **only port 1433**, only in one
direction, and it survives the instance moving:

> "it only carries traffic on port 1433 (the standard TDS traffic port)" / "Even if you move the
> instance to another subnet, any established private endpoints will continue to point to it."
> — [Private Link for MI](https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/private-endpoint-overview)

**What remains true on every endpoint** is the connection string: always the FQDN, never the
address. Stable IP and connecting by IP are different questions, and v0.2 conflated them.

The public endpoint carries client traffic only.

> "Public endpoints only carry client traffic and can't be used for data replication between two
> instances, such as failover groups or Managed Instance link."

The VNet-local endpoint is the one to use when a scenario needs ports other than 1433 — failover
groups, distributed transactions, Managed Instance link.

### 2.3 SQL Server on Azure VM

| Property | Value | Status |
| --- | --- | --- |
| FQDN | `<dns-label>.<region>.cloudapp.azure.com`, or the VM public IP | VERIFIED |
| Port, default instance | 1433 | VERIFIED |
| Custom port | append it to the server name: `<dns-label>.<region>.cloudapp.azure.com,1500` | VERIFIED |
| Connection policy | Not applicable — no gateway, so no Redirect/Proxy concept | VERIFIED |

> "Any client with internet access can connect to the SQL Server instance by specifying either the
> public IP address of the virtual machine or any DNS label assigned to that IP address. If the SQL
> Server port is 1433, you don't need to specify it in the connection string."
> — [Connect to a SQL Server virtual machine](https://learn.microsoft.com/en-us/azure/azure-sql/virtual-machines/windows/ways-to-connect-to-sql)

This is an IaaS target: the connection reaches the guest operating system, so SQL Server's own
configuration, the Windows firewall and the NSG all apply, and none of the PaaS gateway behaviour
does. The portal offers three connectivity types — **Public** (over the internet), **Private**
(same virtual network) and **Local** (on the VM itself).

**Three traps specific to this target:**

- **Developer and Express images do not enable TCP/IP.** The connection fails before any firewall
  question arises, and nothing in the network configuration explains why.

  > "The virtual machine images for the SQL Server Developer and Express editions don't
  > automatically enable the TCP/IP protocol."

- **Windows authentication requires a domain-joined VM inside a virtual network.** There is no
  other route to it.

  > "Virtual networks also enable you to join your Azure VMs to a domain. This is the only way to
  > use Windows authentication to SQL Server. The other connection scenarios require SQL
  > authentication with user names and passwords."

- **Choosing Public enables SQL authentication**, because public access requires it. Anyone
  planning Entra-only should not select it.

### 2.4 Fabric SQL database

| Property | Value | Status |
| --- | --- | --- |
| Connection policy | `Default` only, cannot be changed | VERIFIED |
| FQDN | **Contradictory in Microsoft's own documentation** — see §7.2 | — |

> "Currently, the only supported connection policy for SQL database in Microsoft Fabric is
> **Default**." — [Connect to your SQL database](https://learn.microsoft.com/en-us/fabric/database/sql/connect)

Because `Default` means Redirect inside Azure and Proxy outside, a Fabric SQL database client
running inside Azure would inherit the Azure SQL Database Redirect port requirement and could not
opt out of it. **No Microsoft page states this**: it follows from combining two documented facts.
It is recorded as an inference in §7.5 and must not be presented as a requirement.

### 2.5 Fabric Warehouse

| Property | Value | Status |
| --- | --- | --- |
| FQDN | **read it from the portal's Connection strings pane** | see below |
| Port | 1433 | VERIFIED |

> "The SQL connection string requires TCP port 1433 to be open. TCP 1433 is the standard SQL Server
> port number." — [Warehouse connectivity](https://learn.microsoft.com/en-us/fabric/data-warehouse/connectivity)

**The FQDN is not settled and must not be hard-coded.** v0.1 stated
`<server-unique-identifier>.<tenant>.fabric.microsoft.com` and marked it VERIFIED, but the quote
above proves the *port* and says nothing about the hostname — the same defect as the three P0s in
§7.6. Another Microsoft page shows a `…datawarehouse.fabric.microsoft.com` form. Treat the Warehouse
FQDN exactly like the Fabric SQL database one in §7.2: portal-derived, never asserted.

Firewall clearance cannot be done by hostname.

> "You can't use the Fully Qualified Domain Name (FQDN) of the TDS Endpoint alone."

---

## 3. Authentication

### 3.1 What each target accepts

| Target | Entra | SQL authentication | Status |
| --- | --- | --- | --- |
| Azure SQL Database | supported | supported | VERIFIED |
| Azure SQL Managed Instance | supported | supported | VERIFIED |
| SQL Server on Azure VM | **SQL Server 2022 (16.x) and later only** | supported, and required for remote access unless AD is configured | VERIFIED |
| Fabric SQL database | **the only identity provider** | **not supported** | VERIFIED |
| Fabric Warehouse | user principals and service principals only | **not supported** | VERIFIED |

> "SQL Authentication isn't supported." — [Warehouse connectivity](https://learn.microsoft.com/en-us/fabric/data-warehouse/connectivity)

> "Microsoft Entra ID is the only identity provider SQL database in Fabric supports. Specifically,
> SQL authentication isn't supported." / "Logins (server principals) aren't supported."
> — [Authentication in SQL database in Fabric](https://learn.microsoft.com/en-us/fabric/database/sql/authentication#limitations)

Neither Fabric surface accepts SQL authentication, which eliminates an entire class of connection
string and is the first thing to check when a Fabric connection fails with a credential error.

**Fabric has prerequisites beyond the database.** An Entra identity that can sign in is still
refused without them:

- The user, service principal or group needs the **Read item permission** for the database in
  Fabric.

  > "To successfully authenticate to a SQL database, a Microsoft Entra user, a service principal,
  > or their group, must have the Read item permission for the database in Fabric."

- Service principals additionally need the **"Service principals can use Fabric APIs" tenant
  setting** enabled. This is an admin action outside the database, and nothing in the failure
  message points at it.

- `CREATE USER ... FROM EXTERNAL PROVIDER` requires membership of the **Directory Readers** role in
  Entra. When connected *as a service principal*, `FROM EXTERNAL PROVIDER` is not usable at all —
  the application must supply `SID` and `TYPE` explicitly.

### 3.2 SQL Server on Azure VM has three authentication modes, not two

| Mode | Keyword | Condition |
| --- | --- | --- |
| SQL authentication | user id / password | Required for remote access unless Active Directory is configured |
| **Windows** authentication | `Integrated Security=true` | Only when the VM is domain-joined inside a virtual network |
| **Microsoft Entra** | `Authentication=Active Directory ...` | **SQL Server 2022 (16.x) and later only**, enabled via the Azure portal |

**Windows integrated and Entra integrated are not the same mechanism.** `Integrated Security=true`
is Windows authentication and needs the domain join. `Authentication=Active Directory Integrated`
is an Entra mode with different prerequisites, and whether it is supported here — and under which
client and federation conditions — is **not established** (§7.5). v0.6 justified the Entra mode
with a quote about Windows authentication, the sixth instance of the same reading error.

> "SQL Server with Microsoft Entra authentication is only supported on SQL Server 2022 (16.x) and
> later versions."
> — [Connect to a SQL Server on Azure VM using Microsoft Entra ID](https://learn.microsoft.com/en-us/azure/azure-sql/virtual-machines/windows/ways-to-connect-to-sql)

The version boundary matters: the same recommendation is correct on SQL Server 2022 and impossible
on 2019.

### 3.3 The prerequisite everyone forgets

An Entra principal that can sign in to Azure still cannot open a database it has no user in.
Creating the contained user is a separate, explicit step, and its absence produces a login failure
that looks like a credential problem.

---

## 4. Driver syntax

The same concept is spelled differently by every driver. This table exists because that difference
is the actual cause of the failure, not the concept.

| Auth mode | .NET SqlClient | JDBC | ODBC |
| --- | --- | --- | --- |
| Default credential chain | `Active Directory Default` (3.0.0+) | `ActiveDirectoryDefault` (12.2+) | **not available** |
| Interactive | `Active Directory Interactive` (2.0.0+) | `ActiveDirectoryInteractive` (9.2+) | `Authentication=ActiveDirectoryInteractive` (17.1+, **Windows only**) |
| Integrated | `Active Directory Integrated` (2.0.0+) | `ActiveDirectoryIntegrated` (6.0+) | `Authentication=ActiveDirectoryIntegrated` (Windows; Linux/macOS 17.6+) |
| Service principal | `Active Directory Service Principal` (2.0.0+) | `ActiveDirectoryServicePrincipal` (9.2+) | `Authentication=ActiveDirectoryServicePrincipal` (17.7+) |
| Service principal, certificate | — | `ActiveDirectoryServicePrincipalCertificate` (12.4+) | — |
| Managed identity | `Active Directory Managed Identity` / `Active Directory MSI` (2.1.0+) | `ActiveDirectoryManagedIdentity` (12.2+), `ActiveDirectoryMSI` (8.3.1+) | `Authentication=ActiveDirectoryMsi` (17.3.1.1+) |
| Device code | `Active Directory Device Code Flow` (2.1.0+) | — | — |
| Workload identity | `Active Directory Workload Identity` (5.2.0+) | — | — |
| SQL authentication | user id / password | user / password | `Authentication=SqlPassword` |

All three columns are VERIFIED against the driver documentation:
[SqlClient](https://learn.microsoft.com/en-us/sql/connect/ado-net/sql/azure-active-directory-authentication),
[JDBC](https://learn.microsoft.com/en-us/sql/connect/jdbc/connecting-using-azure-active-directory-authentication),
[ODBC](https://learn.microsoft.com/en-us/sql/connect/odbc/using-azure-active-directory).

**.NET values carry spaces; JDBC and ODBC values do not.** That single difference produces a large
share of real failures, and it is why this table exists rather than a description of the concepts.

**ODBC has no default-credential mode.** Its documented value list is closed —
`SqlPassword`, `ActiveDirectoryIntegrated`, `ActiveDirectoryInteractive`, `ActiveDirectoryMsi`,
`ActiveDirectoryServicePrincipal`, `ActiveDirectoryPassword` (deprecated) — so porting
`Active Directory Default` from SqlClient produces a value the driver rejects.

**Platform limits are part of the answer.** `ActiveDirectoryInteractive` is Windows-driver only,
and `ActiveDirectoryIntegrated` needs 17.6+ on Linux and macOS. A connection string that is correct
on a developer's laptop can be invalid in the Linux container that runs it.

For a user-assigned managed identity the client ID is supplied separately: `msiClientId` in JDBC,
`UID` in ODBC — and in ODBC that is the **client ID** on App Service or Container Instances, the
**object ID** everywhere else.

**`sqlcmd` and `bcp` are not settled.** The example below is **Fabric-specific** and uses
`<server>;1433`; standard `sqlcmd` separates the port with a comma, `-S <server>,<port>`. There are
also two builds — Go and ODBC — whose `-G` semantics differ, and without credentials the Go build
can fall back to a default credential chain, which is not interactive. Collect the build before
recommending a flag. Listed in §7.5:

```text
sqlcmd -S <your_server>.database.fabric.microsoft.com;1433 -G -d <your_database> -i ./script.sql
```

Both were listed as blocking open research in v0.3 and v0.4 while their syntax sat on the Fabric
connect page that §2.4 already quotes — the third gap declared while holding its source, after Go
and error 4060.

**pyodbc and Go remain absent.** No page was retrieved stating their syntax in quotable form, and
the Go documentation is sitting in §9 waiting to be read. Listed in §7.5.

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
| Azure SQL Managed Instance, endpoint in a **different** VNet | `privatelink.{dnsPrefix}.database.windows.net` | `{dnsPrefix}.database.windows.net` |
| Azure SQL Managed Instance, endpoint in the **same** VNet | **not this zone** — see below | — |
| Microsoft Fabric (workspace) | `privatelink.fabric.microsoft.com` | `fabric.microsoft.com` |

Source: [Private endpoint DNS configuration](https://learn.microsoft.com/en-us/azure/private-link/private-endpoint-dns) — VERIFIED.

**The Managed Instance answer depends on where the endpoint sits, and getting it wrong is worse
than not answering.** A private endpoint in the *same* virtual network as the instance is not the
generic case: applying the `privatelink` zone there can disturb the instance's own internal and
management connectivity, and the TLS name may require `HostNameInCertificate`. That case is **not
researched here** (§7.5).

So the topology is a required input, not a detail: ask whether the endpoint is in the same VNet as
the instance or a different one, and answer with the open item rather than the different-VNet zone
when it is the same.

Errors 47073 and 47072 are worth knowing before any of this matters: `Public network access`
disabled and a minimum-TLS mismatch both refuse the connection before DNS or ports come into play.

Clients on a private endpoint do not need the gateway ranges.

> "Clients connecting to private endpoints don't need connectivity to any of these ranges because a
> private endpoint has direct connectivity to the gateways."

### 5.2 Private endpoints — the FQDN stays, the ports do not

**Never connect to the `privatelink` name or to the private IP.** The private DNS zone is
`privatelink.database.windows.net`, but that is the zone, not the name a client dials.

> "Always use the fully qualified domain name (FQDN) of the server (`<server>.database.windows.net`)
> in connection strings for all client drivers and tools. Login attempts made directly to the
> private IP address or using the private link FQDN
> (`<server>.privatelink.database.windows.net`) fail. This behavior is by design because the
> private endpoint routes traffic to the SQL Gateway, which requires the correct FQDN to route
> logins successfully."
> — [Private Link for Azure SQL Database](https://learn.microsoft.com/en-us/azure/azure-sql/database/private-endpoint-overview)

The name is unchanged; **DNS resolution** changes. An endpoint resolving to the public address is
the classic silent failure — right name, wrong route.

**The Redirect port range is different on a private endpoint.** This is the correction most likely
to be got wrong, because the public-endpoint figure is the one everyone remembers:

| Path | Redirect requires |
| --- | --- |
| Public endpoint | 1433 to the gateway **and 11000–11999** to regional Azure SQL IPs |
| **Private endpoint** | **1433 to 65535**, inbound to the endpoint VNet and outbound from the client VNet |

> "Allow **inbound** communication to the VNET hosting the private endpoint to port range 1433 to
> 65535." / "Allow **outbound** communication from the VNET hosting the client to port range 1433
> to 65535."

Opening 11000–11999 for a private endpoint in Redirect is not a partial fix; the connection still
fails.

**Two consequences that decide the answer:**

- **An existing private endpoint on `Default` is running Proxy on 1433**, not Redirect. Setting the
  policy to Redirect before the endpoint existed may require toggling it afterwards.

  > "Existing private endpoints using **Default** connection policy will be using the Proxy
  > connection policy with port 1433."

- **Redirect is driver-gated.** ODBC, OLE DB, .NET SqlClient and **JDBC 9.4 or above** support it;
  everything else is proxied whatever the policy says.

  > "Connections originating from all other drivers are proxied."

If the 1433–65535 range cannot be opened, Microsoft's documented alternative is to set the policy
to Proxy rather than to work around it.

Clients on a private endpoint do not need the gateway ranges.

> "Clients connecting to private endpoints don't need connectivity to any of these ranges because a
> private endpoint has direct connectivity to the gateways."

**This does not generalise to Fabric.** Workspace-level Private Link for Fabric alters the
hostname, unlike the Azure SQL cases above. Not researched here; see §7.5.

### 5.3 TLS and certificate validation

The most common cause of a connection that **stopped** working without anything changing in the
network or the credential. Driver upgrades changed the defaults, twice.

| Driver | Change | Effect |
| --- | --- | --- |
| Microsoft.Data.SqlClient **4.0** | `Encrypt` now defaults to `True` | A connection that worked on 3.x fails on 4.x unless the server has a verifiable certificate |
| Microsoft.Data.SqlClient **2.0** | `Trust Server Certificate` is honoured even when `Encrypt=False`, if the server forces encryption | Certificate validation starts happening where it previously did not |
| Microsoft.Data.SqlClient **5.0** | `Strict` mode added | A third value, not a boolean |
| ODBC Driver **18** | `Encrypt` default becomes `Yes` (18.0.1+) | Same class of regression, on a different upgrade path |

> "Version 4.0 of Microsoft.Data.SqlClient introduces breaking changes in the encryption settings.
> `Encrypt` now defaults to `True`."
>
> "Previously, if `Encrypt` was set to `False`, the server certificate wouldn't be validated,
> regardless of the `Trust Server Certificate` setting. Now, the server certificate is validated
> based on the `Trust Server Certificate` setting if the server forces encryption, even if
> `Encrypt` is set to `False`."
> — [Encryption and certificate validation](https://learn.microsoft.com/en-us/sql/connect/ado-net/encryption-and-certificate-validation)

**What the certificate is checked against** decides whether a working DNS name is enough:

> "The certificate is validated for things like expiry, trust chain, and that the name in the
> certificate matches the name of the server the client is connecting to."

This is why a name that resolves correctly can still fail. Connect through a CNAME, a retained
legacy server name, or a load-balancer alias, and the name presented no longer matches the name in
the certificate. The migration knowledge base documents the same trap for the retained-server-name
pattern on Managed Instance, where `HostNameInCertificate` is the client-side answer.

**Do not resolve this with `TrustServerCertificate=True`.** It makes the symptom disappear and
removes the protection:

> "By setting your client to trust the certificate on the server, you might become vulnerable to
> man-in-the-middle attacks."
>
> "If you deploy a verifiable certificate on the server, ensure client `Encrypt` settings are
> `True` and `Trust Server Certificate` settings are `False`."

It is a diagnostic step — if the connection succeeds with it, the fault is the certificate — never
a production setting.

**Order of elimination.** TLS sits between the network and the login, which is why its failures are
misread in both directions:

```
DNS  →  TCP  →  TLS / pre-login  →  token  →  database authorisation  →  transient faults
```

A failure at the TLS step looks like a network problem from one side and a credential problem from
the other. Establish where the connection actually stops before treating either.

### 5.4 Never pin an FQDN to an IP

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
| **47073** | `Public network access` is disabled | The server setting, **before** any port or DNS question |
| **47072** | Client cannot meet the minimum TLS version | The server minimum against the client and driver capability |
| **5** | Cannot connect | The port *this target* uses — 1433, **3342** on the MI public endpoint, a custom SQL VM port, or the Redirect range — on every firewall in the path |
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

### 7.1 MI redirect ports — **CONFLICT, unresolved**

v0.3 recorded this as *settled, high confidence* in favour of 1433 only. **That was wrong**, and
wrong in the way this document keeps being wrong: a quote proving what one page says was read as
proving what Microsoft requires.

| Reading | Evidence |
| --- | --- |
| 1433 across the subnet range | The [Connection types](https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/connection-types-overview) prerequisites, re-fetched twice on 12 August 2026. Also consistent with [connectivity architecture](https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/connectivity-architecture-overview), which describes the NSG as "filtering inbound traffic on port 1433" |
| 1433 **and 11000–11999** | Quoted by an external audit with a note that the range "remains authoritative until further notice" while a 1433-only improvement rolls out. **Not located** on the three pages read here — connection types, connectivity architecture, service-aided subnet configuration |

The transitional phrasing the audit quotes is too specific to be an invention, and a rollout note
would explain why the prerequisites page reads as it now does. The most likely explanation is that
the two readings are the same rollout seen at different points, which is precisely the condition a
`CONFLICT` status exists for.

**Confidence: none, and deliberately so.** Two independent research inputs disagree, and the
disagreement was previously resolved by fiat. It is now recorded and the guidance in §2.2 is set to
the safe side: open both ranges, because being wrong in that direction costs unused ports inside
your own subnet, while being wrong in the other direction costs a failed production connection.

This entry is the strongest argument in the document for the review dates in §7.7. A fact carrying
"until further notice" is by definition high-volatility, and nothing here expires.

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

### 7.5 Open research — not stated as fact anywhere above

These are gaps in *our* research, not genuine uncertainty. The answers exist in Microsoft's
documentation; nobody has retrieved and quoted them yet. They are listed rather than guessed.

| Item | Why it is not stated | Blocking |
| --- | --- | --- |
| **pyodbc syntax** | It passes ODBC keywords through, but no page states this quotably. Use the ODBC rows and say the wrapper was not separately verified | no |
| **Error 4060** | No quotable entry on the troubleshooting page | no |
| **Named instances, dynamic ports, SQL Browser on UDP 1434, AG listeners and DNN on SQL VM** | Not researched. A named instance on a dynamic port behaves nothing like the default-instance case documented in §2.3 | no |
| **Azure SQL `Public network access`, logical firewall rules, VNet rules and service tags** | Not researched, and they gate the connection before any of §2.1 applies | no |
| **Fabric tenant-level versus workspace-level Private Link** | Not researched. They are different features with different hostname effects | no |
| **Token audience, and user vs service principal vs managed identity differences** | Not researched | no |
| **Error `state`/sub-code detail** | The table keys on the error number alone. `18456` without its state does not identify a single cause, so the table narrows the search rather than ending it | no |

### 7.6 What external audits of v0.1 and v0.2 found

Recorded because the failure mode matters more than the individual errors.

**Two independent audits reported the same three P0s**, which is itself evidence they are real.
All three failed the same way: **a quote proving one cell was read as proving the whole row.**

| Claim | Reality |
| --- | --- |
| Fabric SQL database SQL auth "UNKNOWN — the documentation is silent" | Explicit: SQL authentication isn't supported. The page was already listed in §9 |
| SQL VM: Windows auth via domain, otherwise SQL auth | Omits Microsoft Entra, supported on SQL Server 2022+ |
| "Always allow the whole subnet range on **any** MI endpoint" | True of VNet-local and public. False of a private endpoint, which is a fixed address |

The second audit found two more of the same kind:

| Claim | Reality |
| --- | --- |
| Azure SQL Database private endpoint inherits the 11000–11999 Redirect range | It is **1433–65535**. Opening 11000–11999 is not a partial fix; the connection still fails |
| Fabric Warehouse FQDN, marked VERIFIED | The attached quote proves the port and says nothing about the hostname |

Three findings were process failures rather than fact errors:

- The register announced 102 URLs and listed 85. Both numbers were mine.
- §7.5 declared that no Go page had been retrieved while the Go documentation sat in §9. The same
  is true of `sqlcmd` and of error 4060, whose source is the troubleshooting page already cited
  throughout §6.
- **The research pipeline does not distinguish *source discovered* from *source opened*, *claim
  extracted* and *claim verified*.** That single conflation explains every gap above.

The lesson is not "check more carefully". It is that *"the documentation is silent"* is only ever a
statement about which pages were read. This document twice mistook the edge of its own research for
the edge of what Microsoft documents.

### 7.7 Accepted and not done

The second audit's structural recommendations are accepted and **not implemented**. They are listed
so the gap is a decision rather than an oversight, and they are why this knowledge base is still
not wired into the skill.

| Item | Why it matters here |
| --- | --- |
| **Six-status taxonomy** — `VERIFIED_DIRECT`, `VERIFIED_DERIVED`, `CONFLICT`, `OPEN`, `DEPRECATED`, `STALE_REVIEW_REQUIRED` | A binary status hid five errors. It cannot express a fact derived from two pages, nor one whose review date has passed. **`CONFLICT` now exists** (§7.1); the other four do not |
| **Atomic facts on a composite key** — target × endpoint × client location × policy × auth × driver × version × network path | §1's claim that connectivity purely *composes* is too simple. The network path can force Proxy, the policy changes the ports, the target restricts auth modes, and the driver version gates Redirect |
| **Volatility-based review dates** | Nothing here expires. §7.1 carries "until further notice", which is by definition high-volatility, and no fact has a review date |
| **Errors as candidate causes** | `18456` without its state does not identify one cause, and 26/40/10053 are families rather than diagnoses |

### 7.8 Drift detection — **done**

Ten claims now watch the sources behind the volatile facts in this document. They live in
[`reference/claims-registry.json`](../reference/claims-registry.json) alongside the migration
knowledge base's own claims, so the existing weekly workflow picks them up with no new machinery.

| Claim | Watches |
| --- | --- |
| `conn-mi-connection-types-redirect-ports` | The §7.1 conflict — the highest-volatility fact here |
| `conn-mi-endpoint-ports` | 1433 / 3342 / forced Proxy |
| `conn-sqldb-connection-policy-ports` | Redirect 11000–11999, Default inside vs outside Azure |
| `conn-sqldb-private-endpoint-redirect` | 1433–65535, FQDN-only, Default means Proxy |
| `conn-fabric-sqldb-authentication` | Entra-only, Read item permission, tenant setting |
| `conn-fabric-warehouse-connectivity` | No SQL auth, no MARS, `InitialCatalog` |
| `conn-sqlclient-encryption-defaults` | The TLS defaults that changed in 2.0 and 4.0 |
| `conn-odbc-entra-auth-values` | The closed value list with no default-credential mode |
| `conn-jdbc-entra-auth-modes` | The disputed minimum version for managed identity |
| `conn-sqlvm-entra-and-connectivity` | Entra from SQL Server 2022, TCP/IP on Developer and Express |

**Each section was proved to carry its fact before being baselined.** One did not: the JDBC claim
first matched the page's H1 and silently spanned the whole document, which would have reported
drift on any editorial change and told nobody anything. It is now anchored on the managed-identity
mode, which is where the version dispute actually lives. That check exists because the SQL Server
lifecycle dates were once registered against a section that never mentioned them.

Sabotage-tested: a corrupted hash reports `drifted=1` and exits non-zero, so CI fails and a human
reads the page.

**What this does not solve.** Drift detection watches the ten pages behind the volatile facts, not
all 58 rows, and it detects *change* rather than *staleness* — a page nobody edits is never
flagged, however old the fact. Review dates by volatility remain the missing half.

---

## 8. Document version & changelog

| Version | Date | Changes |
| --- | --- | --- |
| v0.7 | 2026-08-12 | **Fourth external audit, and the first to find the flagship example wrong.** The worked example described the same connection string reaching a Managed Instance from a laptop and from App Service. That is impossible: the public endpoint is a different hostname — `.public.` is inserted — on a different port, and it must be enabled. The card also printed an ADO.NET keyword list under a JDBC heading; a JDBC answer is a `jdbc:sqlserver://host:port;key=value` URL and what was shipped would fail at runtime. Both are rewritten, and the skill now asks for the hostname rather than composing it. Windows integrated and Entra integrated were conflated: `Integrated Security=true` was justified by a quote about Windows authentication and then labelled an Entra mode, demanding a domain join for a mode that does not need one — the sixth instance of a quote proving one cell being read as proving a row. The MI redirect conflict gains Microsoft’s own Bicep and ARM quickstarts, which still provision 11000–11999, and loses the claim that opening a range is harmless: a wider range enlarges exposure and can breach least privilege, so the guidance is now to test 1433 first and widen only if it fails and policy allows. Managed Instance private-endpoint DNS depends on whether the endpoint sits in the instance’s own virtual network, which the contract now collects and which the same-VNet case answers as an open item. Statuses are split: 21 rows keep `VERIFIED`, 37 become `DERIVED` because the page is cited but the row carries no quote of its own, and the header no longer claims every fact is quoted. `sqlcmd` and `bcp` return to open research — the syntax shipped was a Fabric example generalised into a rule, and the Go and ODBC builds do not give `-G` the same meaning. Errors 47073 and 47072 are added because they refuse the connection before ports or DNS matter, error 5 stops assuming 1433, and diagnosis replaces the mandatory *Not this* row with a hypothesis, its evidence and the test that would disprove it. |
| v0.6 | 2026-08-12 | **Drift detection, and the skill documented as shipping.** Ten claims now watch the Microsoft pages behind the volatile facts and fail the build when one changes, reusing the registry and weekly workflow already built for the migration knowledge base. Each section was proved to carry its fact before being baselined, and one did not: the JDBC claim matched the page H1 and silently spanned the whole document, so it would have reported drift on any editorial change and told nobody anything. A CI gate now keeps this document and its matrix from disagreeing on version or on three load-bearing values, and it earned its place by catching the matrix left a version behind. The skill gained its own input and output contracts, kept deliberately separate from the migration skill’s: the two share a repository and a plugin, not a vocabulary. |
| v0.5 | 2026-08-12 | **A third audit reopened a question v0.3 had closed by fiat.** MI redirect ports return to **CONFLICT**: the pages reachable here state 1433 across the subnet range, while the audit quotes 1433 **and 11000–11999** with a note that the range remains authoritative until further notice. That text was not located on the three pages read, and v0.3 had used its own partial reading to dismiss a research run that said 11000–11999 — the same cell-proves-the-row failure, this time applied to settle a dispute rather than to state a fact. The guidance now opens **both** ranges, because the risk is asymmetric: recommending 1433 alone and being wrong fails the connection, while recommending both and being wrong opens unused ports inside the customer's own subnet. `sqlcmd` and `bcp` leave open research — their `-G` syntax is on the Fabric page §2.4 already quotes, the third gap declared while holding its source after Go and error 4060. |
| v0.4 | 2026-08-12 | **Second external audit. Two more rows failed the same way as the three P0s: a quote proving one cell was read as proving the row.** Azure SQL Database private endpoints had no row of their own, so the public-endpoint Redirect range would have been applied by default. It is **1433 to 65535**, not 11000–11999, and opening the wrong one leaves the connection failing rather than partly working. Connecting to the `privatelink` FQDN or to the private IP fails by design — something the private DNS zone table implied was fine. An existing private endpoint on `Default` runs Proxy on 1433, and Redirect is gated on the driver: JDBC needs 9.4 or above, and anything outside the documented list is proxied whatever the policy says. The Fabric Warehouse FQDN loses its VERIFIED status, because the quote behind it proved the port and said nothing about the hostname. §7.7 records the structural recommendations as accepted and not done, chief among them a claims registry with drift detection: that machinery already exists for the sibling knowledge base and watches 0 of the 57 facts here. |
| v0.3 | 2026-08-12 | **External audit response. Three claims marked VERIFIED were wrong, and all three failed the same way: a quote proving one cell was read as proving the whole row.** Fabric SQL database was recorded as "SQL authentication UNKNOWN, the documentation is silent" — it is not silent, and the page saying so was already listed in the source register. SQL Server on Azure VM was described as Windows-auth-via-domain or SQL auth, omitting Microsoft Entra authentication on SQL Server 2022 and later; the quote used proved the Windows case only. "Always allow the whole subnet range on any MI endpoint" was true of VNet-local and public and false of a private endpoint, which is a fixed address — a stable IP and connecting by IP had been conflated. Added the TLS section whose absence was indefensible in a document about why connections fail: `Encrypt` defaults changed in SqlClient 4.0 and ODBC 18.0.1, certificate validation changed in SqlClient 2.0, and `TrustServerCertificate=True` is recorded as a diagnostic and never a production setting. Added Fabric's Read item permission and the service principal tenant setting. The header no longer claims that every fact is verified; it states what a quote does and does not prove. Two process failures are recorded rather than quietly fixed: the register announced 102 URLs while listing 85, and open research declared no Go page had been retrieved while the Go documentation sat in the register. |
| v0.2 | 2026-08-12 | Removed the CONSENSUS tier. Connectivity is a closed domain, so agreement between research runs was rejected as evidence — two models agreeing usually means one shared training bias, and one run cited a page returning 404. ODBC and SQL Server on Azure VM were re-fetched and both proved more precise than the agreement they replaced. Go and sqlcmd were removed rather than guessed. Published the full source register after the first draft cited 9 URLs while the runs had consulted 103. |
| v0.1 | 2026-08-12 | Initial draft, merged from six independent research runs against learn.microsoft.com. Five facts re-fetched and matched during the merge: MI public endpoint port 3342, MI redirect on 1433 across the subnet range, Fabric Warehouse SQL-authentication prohibition, the MI private DNS zone form, and the JDBC `ActiveDirectoryDefault` keyword. One inter-run contradiction resolved against the live page (§7.1) and two left open (§7.2, §7.5). Not wired into any skill; no fact in `sql-server-to-azure-migration.md` changed. |


---

## 9. Source register

Every learn.microsoft.com page consulted by the six research runs behind this document, so a reader can audit what was read and not only what was quoted. 103 URLs were fetched during the merge. 102 returned HTTP 200, and 17 of those were non-en-us locale duplicates, leaving **85 listed below, which collapse to 65 canonical pages** once `?view=` variants are folded. The v0.2 text claimed "all 102 URLs below" while listing 85 - a self-contradiction in a document whose entire purpose is rigour, and one an external audit caught before any reader did.

Pages marked VERIFIED had their supporting sentence re-fetched and matched word for word. The others resolve and were consulted, which is evidence that a page exists, not that every claim attributed to it is correct.

One cited URL was dead and is excluded: the passwordless authentication overview under /azure/azure-sql/database/ returned 404. A research run cited a page that does not exist, which is the plainest argument for demanding a verbatim quote beside every link.

### Azure SQL Database

- https://learn.microsoft.com/en-us/azure/azure-sql/database/adonet-v12-develop-direct-route-ports?view=azuresql
- https://learn.microsoft.com/en-us/azure/azure-sql/database/authentication-aad-overview
- https://learn.microsoft.com/en-us/azure/azure-sql/database/authentication-aad-overview?view=azuresql
- https://learn.microsoft.com/en-us/azure/azure-sql/database/authentication-aad-service-principal-tutorial?view=azuresql
- https://learn.microsoft.com/en-us/azure/azure-sql/database/authentication-azure-ad-user-assigned-managed-identity?view=azuresql
- https://learn.microsoft.com/en-us/azure/azure-sql/database/authentication-microsoft-entra-connect-to-azure-sql?view=azuresql
- https://learn.microsoft.com/en-us/azure/azure-sql/database/azure-sql-dotnet-entity-framework-core-quickstart?view=azuresql
- https://learn.microsoft.com/en-us/azure/azure-sql/database/azure-sql-dotnet-quickstart?view=azuresql
- https://learn.microsoft.com/en-us/azure/azure-sql/database/connect-query-content-reference-guide?view=azuresql
- https://learn.microsoft.com/en-us/azure/azure-sql/database/connect-query-go?view=azuresql
- https://learn.microsoft.com/en-us/azure/azure-sql/database/connect-query-java?view=azuresql
- https://learn.microsoft.com/en-us/azure/azure-sql/database/connect-query-ssms
- https://learn.microsoft.com/en-us/azure/azure-sql/database/connect-query-ssms?view=azuresql
- **VERIFIED** — https://learn.microsoft.com/en-us/azure/azure-sql/database/connectivity-architecture
- https://learn.microsoft.com/en-us/azure/azure-sql/database/connectivity-architecture?view=azuresql
- https://learn.microsoft.com/en-us/azure/azure-sql/database/connectivity-settings
- https://learn.microsoft.com/en-us/azure/azure-sql/database/connectivity-settings?view=azuresql
- https://learn.microsoft.com/en-us/azure/azure-sql/database/firewall-configure?view=azuresql
- https://learn.microsoft.com/en-us/azure/azure-sql/database/firewall-create-server-level-portal-quickstart?view=azuresql
- https://learn.microsoft.com/en-us/azure/azure-sql/database/private-endpoint-overview
- https://learn.microsoft.com/en-us/azure/azure-sql/database/private-endpoint-overview?view=azuresql
- https://learn.microsoft.com/en-us/azure/azure-sql/database/security-overview?view=azuresql
- https://learn.microsoft.com/en-us/azure/azure-sql/database/single-database-create-quickstart?view=azuresql
- https://learn.microsoft.com/en-us/azure/azure-sql/database/troubleshoot-common-connectivity-issues
- https://learn.microsoft.com/en-us/azure/azure-sql/database/troubleshoot-common-connectivity-issues?view=azuresql
- **VERIFIED** — https://learn.microsoft.com/en-us/azure/azure-sql/database/troubleshoot-common-errors-issues
- https://learn.microsoft.com/en-us/azure/azure-sql/database/troubleshoot-common-errors-issues?view=azuresql
- https://learn.microsoft.com/en-us/azure/azure-sql/database/vnet-service-endpoint-rule-overview?view=azuresql

### Azure SQL Managed Instance

- https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/connect-application-instance
- **VERIFIED** — https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/connection-types-overview
- https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/connection-types-overview?view=azuresql
- **VERIFIED** — https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/connectivity-architecture-overview
- https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/connectivity-architecture-overview?view=azuresql
- https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/doc-changes-updates-known-issues?view=azuresql
- https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/private-endpoint-overview
- https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/private-endpoint-overview?view=azuresql
- https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/public-endpoint-overview

### SQL Server on Azure VM

- https://learn.microsoft.com/en-us/azure/azure-sql/virtual-machines/windows/configure-azure-ad-authentication-for-sql-vm
- https://learn.microsoft.com/en-us/azure/azure-sql/virtual-machines/windows/configure-azure-ad-authentication-for-sql-vm?view=azuresql
- https://learn.microsoft.com/en-us/azure/azure-sql/virtual-machines/windows/ways-to-connect-to-sql
- https://learn.microsoft.com/en-us/azure/azure-sql/virtual-machines/windows/ways-to-connect-to-sql?view=azuresql

### Microsoft Fabric

- **VERIFIED** — https://learn.microsoft.com/en-us/fabric/data-warehouse/connectivity
- https://learn.microsoft.com/en-us/fabric/data-warehouse/entra-id-authentication
- https://learn.microsoft.com/en-us/fabric/data-warehouse/how-to-connect
- https://learn.microsoft.com/en-us/fabric/database/sql/authentication
- **VERIFIED** — https://learn.microsoft.com/en-us/fabric/database/sql/connect
- https://learn.microsoft.com/en-us/fabric/database/sql/tutorial-service-connector
- https://learn.microsoft.com/en-us/fabric/security/fabric-allow-list-urls
- https://learn.microsoft.com/en-us/fabric/security/security-private-links-overview
- https://learn.microsoft.com/en-us/fabric/security/security-workspace-level-private-links-overview
- https://learn.microsoft.com/en-us/fabric/security/security-workspace-level-private-links-support

### Drivers and clients

- https://learn.microsoft.com/en-us/sql/connect/ado-net/connection-string-syntax?view=sql-server-ver17
- **VERIFIED** — https://learn.microsoft.com/en-us/sql/connect/ado-net/sql/azure-active-directory-authentication
- https://learn.microsoft.com/en-us/sql/connect/ado-net/sql/azure-active-directory-authentication?view=sql-server-ver16
- https://learn.microsoft.com/en-us/sql/connect/ado-net/sql/azure-active-directory-authentication?view=sql-server-ver17
- https://learn.microsoft.com/en-us/sql/connect/golang/azure-sql
- https://learn.microsoft.com/en-us/sql/connect/golang/connection-strings?view=sql-server-ver17
- https://learn.microsoft.com/en-us/sql/connect/golang/entra-authentication?view=sql-server-ver17
- https://learn.microsoft.com/en-us/sql/connect/golang/faq
- https://learn.microsoft.com/en-us/sql/connect/golang/faq?view=sql-server-ver17
- https://learn.microsoft.com/en-us/sql/connect/golang/microsoft-go-mssqldb-driver
- https://learn.microsoft.com/en-us/sql/connect/golang/microsoft-go-mssqldb-driver?view=sql-server-ver17
- **VERIFIED** — https://learn.microsoft.com/en-us/sql/connect/jdbc/connecting-using-azure-active-directory-authentication
- https://learn.microsoft.com/en-us/sql/connect/jdbc/connecting-using-azure-active-directory-authentication?view=sql-server-ver16
- https://learn.microsoft.com/en-us/sql/connect/jdbc/connecting-using-azure-active-directory-authentication?view=sql-server-ver17
- https://learn.microsoft.com/en-us/sql/connect/odbc/using-azure-active-directory
- https://learn.microsoft.com/en-us/sql/connect/odbc/using-azure-active-directory?view=sql-server-ver17
- https://learn.microsoft.com/en-us/sql/tools/sqlcmd/sqlcmd-authentication?view=sql-server-ver17
- https://learn.microsoft.com/en-us/sql/tools/sqlcmd/sqlcmd-use-utility?view=sql-server-ver17
- https://learn.microsoft.com/en-us/sql/tools/sqlcmd/sqlcmd-utility
- https://learn.microsoft.com/en-us/ssms/f1-help/connect-to-server-login-page-database-engine

### Networking, Private Link and DNS

- **VERIFIED** — https://learn.microsoft.com/en-us/azure/private-link/private-endpoint-dns
- https://learn.microsoft.com/en-us/azure/private-link/private-endpoint-dns-integration
- https://learn.microsoft.com/en-us/azure/private-link/tutorial-private-endpoint-sql-portal

### Other

- https://learn.microsoft.com/en-us/answers/questions/606267/redirect-connection-policy-when-hitting-azure-sql
- https://learn.microsoft.com/en-us/azure/developer/go/
- https://learn.microsoft.com/en-us/java/api/overview/azure/sql?view=azure-java-stable
- https://learn.microsoft.com/en-us/python/api/overview/azure/sql?view=azure-python
- https://learn.microsoft.com/en-us/sql
- https://learn.microsoft.com/en-us/sql/relational-databases/errors-events/database-engine-events-and-errors-31000-to-41399?view=sql-server-ver17
- https://learn.microsoft.com/en-us/sql/relational-databases/errors-events/database-engine-events-and-errors-4000-to-4999?view=sql-server-ver17
- https://learn.microsoft.com/en-us/sql/relational-databases/errors-events/mssqlserver-18456-database-engine-error
- https://learn.microsoft.com/en-us/sql/relational-databases/errors-events/mssqlserver-18456-database-engine-error?view=sql-server-ver17
- https://learn.microsoft.com/en-us/sql/relational-databases/security/authentication-access/azure-ad-authentication-sql-server-setup-tutorial?view=sql-server-ver17
- https://learn.microsoft.com/en-us/troubleshoot/sql/database-engine/connect/network-related-or-instance-specific-error-occurred-while-establishing-connection
