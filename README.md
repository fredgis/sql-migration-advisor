<h1 align="center">sql-migration-advisor</h1>

<p align="center">
  A <a href="https://docs.github.com/copilot/how-tos/use-copilot-agents/use-copilot-cli">GitHub Copilot CLI</a>
  skill that produces a preliminary, evidence-backed SQL Server → Azure migration recommendation —
  and the verified knowledge base behind it.
</p>

<p align="center">
  <img alt="GitHub Copilot CLI skill" src="https://img.shields.io/badge/GitHub%20Copilot%20CLI-skill-8957e5">
  <img alt="License MIT" src="https://img.shields.io/badge/license-MIT-blue">
  <img alt="Knowledge base v1.10" src="https://img.shields.io/badge/knowledge%20base-v1.10-2b8a3e">
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
The skill runs a short, structured interview, then returns a grounded, deterministic
preliminary recommendation for assessment and validation:

- **Primary path** — target and method to assess first: SQL VM · AVS · SQL MI · SQL DB · Fabric SQL DB · Arc SQL MI · container · Arc in-place
- **Best alternative** — the strongest fallback path when trade-offs or unknowns remain
- **Exclusions** — why other targets were ruled out, including hard blockers and remediation options
- **Confidence** — provisional or validated status, assumptions, unknowns, and evidence required
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

- **Verified knowledge** — the v1.10 knowledge base is source-backed and corrected against Microsoft Learn.
- **Deterministic engine** — Phase A filters hard eligibility, then Phase B ranks viable options and tiers.
- **Explicit uncertainty** — recommendations carry confidence, provisional/validated status, assumptions, unknowns, blockers and evidence required.
- **Freshness gates** — version bumps require substantive diffs; link checks classify bot-blocked pages; high-risk claims are tracked in [`reference/claims-registry.json`](reference/claims-registry.json).
- **Regression protection** — [`tests/`](tests/) contains golden scenarios and consistency checks wired into CI.

## Audit response

An external audit deliberately challenged the advisor before wider use. It found real P0 issues, and the project treated that as a strength: invite scrutiny, fix the facts, and make drift harder to miss.

| Audit finding | What changed |
| --- | --- |
| Over-confident final-advice framing | Repositioned as a discovery and pre-selection assistant with mandatory assessment-tool and architect validation. |
| Factual inaccuracies in hard gates | Knowledge base v1.5 corrects PolyBase, DTC, LRS, replication and cross-cloud method constraints. |
| Hidden uncertainty | Outputs now include confidence, provisional/validated status, assumptions, unknowns, hard blockers and evidence required. |
| Weak freshness governance | Version-gated automation, consistency checks and a claims registry prevent unearned version bumps and catch source drift. |
| Limited regression coverage | Golden scenarios and deterministic anti-regression tests now run in CI. |

---

## What's inside

