# Worked example — the same code, two environments, one timeout

A full session: the report, the interview, the card, and what happens next. Every value comes from
[`../reference/connectivity-matrix.json`](../reference/connectivity-matrix.json), and each carries
the status that row holds — `VERIFIED` where a quote sits behind it, `DERIVED` where only the page
does.

---

## The report

> "My Java app connects to our Managed Instance from my laptop. Deployed to App Service, it times
> out. Nothing changed in the code."

This is the ticket that gets passed between three teams. The developer says the code works. The
network team says the port is open. The DBA says the database is answering. **All three are telling
the truth**, which is why it survives a week.

## The interview

Five questions, one at a time. None about the code.

> **Skill** — Which target? Managed Instance, from what you describe — confirm?
>
> **Developer** — Yes, MI.
>
> **Skill** — What is the exact hostname in the connection string? Paste it as it is, don't
> reconstruct it.
>
> **Developer** — `contoso-mi.abc123def456.database.windows.net`, port 1433.
>
> **Skill** — That is the VNet-local endpoint. Is the App Service VNet-integrated?
>
> **Developer** — No.
>
> **Skill** — Then it has no route to that address. Is the instance's **public endpoint** enabled?
> It is off by default.
>
> **Developer** — I don't know.
>
> **Skill** — That decides between two different fixes. Last one: which driver and version, and
> system-assigned or user-assigned identity?
>
> **Developer** — JDBC 12.4, system-assigned.

The third question is the one that resolves the case, and it is asked because **the answer changes
the diagnosis**, not to build a profile.

## The diagnosis

The hostname is the VNet-local endpoint: `<mi-name>.<dns-zone>.database.windows.net` on 1433. It
resolves to an address inside the instance's subnet, reachable only from that virtual network.

The laptop reaches it because the corporate VPN routes into that network. The App Service, without
VNet integration, has no route to it at all — so the TCP handshake never completes and the client
waits until it gives up. **A timeout, not an authentication error**, which is why the port is the
last thing anyone suspects.

**The same connection string cannot be made to work by changing networks.** The public endpoint is
a different hostname — `.public.` is inserted — on a different port. Both must change together.

## The card

> **Azure SQL Managed Instance** · reached via the VNet-local endpoint · client has no route
> KB **v0.7** · endpoint shapes and ports VERIFIED · JDBC keyword VERIFIED
>
> Your connection string names the VNet-local endpoint, which only exists inside the instance's
> virtual network. The VPN puts your laptop in that network; the App Service is not in it. There are
> two ways out, and they are not the same string.
>
> **Option A — VNet-integrate the App Service** *(keeps traffic private)*
>
> ```text
> jdbc:sqlserver://contoso-mi.<dns-zone>.database.windows.net:1433;databaseName=<database>;authentication=ActiveDirectoryManagedIdentity;encrypt=true;trustServerCertificate=false
> ```
>
> The string is unchanged. Enable regional VNet integration into a delegated subnet with a route to
> the MI subnet, and confirm the name resolves to the private address from inside the app.
>
> **Option B — use the public endpoint** *(different host and port)*
>
> ```text
> jdbc:sqlserver://contoso-mi.public.<dns-zone>.database.windows.net:3342;databaseName=<database>;authentication=ActiveDirectoryManagedIdentity;encrypt=true;trustServerCertificate=false
> ```
>
> | | Requirement |
> | --- | --- |
> | Public endpoint | Must be **enabled** on the instance — it is off by default |
> | Hostname | Read it from the portal. `.public.` is inserted, and the DNS zone stays the same |
> | Port | **3342**, not 1433. Allow it inbound across the subnet range |
> | Connection type | Proxy, forced. The instance-level setting is ignored on this endpoint |
> | Driver | `ActiveDirectoryManagedIdentity` needs JDBC 12.2+. You are on 12.4. System-assigned, so no `msiClientId` |
> | Identity | The identity must exist as a user **inside the target database** |
> | Not usable for | Failover groups and Managed Instance link — client traffic only |
>
> **What will break Option B** — setting the instance connection type to Redirect. It is ignored on
> the public endpoint, so the change looks applied and does nothing.
>
> **Verify** — `Test-NetConnection contoso-mi.public.<dns-zone>.database.windows.net -Port 3342`.
> Success proves TCP reaches that port and nothing further; a failure does not by itself prove the
> NSG is responsible — DNS, a route table, an appliance or a disabled endpoint produce the same
> result.

## What happens next

Either outcome moves the ticket, and neither closes it on its own:

- **The check succeeds** — the network path is open. If the app still fails, the next layer is
  identity: is the managed identity a user in that database?
- **The check fails** — the path is blocked, but *where* is still open. Resolve the name first, then
  test the port from inside the App Service, then look at the NSG.

The value is not the answer alone. It is ending the three-way ping-pong with a test whose result
changes what you look at next.

---

# Second example — the error that misleads

> "Error 18456, login failed. But only from the corporate network."

Every signal says authentication. The credential works elsewhere, so the natural next steps are
resetting the secret and re-granting the user.

## The card

> **Error 18456 from one network only** · leading hypothesis **DNS override**
> KB **v0.7** · the DNS-override behaviour is VERIFIED; its attribution to this case is a hypothesis
>
> The gateway validates the FQDN it receives against the target server. A name pinned to a retired
> gateway address is rejected by design, and the rejection is reported as a login failure. The same
> cause produces **40532** and **40615**.
>
> | | |
> | --- | --- |
> | Hypothesis | A DNS override pins the server FQDN to a stale gateway address |
> | Evidence for | The credential works from other networks; the failure is confined to one |
> | Discriminating test | Compare client resolution with authoritative DNS. A mismatch confirms it; a match rules it out |
> | If ruled out | Next candidates: a network-scoped firewall rule, a proxy or appliance rewriting the connection, a client-side TLS or certificate policy, or `Public network access` disabled — error 47073 |
>
> **Why the symptom misleads** — the error names authentication, so the instinct is to reset the
> secret. That is likely to find nothing here, but the credential is not *proven* correct until the
> discriminating test comes back.
>
> **Verify** — `Resolve-DnsName -Name "<server>.database.windows.net" -DnsOnly`, compared with
> authoritative DNS.

The hypothesis row is what earns the card. Naming a cause without naming the test that would
disprove it is how a plausible answer becomes a wasted afternoon.

---

## Why these two cases justify a skill

1. **The facts are counter-intuitive.** The public endpoint is a different hostname *and* port. TCP/IP
   is disabled by default on Developer and Express VM images. ODBC has no `ActiveDirectoryDefault`.
2. **They carry a status.** `VERIFIED` where a quote sits behind the row, `DERIVED` where only the
   page does, `CONFLICT` where Microsoft's own sources disagree. The card says which.
3. **The symptom points at the wrong layer** — a timeout that is not a port problem, an
   authentication error that is a DNS problem, a failed connection caused by a missing package.

Examples use sanitised placeholders. Keep customer names, tenant details, server names and
subscription identifiers out of them.
