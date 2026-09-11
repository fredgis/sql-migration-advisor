> **Migration prerequisite plan — `<path title>`**
> **`<overallStatus>`** · `<blockingMissing>` blocker(s) missing · `<blockingUnknown>` blocker(s) unknown · `<blockingReported>` blocker(s) reported
> Prerequisite KB **`<version>`** · path **`<pathId>`** · target **`<targetVariant>`** · evaluated **`<timestamp>`**

`<one sentence explaining the readiness verdict without selecting or changing the migration path>`

**🧩 Route**

| | |
| --- | --- |
| Method path | `<selectedMethodPath.id>` — `<selectedMethodPath.title>` |
| Target family | `<selectedMethodPath.targetVariant>` |
| Platform overlays | `<one row per appliedOverlays[] entry: id — title (role): why, or "none">` |

Render one overlay row per entry in `appliedOverlays[]`. An AVS-hosted SQL Server carries `P27`
here alongside the method path that moves the data; dropping it makes the Markdown disagree with
the JSON, which invariant 11 forbids.

**When `overallStatus` is `unresolved_path`, render this instead of everything below and stop:**

> **Migration prerequisite plan — not resolved**
> `<unresolvedReason>`
>
> | Closest catalog paths | Target | Method |
> | --- | --- | --- |
> | `<candidatePaths[].id>` | `<candidatePaths[].target>` | `<candidatePaths[].method>` |
>
> `<disambiguation>`

A refusal and a plan never mix, so no readiness summary, prerequisite table, blocker list or source
register appears in an unresolved response.

**📊 Readiness summary**

| Area | Confirmed | Reported | Missing | Unknown | Not applicable |
| --- | ---: | ---: | ---: | ---: | ---: |
| `<area>` | `<count>` | `<count>` | `<count>` | `<count>` | `<count>` |

Reported items are counted apart from confirmed ones. They are answers the skill was given and has
no way to check, so a plan whose blockers are all reported reaches `ready_with_conditions` and
never `ready`.

**📋 Prerequisites**

| Area | Prerequisite | Status | Blocking | Owner | Evidence required | Official source |
| --- | --- | --- | :---: | --- | --- | --- |
| `<area>` | `<requirement>` | `<✅ confirmed / 🗣 reported / ❌ missing / ❓ unknown / ➖ not applicable>` | `<yes/no>` | `<role>` | `<evidence>` | `<source title>` |

**🚧 Blocking actions**

1. `<missing or unknown blocking prerequisite and the evidence/action that resolves it>`

**❓ Remaining unknowns**

- `<unknown>` — `<why it matters>`

**🧾 Assumptions and inherited Advisor facts**

- `<fact or assumption>` — `<basis>`

**➡️ Next actions**

1. `<highest-priority readiness action>`

**🔗 Official source register**

- [`<source title>`](`<public URL>`) — verified `<YYYY-MM-DD>`
