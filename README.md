<h1 align="center">sql-migration-advisor</h1>

<p align="center">
  A <a href="https://docs.github.com/copilot/how-tos/use-copilot-agents/use-copilot-cli">GitHub Copilot CLI</a>
  skill that produces a preliminary, evidence-backed SQL Server → Azure migration recommendation —
  and the verified knowledge base behind it.
</p>

<p align="center">
  <img alt="GitHub Copilot CLI skill" src="https://img.shields.io/badge/GitHub%20Copilot%20CLI-skill-8957e5">
  <img alt="License MIT" src="https://img.shields.io/badge/license-MIT-blue">
  <img alt="Knowledge base v2.1" src="https://img.shields.io/badge/knowledge%20base-v2.1-2b8a3e">
  <a href="https://github.com/fredgis/sql-migration-advisor/actions/workflows/weekly-kb-check.yml"><img alt="Weekly KB check" src="https://github.com/fredgis/sql-migration-advisor/actions/workflows/weekly-kb-check.yml/badge.svg"></a>
  <a href="https://github.com/fredgis/sql-migration-advisor/actions/workflows/tests.yml"><img alt="Tests" src="https://github.com/fredgis/sql-migration-advisor/actions/workflows/tests.yml/badge.svg"></a>
</p>

<p align="center">
  <a href="https://fredgis.github.io/sql-migration-advisor/"><b>📖 Docs — how the skill works &amp; stays up to date →</b></a>
</p>

<p align="center">
  <img alt="One SQL Server, eight ways to Azure — the sql-migration-advisor skill" src="images/sql-migration-advisor-hero.png" width="100%">
</p>

### 🎬 See it in action

A short screen recording of the skill at work: you ask in plain language, answer the guided interview, and it returns a preliminary assessment path (target, method, downtime, blockers, confidence, and cost levers) sourced live from the knowledge base.

<video src="https://github.com/user-attachments/assets/5594fc75-4fb7-40a9-b9a1-0cc761c8aebe" poster="https://github.com/fredgis/sql-migration-advisor/raw/main/images/sql-migration-advisor-demo-poster.jpg" controls muted></video>

---

Ask Copilot *"migrate a SQL Server environment to Azure"* (or *"migrer SQL Server vers Azure"*).
The skill runs a short, structured interview, then returns a grounded, regression-tested
preliminary recommendation for assessment and validation:

