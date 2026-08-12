# Worked example — the same code, two environments, one timeout

A full session, shown end to end: the report, the interview, the card, and what happens next.
Every value used here is VERIFIED in
[`../reference/connectivity-matrix.json`](../reference/connectivity-matrix.json) against a live
Microsoft page, and the card follows the shape defined in [`../SKILL.md`](../SKILL.md).

---

## The report

> "My Java app connects to our Managed Instance from my laptop. Deployed to App Service, it times
> out. Nothing changed in the code."

This is the ticket that gets passed between three teams. The developer says the code works. The
network team says the port is open. The DBA says the database is answering. **All three are telling
the truth**, which is why it survives a week.

A generic answer — *"check that port 1433 is open and your connection string is correct"* — is
plausible and wrong, and it sends the network team to look at a port that was never involved.

## The interview

Four questions, one at a time. None of them about the code.

> **Skill** — Which target? Managed Instance, from what you describe — confirm?
>
> **Developer** — Yes, MI.
>
> **Skill** — Which network path does the App Service use: public endpoint, private endpoint, or is
> it VNet-integrated?
>
> **Developer** — No VNet integration, so public I assume.
>
> **Skill** — And from your laptop, are you on the corporate VPN?
>
> **Developer** — Yes.
>
> **Skill** — Last one: which driver, and which authentication mode?
>
> **Developer** — JDBC, with the App Service managed identity.

The third question is the one that resolves the case. It is asked because the answer changes which
endpoint is in play, not to build a profile.

## The card

> **Azure SQL Managed Instance** · public endpoint · **port 3342** · connection type **Proxy (forced)**
> KB **v0.2** · all rows VERIFIED
>
> Your laptop and your App Service are not reaching the same endpoint. Over VPN you reach the
> **VNet-local endpoint on 1433**. From App Service outside the VNet you reach the **public
> endpoint, which listens on 3342**. The same string names 1433 in both places, so it resolves the
> right server on a port nothing listens on — a timeout rather than an authentication error, which
> is why the port is the last thing anyone suspects.
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
>
> *Source: "Public endpoint accepts connections on port 3342." —
> [MI connectivity architecture](https://learn.microsoft.com/en-us/azure/azure-sql/managed-instance/connectivity-architecture-overview)*

## What happens next

The developer runs the check. Thirty seconds. Either outcome moves the ticket:

- **It succeeds** — the port was the problem. Change the string, done.
- **It fails** — the NSG is blocking 3342. The question stops being *"why does it time out"* and
  becomes *"who opens the rule"*, which is a conversation with the network team rather than an
  investigation.

Both outcomes end the three-way ping-pong, which is the actual deliverable.

---

# Second example — the error that lies about its own cause

> "Error 18456, login failed. But only from the corporate network."

Every signal says authentication. The credential works elsewhere, so the natural next steps are
resetting the secret and re-granting the user. Both find nothing.

## The card

> **Error 18456 from one network only** · probable cause **DNS override**, not credentials
> KB **v0.2** · all rows VERIFIED
>
> The gateway validates the FQDN it receives against the target server. A name pinned to a retired
> gateway address is rejected by design, and the rejection is reported as a login failure. The same
> cause produces **40532** and **40615**.
>
> | | Check |
> | --- | --- |
> | First | `hosts` file, static CNAME, or a private DNS zone pinning the server FQDN |
> | Then | Client resolution against authoritative DNS — a mismatch confirms the override |
> | **Not this** | The credential. It is correct, which is why it works from every other network |
>
> **Why every instinct is wrong here** — the symptom names authentication, so the natural next
> steps are resetting the secret and re-granting the user. Both find nothing, because nothing is
> wrong with either.
>
> **Verify** — `Resolve-DnsName -Name "<server>.database.windows.net" -DnsOnly`, compared with
> authoritative DNS.
>
> *Source: "Login attempts that go directly to an IP address (or to a stale IP through a DNS
> override) fail by design." —
> [Troubleshoot common connection issues](https://learn.microsoft.com/en-us/azure/azure-sql/database/troubleshoot-common-errors-issues)*

The **Not this** row is the one that earns the card. Without it the reader goes to the credential
anyway, because that is what the error says.

---

## Why these two cases justify a skill

1. **The facts are counter-intuitive.** Port 3342. TCP/IP disabled by default on Developer and
   Express VM images. No `ActiveDirectoryDefault` in ODBC.
2. **They are sourced and verified**, not produced by plausibility. The stamp `KB v0.2 · all rows
   VERIFIED` carries a specific promise: every value in the card was matched against a live
   Microsoft page. The `3342` is not a probability.
3. **The symptom consistently points at the wrong layer** — a timeout that is not a network
   problem, an authentication error that is a DNS problem, a failed connection caused by a missing
   NuGet package.

The third is the real argument. These are exactly the cases where an untooled model answers
confidently and wrongly, and where the wrong answer costs a day of three teams' time.

Examples use sanitised placeholders. Keep customer names, tenant details, server names and
subscription identifiers out of them.
