# Worked example — the same code, two environments, one timeout

A realistic session, shown end to end. Every fact used here is VERIFIED in
[`../reference/connectivity-matrix.json`](../reference/connectivity-matrix.json) against a live
Microsoft page.

---

## The report

> "My Java app connects to our Managed Instance from my laptop. Deployed to App Service, it times
> out. Nothing changed in the code."

This is the ticket that gets passed between three teams. The developer says the code works. The
network team says the port is open. The DBA says the database is answering. All three are telling
the truth.

## What a generic answer produces

> "Check that port 1433 is open and that your connection string is correct."

Plausible, and wrong here. It sends the network team looking at a port that was never involved.

## The interview

Four questions, one at a time.

| Question | Answer |
| --- | --- |
| Which target? | `azure-sql-managed-instance` |
| Which network path? | Public endpoint |
| Where does the client run? | App Service, outside the VNet |
| Which driver? | `jdbc` |

## The diagnosis

The laptop and the App Service are not reaching the same endpoint.

From the laptop, over VPN, the app reaches the **VNet-local endpoint on port 1433**. From App
Service outside the VNet, it reaches the **public endpoint, which listens on 3342**.

> "Public endpoint accepts connections on port 3342."
> — [Connectivity architecture for MI](https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/connectivity-architecture-overview)

The connection string is identical in both environments and names port 1433. It resolves the right
server and tries a port the public endpoint does not listen on. That produces a **timeout, not an
authentication error**, which is exactly why nobody suspects the port: an auth failure would have
pointed at credentials within minutes.

## The answer

```text
Server = <mi-name>.public.<dns-zone>.database.windows.net,3342
authentication=ActiveDirectoryManagedIdentity
```

Everything else that has to be true:

- **Port 3342**, not 1433. Specific to the MI public endpoint.
- **NSG rule: inbound 3342 across the entire subnet range**, never a single IP — the underlying
  address can change.

  > "always use its domain name and allow inbound traffic on port 3342 across the entire subnet
  > range, as the underlying IP address can occasionally change."

- **Proxy connection type is forced** on this endpoint. The instance-level setting is ignored, so
  changing it will not help and is a common wasted step.

  > "Public endpoint always uses the Proxy connection type regardless of the connection type
  > setting."

- **Identity prerequisite**: the App Service managed identity must exist as a user *inside the
  database*. Being able to sign in to Azure is not the same as being able to open the database.

## The verification

```powershell
Test-NetConnection <mi-name>.public.<dns-zone>.database.windows.net -Port 3342
```

Ten seconds, and the answer is falsifiable. If this succeeds and the application still fails, the
problem is authentication, not the network — and the next question changes accordingly.

---

# Second example — the error that lies about its own cause

> "Error 18456, login failed. But only from the corporate network."

Everything about the symptom says authentication. The credential is correct elsewhere, so the
natural next steps are checking the login, resetting the secret, re-granting the user. All of them
find nothing.

**A DNS override pinning the server FQDN to a retired gateway IP produces exactly this**, because
the gateway validates the FQDN it receives against the target server.

> "Login attempts that go directly to an IP address (or to a stale IP through a DNS override) fail
> by design. The Azure SQL gateway requires the correct FQDN to route connections to the intended
> server."
> — [Troubleshoot common connection issues](https://learn.microsoft.com/en-us/azure/azure-sql/database/troubleshoot-common-errors-issues)

The same cause produces **18456, 40532 and 40615** — three errors that all read as credential or
firewall problems.

**What to check first**, before touching any credential:

```powershell
# Is the FQDN pinned locally?
Select-String -Path C:\Windows\System32\drivers\etc\hosts -Pattern 'database.windows.net'

# Does the client resolver disagree with authoritative DNS?
Resolve-DnsName -Name "<server>.database.windows.net" -DnsOnly
```

If the client resolver returns a different address than authoritative DNS, the cause is in a hosts
file, a static CNAME or a private DNS zone — and no amount of authentication work will fix it.

---

## Why these two cases justify a skill

1. **The facts are counter-intuitive.** Port 3342. TCP/IP disabled by default on Developer and
   Express VM images. No `ActiveDirectoryDefault` in ODBC.
2. **They are sourced and verified**, not produced by plausibility.
3. **The symptom consistently points at the wrong layer** — a timeout that is not a network
   problem, an authentication error that is a DNS problem, a failed connection caused by a missing
   NuGet package.

The third is the real argument. These are precisely the cases where an untooled model answers
confidently and wrongly, and where the wrong answer costs a day of three teams' time.