| Path | Purpose |
| --- | --- |
| [`SKILL.md`](SKILL.md) | The skill — trigger description, principles, the two-tier interview (triage, then confirmation), and the output-card template. |
| [`reference/decision-rules.md`](reference/decision-rules.md) | The deterministic decision engine: Phase A eligibility filter, then Phase B ranking and tier selection — used as the offline fallback. |
| [`examples/sample-recommendation.md`](examples/sample-recommendation.md) | A worked end-to-end example (SQL 2014 → Azure SQL MI via LRS). |
| [`docs/sql-server-to-azure-migration.md`](docs/sql-server-to-azure-migration.md) | The knowledge base — every target family, method, tool, and commercial lever, with Microsoft Learn links. |
| [`reference/claims-registry.json`](reference/claims-registry.json) | Hashes and source pointers for high-risk claims, used by weekly drift detection. |
| [`docs/sql-server-to-azure-migration.pdf`](docs/sql-server-to-azure-migration.pdf) | The same knowledge base as a branded, partner-ready PDF. |
| [`lab/`](lab/) | A self-contained, hands-on lab: take a legacy SQL Server 2016 workload to a SQL Server on Azure VM, driven by the advisor and the HVE Squad (VM-to-VM migration). |
| [`howto/how-the-skill-works.md`](howto/how-the-skill-works.md) | Implementer's guide: how the skill works, how an agent uses it, and how the weekly Action keeps the knowledge base fresh (with architecture diagrams). |
| [`docs/sql-migration-advisor-developer-pitch.md`](docs/sql-migration-advisor-developer-pitch.md) | Developer pitch: runtime architecture, the decision process, the CI and pull-request gates, and how the knowledge base stays current. |
| [`blume/`](blume/) | Source for the online docs page — [fredgis.github.io/sql-migration-advisor](https://fredgis.github.io/sql-migration-advisor/) — a friendly overview of how the skill works and stays up to date. |
| [`tests/`](tests/) | Golden scenarios and anti-regression checks that keep the decision engine deterministic. |

The skill is prompt-driven markdown — no build step, no dependencies.

---

## Install as a Copilot CLI skill

Copilot CLI loads personal skills from subfolders of `~/.copilot/skills/`, each containing a
`SKILL.md`. This repository *is* the skill (its `SKILL.md` sits at the root), so the simplest
install is to clone it straight into the skills folder.

```bash
# macOS / Linux
git clone https://github.com/fredgis/sql-migration-advisor.git ~/.copilot/skills/sql-migration-advisor
```

```powershell
# Windows (PowerShell)
git clone https://github.com/fredgis/sql-migration-advisor.git "$env:USERPROFILE\.copilot\skills\sql-migration-advisor"
```

Then:

1. Restart Copilot CLI (skills load at startup).
2. Run `/skills` and confirm **`sql-migration-advisor`** is listed.
3. Ask, e.g. *"I want to migrate a SQL Server environment to Azure"* — the skill takes over
   and starts the interview.

> The bundled `docs/` folder (knowledge base + PDF) rides along harmlessly; Copilot only reads
> `SKILL.md` plus `reference/` and `examples/`. To keep the skills folder lean, copy just
> `SKILL.md`, `reference/` and `examples/` instead of cloning the whole repo.

### 🔄 Already installed? Update it

The decision rules and the interview change over time (see [Keep it up to date](#keep-it-up-to-date)),
so refresh your copy now and then.

If you cloned the repo:

```bash
# macOS / Linux
cd ~/.copilot/skills/sql-migration-advisor && git pull
```

```powershell
# Windows (PowerShell)
cd "$env:USERPROFILE\.copilot\skills\sql-migration-advisor"; git pull
```

If you copied only the three files, copy them again from the latest repo:
`SKILL.md`, `reference/decision-rules.md`, `examples/sample-recommendation.md`.

Then **restart Copilot CLI** — skills load at startup, so an update isn't picked up until you do.
To check which version you're running:

```powershell
Select-String -Path "$env:USERPROFILE\.copilot\skills\sql-migration-advisor\SKILL.md" -Pattern "knowledge-base line"
```

It should match the knowledge-base badge at the top of this README.

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

---

## Poster Skill AI

The whole engine on one page — not just the target choice, but everything the skill reasons
through: the **agentic loop** (grounds itself in the live knowledge base, interviews, reasons
deterministically, guards itself, then acts), the Tier 1/Tier 2 interview, Phase A eligibility,
Phase B ranking and tier selection, cutover downtime classes + blockers & remediations, confidence
and evidence requirements, cost levers, Microsoft program and the assessment tool to run next — with the official Azure &amp; Microsoft Fabric
service icons.

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
[`docs/sql-server-to-azure-migration.pdf`](docs/sql-server-to-azure-migration.pdf) (22 pages,
v1.10, August 2026) — ready to hand to a partner or attach to a deal. It's generated reproducibly
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
<summary><b>📓 Changelog</b> — current: <b>v1.10</b> (August 2026)</summary>

| Version | Date | Summary |
| --- | --- | --- |
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

[MIT](LICENSE). Attribution is recorded in [NOTICE](NOTICE) and must be preserved if this
work is redistributed or vendored into another repository.

