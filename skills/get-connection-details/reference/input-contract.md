# Input contract — `get-connection-details`

> **Draft, v0.6.** This contract belongs to `get-connection-details` only. The
> `recommend-migration-path` contracts live at [`reference/input-contract.md`](../../../reference/input-contract.md)
> and are not affected by anything here.

What the interview may produce. Every value the skill collects is one of the identifiers below, or
one of the three absence markers. Free text is never promoted to a decision input.

The identifiers are the vocabulary of
[`connectivity-matrix.json`](connectivity-matrix.json), so a value collected here can be looked up
there without translation. That is the point: the migration skill needed 73 option IDs agreed after
the fact, and reconciling vocabulary later is far more expensive than agreeing it first.

---

## 1. Absence markers

Three states that are routinely collapsed into one, and must not be:

| Marker | Means | Consequence |
| --- | --- | --- |
| `NONE_CONFIRMED` | Someone checked and the answer is none | Can be used as a fact |
| `UNKNOWN` | Nobody checked | Must be reported as a gap, never defaulted |
| `NOT_APPLICABLE` | The question does not apply to this target | Excluded from the answer, not left blank |

A connection string built on `UNKNOWN` is a guess. Say so rather than emitting one.

---

## 2. Fields

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `target` | `target_id` | yes | The one field with no sensible default |
| `network_path` | `network_path` | yes | Decides FQDN, ports and DNS together |
| `client_location` | `inside-azure` \| `outside-azure` \| `UNKNOWN` | yes | Not cosmetic: under the `Default` connection policy it changes the required ports |
| `auth_mode` | `auth_mode` | yes | Restricted by target — see §5 |
| `driver` | `driver` | when composing | Skippable when the user only wants ports |
| `driver_version` | version string \| `UNKNOWN` | conditional | Required when the auth mode has a minimum version; gates Redirect on private endpoints |
| `connection_policy` | `redirect` \| `proxy` \| `default` \| `UNKNOWN` | no | Forced on some paths regardless of the setting |
| `error_number` | integer \| `NONE_CONFIRMED` | when diagnosing | The single most useful field in diagnosis mode |
| `error_state` | integer \| `UNKNOWN` | no | `18456` without its state does not identify one cause |
| `symptom` | `timeout` \| `login-failed` \| `name-not-resolved` \| `connection-aborted` \| `works-elsewhere` \| `UNKNOWN` | when diagnosing | Accepts a user who has no error number |
| `sql_server_version` | version \| `UNKNOWN` | conditional | Required for `sql-server-on-azure-vm`: Entra needs SQL Server 2022 or later |
| `edition` | `developer` \| `express` \| `standard` \| `enterprise` \| `UNKNOWN` | conditional | Developer and Express VM images do not enable TCP/IP |
| `domain_joined` | boolean \| `UNKNOWN` | conditional | Windows authentication requires it on a VM |

**Never collected, never stored:** passwords, keys, SAS tokens, client secrets, connection strings
containing any of them. If a user pastes one, do not echo it back.

---

## 3. Identifiers

Exact tokens. Do not rename, translate, abbreviate or pluralise.

### `target_id`

`azure-sql-database` · `azure-sql-managed-instance` · `sql-server-on-azure-vm` ·
`fabric-sql-database` · `fabric-warehouse`

### `network_path`

`public-endpoint` · `private-endpoint` · `vnet-local` · `service-endpoint`

`vnet-local` is Managed Instance only. `service-endpoint` is not yet backed by a verified row and
must return "not researched" rather than an inferred answer.

### `auth_mode`

`entra-default` · `entra-interactive` · `entra-device-code` · `entra-managed-identity-system` ·
`entra-managed-identity-user` · `entra-service-principal` · `entra-service-principal-certificate` ·
`entra-workload-identity` · `entra-integrated` · `sql-authentication`

`entra-default` is **not** a synonym for managed identity. It is a credential chain that also
covers developer tooling and the CLI, and it does not exist in ODBC at all.

### `driver`

`dotnet-sqlclient` · `jdbc` · `odbc` · `pyodbc` · `go-mssqldb` · `sqlcmd` · `bcp` · `ssms`

`pyodbc` and `go-mssqldb` have no verified rows. Say so; do not infer their spelling from ODBC or
JDBC, which spell the same concepts differently.

---

## 4. Question order, and why

Ask one at a time. Stop as soon as the answer is determined — an interview that continues after it
has what it needs is a cost, not a courtesy.

1. **Target.** Everything else is conditioned on it.
2. **Network path.** Decides FQDN, ports and DNS together.
3. **Where the client runs.** Under `Default` this changes the firewall requirement, which is why
   the same application works from a laptop and times out from App Service.
4. **Auth mode**, then **driver** and version if composing a string.
5. **Error number and state**, if diagnosing.

Skip anything already stated. Accept "I don't know" and carry it as `UNKNOWN`.

---

## 5. Conditional validity

Combinations the interview must not accept silently. Each is a documented restriction, not a
preference.

| Condition | Rule |
| --- | --- |
| `fabric-sql-database` or `fabric-warehouse` + `sql-authentication` | Invalid. Entra is the only identity provider on both |
| `sql-server-on-azure-vm` + any `entra-*` + version below 2022 | Invalid. Entra needs SQL Server 2022 or later |
| `sql-server-on-azure-vm` + `entra-integrated` + `domain_joined = false` | Invalid. Windows authentication requires a domain-joined VM in a VNet |
| `odbc` + `entra-default` | Invalid. The ODBC value list is closed and has no default-credential mode |
| `odbc` + `entra-interactive` on Linux or macOS | Invalid. Windows driver only |
| `vnet-local` + any target other than Managed Instance | Invalid |
| `private-endpoint` + `redirect` + `driver_version` unknown | Ask. Redirect is driver-gated; JDBC needs 9.4 or above and other drivers are proxied |

When a combination is invalid, name the restriction and the alternative. Do not silently choose a
different value on the user's behalf.

---

## 6. What the contract does not cover

Recorded so the boundary is a decision rather than an omission:

- `Public network access`, logical firewall rules, VNet rules and service tags — they gate the
  connection *before* any field here applies.
- Named instances, dynamic ports and SQL Browser on UDP 1434.
- Availability group listeners, `MultiSubnetFailover` and `ApplicationIntent`.
- Fabric tenant-level versus workspace-level Private Link.

These are listed in §7.5 of the knowledge base. A question that lands in one of them is answered
with "not researched", never with an inference.