- **Primary path** — target and method to assess first: SQL VM · AVS · SQL MI · SQL DB · Fabric SQL DB · Arc SQL MI · container · Arc in-place
- **Best alternative** — the strongest fallback path when trade-offs or unknowns remain
- **Exclusions** — why other targets were ruled out, including hard blockers and remediation options
- **Confidence** — status, assumptions, unknowns, and evidence required ([what the levels mean](#how-it-works))
- **Downtime class** — near-zero · minimal · offline
- **Cost levers** — Azure Hybrid Benefit · ESU; not a sizing or pricing estimate
- **Microsoft program** — Cloud Accelerate Factory · SQL in a Day

It never recommends retired tooling (DMA, the Azure Data Studio extension, DMS *classic*).

<video src="https://github.com/user-attachments/assets/c6108b23-af0b-45d6-9dd8-feb5bad9d679" controls muted></video>

![sql-migration-advisor recommendation card](docs/preview/sql-migration-advisor-skill.png)

Every recommendation is grounded in the knowledge base
[`docs/sql-server-to-azure-migration.md`](docs/sql-server-to-azure-migration.md), which the
skill fetches live. The result is a preliminary disposition, not a final migration verdict:
tool-based assessment and architect validation are mandatory before execution. Each output carries the
knowledge-base version, commit SHA and fetch timestamp so the advice is traceable.

## Why it is trustworthy

- **Verified knowledge** — the v2.1 knowledge base is source-backed and corrected against Microsoft Learn.
- **Rules under regression test** — Phase A filters hard eligibility, then Phase B ranks viable options and tiers. An executable mirror in `tests/` replays 106 scenarios through those rules on every commit. The mirror is not what runs in your session: an agent reads the rules and applies them, so this is a tested policy rather than a byte-identical guarantee.
- **Every decision is addressable** — the card cites a rule ID for each verdict, and [`reference/decision-rules.md`](reference/decision-rules.md) ends with an index of all 26. Look one up, read what it consumes and how it treats an unknown, and argue with it.
- **Explicit uncertainty** — every recommendation is `provisional`, and `medium` is the confidence ceiling. Nothing higher is reachable from an interview, because the skill reads no artefact from your estate. It carries assumptions, unknowns, blockers and the evidence a tool would have to produce.
- **It checks its own answer** — before the card is shown, the skill re-reads its draft against the 13 invariants in [`reference/output-contract.md`](reference/output-contract.md). One of them: no eligibility claim may rest on a field you never answered. A failed invariant is shown to you, never silently repaired.
- **Freshness gates** — version bumps require substantive diffs; link checks classify bot-blocked pages; high-risk claims are tracked in [`reference/claims-registry.json`](reference/claims-registry.json).
- **Regression protection** — [`tests/`](tests/) holds 106 golden scenarios and 23 gates wired into CI, plus a branch-coverage floor on the decision engine so a gate cannot exist over code no scenario reaches.

## Audit response

An external audit deliberately challenged the advisor before wider use. It found real P0 issues, and the project treated that as a strength: invite scrutiny, fix the facts, and make drift harder to miss.

| Audit finding | What changed |
| --- | --- |
| Over-confident final-advice framing | Repositioned as a discovery and pre-selection assistant with mandatory assessment-tool and architect validation. |
| Factual inaccuracies in hard gates | Knowledge base v1.5 corrects PolyBase, DTC, LRS, replication and cross-cloud method constraints. |
| Hidden uncertainty | Outputs carry confidence, assumptions, unknowns, hard blockers and evidence required. `validated` and `high` were later removed outright: the skill reads no artefact, so it cannot certify one. |
| Weak freshness governance | Version-gated automation, consistency checks and a claims registry prevent unearned version bumps and catch source drift. |
| Limited regression coverage | Golden scenarios and anti-regression gates now run in CI. |

A second external audit, in v2.0.0, went after the design rather than the facts. Its charge was that the repository tested what was easy to test rather than what made the decision. The response is [`docs/NEWDESIGNv2.md`](docs/NEWDESIGNv2.md): input and output contracts, a self-check the skill runs before it answers, an ordered ranking in place of an unweighted table, and a rule index that makes every verdict addressable.

---

## What's inside

| Path | Purpose |
| --- | --- |
| [`skills/get-migration-assessment/SKILL.md`](skills/get-migration-assessment/SKILL.md) | The skill — trigger description, principles, the two-tier interview (triage, then confirmation), and the output-card template. |
| [`reference/input-contract.md`](reference/input-contract.md) | What the interview may produce: 30 stable option IDs, 20 canonical field names, and the difference between *confirmed none* and *nobody checked*. |
| [`reference/output-contract.md`](reference/output-contract.md) | What an answer must look like, and the 13 invariants the skill checks against its own draft before showing it. |
| [`reference/decision-rules.md`](reference/decision-rules.md) | The decision policy: Phase A eligibility filter, Phase B ordered ranking and tier selection, and the index of all 26 addressable rules. |
| [`examples/sample-recommendation.md`](examples/sample-recommendation.md) | A worked end-to-end example (SQL 2014 → Azure SQL MI via LRS). |
| [`docs/sql-server-to-azure-migration.md`](docs/sql-server-to-azure-migration.md) | The knowledge base — every target family, method, tool, and commercial lever, with Microsoft Learn links. |
| [`reference/claims-registry.json`](reference/claims-registry.json) | Hashes and source pointers for high-risk claims, used by weekly drift detection. |
| [`docs/sql-server-to-azure-migration.pdf`](docs/sql-server-to-azure-migration.pdf) | The same knowledge base as a branded, partner-ready PDF. |
| [`lab/`](lab/) | A self-contained, hands-on lab: take a legacy SQL Server 2016 workload to a SQL Server on Azure VM, driven by the advisor and the HVE Squad (VM-to-VM migration). |
| [`howto/how-the-skill-works.md`](howto/how-the-skill-works.md) | Implementer's guide: how the skill works, how an agent uses it, and how the weekly Action keeps the knowledge base fresh (with architecture diagrams). |
| [`docs/sql-migration-advisor-developer-pitch.md`](docs/sql-migration-advisor-developer-pitch.md) | Developer pitch: runtime architecture, the decision process, the CI and pull-request gates, and how the knowledge base stays current. |
| [`blume/`](blume/) | Source for the online docs page — [fredgis.github.io/sql-migration-advisor](https://fredgis.github.io/sql-migration-advisor/) — a friendly overview of how the skill works and stays up to date. |
| [`tests/`](tests/) | Golden scenarios and anti-regression gates that keep the decision policy honest. |

The skill is prompt-driven markdown — no build step, no dependencies.

---

## Install as a Copilot CLI plugin

```bash
copilot plugin marketplace add fredgis/sql-migration-advisor
copilot plugin install sql-migration-advisor@fredgis
```

Then restart Copilot CLI (skills load at startup), run `/skills`, and confirm
**`get-migration-assessment`** is listed. Ask *"I want to migrate a SQL Server environment to
Azure"* and the interview starts.

Installing from a marketplace opens an interactive picker, so run the second command from a real
terminal or from `/plugin` inside a session. A single-command install also works:

```bash
copilot plugin install fredgis/sql-migration-advisor
```

To load it from a local clone instead, without installing anything:

```bash
git clone https://github.com/fredgis/sql-migration-advisor.git
copilot --plugin-dir ./sql-migration-advisor
```

### Three names, and why they differ

| Level | Name |
| --- | --- |
| Repository, and the marketplace it hosts | `sql-migration-advisor`, published under the marketplace `fredgis` |
| Plugin — the unit you install | `sql-migration-advisor` |
| **Skill — what actually triggers** | **`get-migration-assessment`** |

The skill was renamed in v2.0.0. `assessment-advisor` said what it was; `get-migration-assessment`
says what it does, and it produces an assessment rather than a decision. It also had to stop
colliding with the agent in `microsoft/sql-migration-agent`, the repository this is meant to be
contributed to.

> **Copying `SKILL.md` on its own no longer works.** The skill reads
> `../../reference/input-contract.md`, `../../reference/decision-rules.md` and
> `../../reference/output-contract.md`, which sit above it in the repository. Installing the whole
> plugin is what keeps the rules and the skill at the same commit — that pairing is the point, since
> a skill running against rules from a different version is exactly the drift this project exists to
> prevent.

Before v2.0.0 the skill was called `assessment-advisor` and was cloned directly into
`~/.copilot/skills/`. If you installed it that way, delete the old folder: two copies will both
match the trigger and you will not know which one answered.

```bash
# macOS / Linux
rm -rf ~/.copilot/skills/assessment-advisor
```

```powershell
# Windows (PowerShell)
Remove-Item -Recurse -Force "$env:USERPROFILE\.copilot\skills\assessment-advisor"
```

### 🔄 Already installed? Update it

The decision rules and the interview change over time (see [Keep it up to date](#keep-it-up-to-date)),
so refresh your copy now and then.

```bash
copilot plugin update sql-migration-advisor
```

Then **restart Copilot CLI** — skills load at startup, so an update isn't picked up until you do.

> Not urgent if you skip it: the skill **fetches the knowledge base live** on every run, so the
> facts stay current even on an older copy. Updating refreshes the *interview and the decision
> rules* — worth doing after a version bump.

---

## How it works

1. **Interview** — Copilot asks Tier 1 triage questions, then Tier 2 confirmations only when
   needed (source type, migration intent, feature dependencies, PolyBase/DTC subtype, size,
   downtime, sovereignty and tier-selection inputs). It asks in your language and skips what
   you've already stated.
2. **Filter + rank** — it applies Phase A eligibility rules, then Phase B ranking and tier
   selection in [`reference/decision-rules.md`](reference/decision-rules.md).
3. **Recommend for assessment** — it returns a per-database card with primary path, best
   alternative, exclusions, confidence, assumptions, unknowns, evidence required, downtime class,
   blockers + remediations, cost levers and program fit. It never recommends retired tooling
   (DMA, the Azure Data Studio extension, DMS *classic*).

See [`examples/sample-recommendation.md`](examples/sample-recommendation.md) for a full example.

<details>
<summary><b>🎚️ Reading the confidence level</b> — why <code>low</code> is a feature, not a failure</summary>

<br />

Confidence answers one question: **how much of this rests on something nobody has measured?**

| Level | What it means | How you get there |
| --- | --- | --- |
| 🔴 **low** | At least one decision-driving unknown remains, or two answers conflict | The default whenever something that would change the outcome is missing |
| 🟡 **medium** | Triage is complete and internally consistent, but nothing is tool-confirmed yet | Answer every question without a "not sure" |
| 🟢 **high** | Dependencies, sizing, regional availability and cutover feasibility are all measured | **Not reachable from the interview.** It needs the four evidence booleans |

`high` is deliberately out of reach of a conversation. It requires
`dependenciesToolConfirmed`, `performanceMeasured`, `regionAvailabilityConfirmed` and
`architectSignedOff` as typed values. Prose that mentions those phrases never substitutes for them,
so an assessment nobody ran cannot be talked into existence.

**To move from low to medium**, read the *Blockers & required evidence* section of your card. Every
unknown holding the score down is named there, with the assessment that would close it.

A `low` score is the skill telling you what it does not know. The dangerous output is the opposite:
a confident answer resting on evidence nobody supplied. Four defects fixed between v1.15 and v1.18
were exactly that, so a blank or unsure answer now resolves to `unknown_requires_assessment` rather
than to a pass.

</details>

<details>
<summary><b>🧪 Reading the coverage number</b> — what "engine branch coverage 92.27%" measures</summary>

<br />

It is **branch coverage over the decision engine only**, not over the whole repository. A branch is
each way an `if` can go. Take a real line from `tests/engine/evaluate.mjs`:

```js
if (perfStatedUnknown || smallDatabase) return 'General Purpose';
```

That single line holds four paths. If no scenario ever arrives with `perfStatedUnknown` true, that
path is **never executed by the suite**. It can contain anything at all and every test still passes.

So the number reads: **92 branches out of 100 are walked by at least one of the 90 golden
scenarios**, with every line and every function reached. The remaining 8% is combinations of
conditions no profile produces.

This is not academic. The `150 gb` defect fixed in v1.16, where the small-database signal also
matched the `150 GB – 4 TB` range and outranked an explicit "not sure", lived in an uncovered
branch. The gate existed, the suite was green, and the bug was in the part the suite never reached.

Some guards cannot be reached through `evaluate()` at all, because the engine only ever emits a
target and method that already satisfy each other. Those are safety nets rather than dead code, so
the `engine-guard-checks` gate exercises them directly instead of deleting them.

CI enforces a floor of **85%**, so a change that adds logic without adding a scenario to reach it
fails the build:

```powershell
node --experimental-test-coverage --test-coverage-include='tests/engine/**' `
     --test-coverage-branches=85 --test tests/run-tests.mjs
```

</details>

---

## Poster Skill AI

The whole engine on one page — not just the target choice, but everything the skill reasons
through: the **agentic loop** (grounds itself in the live knowledge base, interviews, applies the
rules in a fixed order, checks its own answer, then acts), the Tier 1/Tier 2 interview, Phase A
eligibility, Phase B ranking and tier selection, cutover downtime classes + blockers & remediations,
confidence and evidence requirements, cost levers, Microsoft program and the assessment tool to run
next — with the official Azure &amp; Microsoft Fabric service icons.

[![sql-migration-advisor — the complete AI decision logic](docs/sql-migration-advisor-poster.png)](docs/sql-migration-advisor-poster.png)

The hero banner above is the 15-second version — one SQL Server hub, eight Azure destinations,
each spoke labelled with its migration method.

Both are reproducible: `node tools/diagram/build.mjs` downloads the official
[Azure](https://learn.microsoft.com/en-us/azure/architecture/icons/) /
[Fabric](https://learn.microsoft.com/en-us/fabric/fundamentals/icons) icon packs (used per
their diagram terms, not redistributed), then renders
[`tools/diagram/poster.html`](tools/diagram/poster.html),
[`tools/diagram/radial.html`](tools/diagram/radial.html) and
[`tools/diagram/hero.html`](tools/diagram/hero.html) with headless Chrome.

---

## The knowledge base

[`docs/sql-server-to-azure-migration.md`](docs/sql-server-to-azure-migration.md) is a verified,
source-backed inventory of *every* way to migrate SQL Server to Azure:

- 8 target families — SQL VM, AVS, SQL MI, SQL DB, Fabric SQL DB, containers, Arc-enabled SQL MI, Arc in-place.
- The migration methods per target — MI Link · LRS · backup/restore · DAG · DMS · BACPAC · Fabric Migration Assistant.
- The 2025–2026 tooling reset — DMA / Azure Data Studio / DMS-classic retirements and their replacements.
- Downtime strategy, decision matrices, field pitfalls and third-party options.
- Commercial & funding levers — AHB / ESU / PAYG · Azure Accelerate · Cloud Accelerate Factory · SQL in a Day.

Everything is cross-checked against Microsoft Learn (current as of August 2026) with colored
Mermaid decision diagrams. The `SKILL.md` mirrors its AI Migration Agent I/O contract (§14).

---

## The knowledge base as a PDF

The same knowledge base ships as a polished, branded PDF —
[`docs/sql-server-to-azure-migration.pdf`](docs/sql-server-to-azure-migration.pdf) (25 pages,
v2.1, August 2026) — ready to hand to a partner or attach to a deal. It's generated reproducibly
from the Markdown (pandoc + xelatex, Mermaid rendered inline) in the shared *fabric-foundry-kb*
house style.

[![SQL → Azure migration knowledge base — PDF preview](docs/preview/sql-migration-advisor-pdf-preview.png)](docs/sql-server-to-azure-migration.pdf)

Inside: a branded cover + table of contents, the full targets / control-planes / methods
taxonomy with colored decision diagrams, colour-coded tables (blue headers · green = supported ·
red = N/A · grey = indirect) with content-sized columns, per-target method tables, the
2025–2026 tooling reset, downtime strategy, field pitfalls, third-party options, the commercial
& funding levers, and a closing appendix showing how to drive this skill.

Regenerate it locally with the committed pipeline — `node tools/pdf/build.mjs` then
`node tools/pdf/patchwork.mjs` (pandoc + xelatex + mermaid-cli, in the
[fabric-foundry-kb](https://github.com/fredgis/fabric-foundry-kb) house style).

---

## 🔄 Weekly freshness check

A scheduled GitHub Action —
[`.github/workflows/weekly-kb-check.yml`](.github/workflows/weekly-kb-check.yml) — keeps the
knowledge base current **every Monday** (~07:00 Europe/Paris — 05:00 UTC), so the advisor never drifts:

1. **Consistency gate.** `tools/weekly-check/check-consistency.mjs` blocks the run when the
   knowledge base, decision rules and README badge disagree on the current version.
2. **Link classification.** URLs are classified as `ok`, `unreachable` or
   `unverified-bot-blocked` (for HTTP 403/429), so bot blocking is never mistaken for a healthy
   source.
3. **News + claims drift.** Official Azure / SQL Server feeds are scanned, and
   [`reference/claims-registry.json`](reference/claims-registry.json) hashes the source sections
   behind high-risk claims to catch silent Microsoft Learn edits.
4. **AI review.** An **Azure AI Foundry** model deployment reviews the evidence and produces a
   report. Authentication is Entra ID via **GitHub OIDC** — no API key and no stored client
   secret. Broken links and AI verdicts are report-only until a human applies the substantive fix.
5. **Gated update.** A version bump requires `--substantive` plus a verified content diff versus
   `HEAD`. Housekeeping can refresh stamps without a version bump or changelog row. When a real
   change is applied, the workflow opens a Pull Request with the evidence and regenerated PDF
   artifacts for review.

Every run writes a consistency, link, news, claims and AI-review summary to the Actions run, and
you can trigger it on demand from the **Actions** tab (*Run workflow*). The document carries a
visible version and a collapsible changelog (§17) so every substantive update is traceable.

> Enable *Settings → Actions → General → "Allow GitHub Actions to create and approve pull
> requests"* so the weekly job can open its PR.
>
> The AI review step needs five repository secrets pointing at your own model deployment:
> `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_AI_ENDPOINT` and
> `AZURE_AI_DEPLOYMENT`, plus a federated credential on the app registration for this repository.
> Without them the review step is simply skipped — every other check still runs.

---

## Keep it up to date

The decision rules track Microsoft tooling changes (retirements, version gates, previews). The
consistency gate keeps [`reference/decision-rules.md`](reference/decision-rules.md), the knowledge
base and this README on the same version. Last verified: August 2026.

<!-- CHANGELOG:START -->
<details>
<summary><b>📓 Changelog</b> — current: <b>v2.1</b> (August 2026)</summary>

| Version | Date | Summary |
| --- | --- | --- |
| v2.1 | 2026-08-10 | Second audit response, and no knowledge-base fact changed. The audit scored v2.0 at 8/10 and named the gap it had left: the contracts were written, but nothing proved the *interview* obeys them. A real session answered in six option IDs the contract had never heard of and collected eight undeclared fields while every gate stayed green. The contract now covers 72 option IDs instead of 30, a gate checks the interview against it, and the network question became three because bandwidth, MI Link ports and Blob reachability gate different things. Two rules that existed only on paper are now implemented: [`BACKUP-BLOB-PATH`](reference/decision-rules.md) holds any backup-based method — Log Replay Service included, since it stages backups in Blob — at `unknown_requires_assessment` until the upload path is confirmed, and `CLR-PERMISSION` returns a shortlist rather than a confident recommendation when assemblies are `UNSAFE` or their permission set was never stated. `SAFE` is not a clearance: `clr strict security` treats it as UNSAFE without a signature. Size classes no longer overlap. Four invariants added, including one that forbids a method gate reporting `passed` on an unknown, and one that separates *excluded by preference* from *technically unsupported*. The live knowledge-base URL was returning 404. The skill now announces which versions it loaded and tells you when a newer release exists. 23 gates, 106 scenarios. |
| v2.0 | 2026-08-10 | Second external audit response, and no knowledge-base fact changed. The charge this time was structural: the repository tested what was easy to test rather than what makes the decision. Two contracts now own what was implicit — [`input-contract.md`](reference/input-contract.md) holds the 30 option IDs, the 20 fields and the difference between *confirmed none* and *nobody checked*, [`output-contract.md`](reference/output-contract.md) holds the status vocabulary and 9 invariants. The skill re-reads its own draft against those invariants before showing it, and exposes a failure instead of repairing it silently. Phase B ranking becomes ten ordered steps, because an unweighted table let two readers reach two answers from one estate; ties return a shortlist. All 26 hard gates are addressable by ID, with the fields each consumes and its behaviour on an unknown. `high` and `validated`, announced as removed in v1.18, had survived in three documents and two scenarios — a gate now guards the vocabulary. The skill moved to `skills/get-migration-assessment/` and installs as a Copilot CLI plugin. 21 gates, 90 scenarios. |
| v1.18 | 2026-08-10 | External audit response, waves 0 to 2. MI Link's Windows Server 2012 floor is restored (Microsoft states it in the link Limitations; v1.12 removed it and v1.13 added a gate protecting the error). Every interview option gains a stable ID, because the displayed labels were not the vocabulary the rules recognised. MI Link and the availability-group floors are fail-closed. `validated` and `high` are removed: the skill reads no artefact, so it cannot certify one. The Fabric DACPAC limit no longer fires on database size. All 29 Actions references are pinned to SHAs, the KB fetch is pinned to a release tag, and privacy absolutes become a minimisation policy. 18 gates, 90 scenarios. |
| v1.17 | 2026-08-10 | Dead-code audit across the repository: two unreferenced functions and an undeclared `inputs.tier` branch removed, leaving none. Two defects found while covering the rest. `no private link required` was read as `private link required`, so three of four Fabric scenarios carried a blocker they had ruled out and the DACPAC and preview gates had never run. An unanswered downtime tolerance produced a stated cutover of "minutes" at medium confidence; it now yields `unknown_requires_assessment`, and the decision rules gain the entry `SKILL.md` already had. Guards unreachable by construction are exercised by a new sixteenth gate instead of deleted. Coverage: 100% lines, 92.27% branches, 100% functions, 86 scenarios. |
| v1.16 | 2026-08-10 | Fabric SQL database's minimum downtime in the §12 matrix now reflects transactional replication as an online path, instead of contradicting §5.2 with an hours-only rating. Azure Migrate's Arc-based agentless discovery is marked **Preview** in the decision rules. Both are locked by new gates. The interview drops multi-selects, which never returned a value in real sessions, and captures list answers as free text. Two engine defects fixed: the `150 gb` small-database signal matched the `150 GB – 4 TB` range, and it outranked an explicit "not sure" on tier drivers, so an unknown became General Purpose. |
| v1.15 | 2026-08-10 | Interview and engine fix: an unanswered multi-select no longer reads as an explicit "none". Ticking nothing meant both "I have none of these" and "I have not checked", and the engine resolved that ambiguity the dangerous way by clearing the SQL MI and Azure SQL Database feature blockers. Multi-selects are now gated behind a single-select that names the intent, and a blank dependency list resolves to `unknown_requires_assessment`. No knowledge-base fact changed. |
| v1.14 | 2026-08-10 | `SKILL.md` restructured onto the ten-section template used by `microsoft/sql-migration-agent`, skill renamed `assessment-advisor`, `allowed-tools` declared, and internal wording removed from the activation triggers. No knowledge-base fact changed. |
| v1.13 | 2026-08-10 | Applied the weekly review's two sourced findings, both surviving occurrences of v1.12 corrections: the §5.2 MI Link row still carried the Windows Server floor as the abbreviated `Win Server 2016+`, and the Step A1 VM row still described free ESU as covering "2014 and earlier". Two new gates close both and immediately found two further occurrences in the poster. Changelog rows are now exempt from the forbidden-pattern check so history can quote what it corrected. |
| v1.12 | 2026-08-05 | Applied a two-model adversarial review of the decision rules after verifying every finding against Microsoft Learn: MI Link no longer excludes Linux hosts (supported from SQL Server 2017), the unsourced Windows Server 2016+ floor is removed, DTC port 135 carries both directions, Azure Hybrid Benefit on Hyperscale is qualified by the 15 December 2023 cohort, Service Broker cross-instance becomes a preview-gated capability instead of a hard blocker, and ESU scope narrows to SQL Server 2014 and 2016. Three new forbidden-pattern gates guard the corrections. |
| v1.11 | 2026-08-05 | Arc-enabled SQL MI no longer described as inheriting the Managed Instance methods, since MI Link is not supported for that target; added the retained-server-name / DNS-redirect TLS pitfall; gated both against return. |
| v1.10 | 2026-08-05 | Removed the last two unqualified LRS-fallback statements that v1.9 left standing, and added a forbidden-pattern gate that fails whenever LRS is offered without its source range and window attached. The gate found a third occurrence neither the review nor the author had spotted. |
| v1.9 | 2026-08-05 | MI Link gated on Windows Server 2016+ and Enterprise/Standard/Developer edition in the decision tree, LRS gated on its 30-day window and 2008–2022 source range, SQL MI removed as an as-is destination above 128 TB, MI Link marked not-applicable for Arc-enabled SQL MI, and Service Broker split by instance scope. |
| v1.8 | 2026-07-31 | Fabric SQL database re-scoped Preview → GA (only the Migration Assistant stays Preview), Backup to URL floor corrected to SQL Server 2012 SP1 CU2, stale SSMS 22 assessment roadmap removed, SQL VM downtime corrected to near-zero with AG/DAG, Always On AG 2012+ split from distributed AG 2016+, Hyperscale bounded at 128 TB, MI Next-gen General Purpose made selectable, and retirement claims repointed to maintained sources. |
| v1.7 | 2026-07-31 | Corrected SQL Server 2016 paid-ESU status, Hyperscale AHB exception guidance, SSRS/PBIRS consolidation, replication floors, Fabric Migration Assistant scope, Striim online/CDC guidance, retired-tool status, and Amazon RDS online-DMS nuance. |
| v1.6 | 2026-07-27 | Completed the MI Link port requirement (5022 **and** 11000–11999); corrected MI Link capacity to 100 links (500 on Next-gen General Purpose) and moved the "10 databases" figure to the Azure Arc wizard batch limit where it belongs; made the Azure Arc source floor consistently SQL Server 2014+; replaced the single downtime label with `targetAvailabilityDuringSync` + `businessCutoverDowntime` so LRS is no longer mislabelled offline. |
| v1.5 | 2026-07-27 | Corrected SQL MI PolyBase/data-virtualization and DTC nuance; fixed transactional-replication, LRS and cross-cloud method gates; replaced retired validation guidance; removed unsourced statistics; added uncertainty, traceability, claims drift detection and golden decision tests. |
| v1.4 | 2026-07-20 | Added GA announcement of SQL Migration to SQL Server on Azure VMs in Azure Arc. |
| v1.3 | 2026-07-15 | **SQL migration to SQL Server on Azure VMs in Azure Arc is now GA** (was public preview since April 2026). Refreshed the Arc control-plane entry (Azure SQL MI + SQL VM targets both GA), the source→target matrix, and §5.1; added the GA announcement + Learn how-to links. |
| v1.2 | 2026-07-03 | Fixed 2 moved Microsoft Learn links (Smart Bulk Copy, Migrate to Arc-enabled SQL MI); added the weekly link + news freshness automation. |
| v1.1 | 2026-07-03 | Azure SQL MI Next-gen General Purpose reclassified preview → GA; dates refreshed to July 2026; all ~45 Microsoft Learn links re-verified. |
| v1.0 | 2026-06 | Initial knowledge base: 8 target families, methods per target, the 2025–2026 tooling reset, decision matrices, commercial & funding levers, and the AI Migration Agent I/O contract. |

Full detail in [`docs/sql-server-to-azure-migration.md` §17](docs/sql-server-to-azure-migration.md#17-document-version--changelog). The weekly workflow keeps this table in sync.

</details>
<!-- CHANGELOG:END -->

This skill was extracted from the [FY27 SQL Motion](https://github.com/fredgis/FY27SQLMotion)
("SQL in a Day") into this dedicated repository.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to run the four checks, add a golden
scenario, and update a tracked claim.

## License

[MIT](LICENSE), Copyright (c) Microsoft Corporation. See [NOTICE](NOTICE).

