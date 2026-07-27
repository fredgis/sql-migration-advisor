# How the `sql-migration-advisor` skill works

*A guide for implementers and program managers who want to ship, host, or adapt this skill.*

This document explains three things:

1. **How the skill works** — the runtime loop, end to end.
2. **How an agent gets value from it** — why a prompt-driven skill beats asking a raw model.
3. **How it stays current** — the weekly GitHub Action that keeps the knowledge base fresh.

It closes with implementation notes for porting the pattern to a Microsoft-owned open-source repo, and a
**roadmap** for growing the advisor into a full migration platform.

---

## 1. In one paragraph

`sql-migration-advisor` is a **GitHub Copilot skill**: a small, prompt-driven markdown package
([`SKILL.md`](../SKILL.md)) with **no build step and no runtime dependencies**. It turns a general
agent into a focused **SQL Server → Azure migration consultant**. The skill is backed by a verified
**knowledge base** ([`docs/sql-server-to-azure-migration.md`](../docs/sql-server-to-azure-migration.md))
that acts as the single source of truth, and by a distilled **decision engine**
([`reference/decision-rules.md`](../reference/decision-rules.md)) that makes the core recommendation
deterministic. It produces a preliminary disposition for assessment, not an unsupervised final verdict. A
gated weekly GitHub Action re-verifies versions, links, news and high-risk claims, then opens a pull request
only when a substantive change was actually applied.

---

## 2. How the skill works (the runtime loop)

When a user asks something like *"migrate a SQL Server environment to Azure"* (or *"migrer SQL Server
vers Azure"*), the agent loads the skill and runs this loop:

<p align="center">
  <img src="./runtime-loop.svg" alt="Runtime loop: the user's migration ask activates SKILL.md, which runs a guided interview grounded in the live knowledge base (decision-rules.md is the offline fallback), scores the answers deterministically with Steps A to D, and produces a recommendation card plus optional follow-ups." width="960">
</p>

Step by step:

1. **Trigger.** The agent matches the user's intent against the `description` in the `SKILL.md`
   front matter (keywords like *migrate SQL Server*, *SQL to Azure*, *SQL in a Day*) and activates the skill.
2. **Load the source of truth.** It fetches the live knowledge base. If the network is unavailable it
   falls back to the bundled `reference/decision-rules.md`, and *says so* (so the user knows it may lag).
3. **Interview first, recommend second.** It asks Tier 1 triage questions and Tier 2 confirmation
   questions **one at a time** (migration intent, source type, version, downtime tolerance, PolyBase/DTC
   subtype, size, sovereignty, tier-selection inputs, …). It never guesses the path before asking, and skips
   branches that don't apply.
4. **Filter eligibility.** Phase A applies only hard constraints and returns `eligible`,
   `eligible_with_remediation`, `unsupported`, or `unknown_requires_assessment` for each target/method.
5. **Rank viable paths.** Phase B ranks candidates by refactoring effort, downtime, operational burden,
   compatibility, resilience, cost, reversibility and sovereignty, then applies tier-selection rules.
6. **Output the contract.** The agent emits machine-readable JSON, then renders it as Markdown: primary
   recommendation, best alternative, why other targets were excluded, confidence, `recommendationStatus`
   (`provisional` or `validated`), assumptions, unknowns, hard blockers, evidence required, downtime class,
   cost levers and program fit. See [`examples/sample-recommendation.md`](../examples/sample-recommendation.md)
   for a worked run.
7. **Offer follow-ups.** A per-database table for an estate, a cutover runbook, or a one-slide summary
   (handed off to another skill).

### The interview in full

The interview is deliberately two-tier: **Tier 1** is always enough to produce a *provisional*
recommendation, and **Tier 2** is only asked when an answer can still change the outcome. Questions are
asked one at a time, in the user's language, and "Not sure" is always allowed — but a *decision-driving*
unknown is never silently defaulted: it forces `recommendationStatus: provisional` plus an explicit
evidence gap.

**Tier 1 — Triage** (13 questions, plus 3 conditional unlocks)

| # | Question | Answer options | What it drives |
| --- | --- | --- | --- |
| 1 | **Scope** — how big is this migration? | Single DB · A few (2–10) · Large estate (10+) | Large estate ⇒ Azure Migrate discovery + `Az.DataMigration`, then profile representative groups |
| 2 | **Source location** — where does SQL Server run today? | On-prem · AWS EC2 · AWS RDS · GCP Compute Engine · GCP Cloud SQL | Managed sources ⇒ MI Link and transactional replication are out |
| 3 | **Source version** | 2008/R2 · 2012 · 2014 · 2016 · 2017/2019 · 2022 · 2025 | MI Link, LRS, native restore, replication, Arc portal, ESU |
| 4 | **Migration intent / readiness** | Move now · Modernize in place (assess first) · Assessment only · Rehost first, modernize later | Unlocks the **Arc in-place** control-plane path |
| 5 | **Primary driver** | End-of-support/ESU · Cost · App modernization · Data-center exit · Analytics/Fabric · Sovereignty/edge | Target bias and the Fabric branch |
| 6 | **Management model** | Fully managed PaaS · OS/engine control · Kubernetes on-prem/edge | PaaS vs IaaS vs Kubernetes family |
| 6a | ↳ **Kubernetes engine model** *(only if Q6 = Kubernetes)* | Managed engine (Arc data controller) · Full DIY container | **Arc-enabled SQL MI vs container** |
| 7 | **Feature dependencies** *(multi-select)* | FILESTREAM/FileTable · PolyBase · DTC · Cross-DB queries · SQL CLR · Linked servers · SQL Agent · Service Broker · None · Not sure | Phase A eligibility |
| 7a | ↳ **PolyBase qualifier** *(only if PolyBase)* | Cloud files only (Blob/ADLS, Parquet/CSV) · External RDBMS connector · S3/Delta/pushdown · Not sure | Cloud-files ⇒ **MI stays eligible**; external RDBMS ⇒ MI out |
| 7b | ↳ **DTC qualifier** *(only if DTC)* | SQL-to-SQL only (MI↔MI, MI↔SQL Server) · Heterogeneous/third-party RDBMS · Not sure | SQL-to-SQL ⇒ **MI stays eligible**; heterogeneous ⇒ MI out |
| 8 | **Largest database size** | < 150 GB · 150 GB – 4 TB · > 4 TB · Not sure | Hyperscale gate, backup caps, seed-then-sync |
| 9 | **Downtime tolerance** | Near-zero · Minimal · Offline window · Not sure | Method selection and downtime class |
| 10 | **Network path and ports** | Good ExpressRoute · Limited WAN · Multi-TB move · 5022 blocked · 1433/443 blocked · Not sure | MI Link viability, Data Box seeding |
| 11 | **Compliance / sovereignty** | Standard commercial · EU data boundary · Government/sovereign · Edge/air-gapped · Not sure | Biases SQL VM, AVS, Arc-enabled SQL MI |
| 12 | **Ancillary services and security** *(multi-select)* | SSIS · SSRS · SSAS · TDE-encrypted DBs · Many SQL Agent jobs · Windows logins · None · Not sure | Blockers and remediations |
| 13 | **Tier-selection inputs** *(asked when MI or SQL DB is still eligible)* | Low-latency writes · High IOPS/log throughput · Strict SLA/zone redundancy · Read-scale replicas · Intermittent usage · Many tenants · None/unknown | GP vs Business Critical vs Hyperscale vs Serverless vs Elastic Pool |

**Tier 2 — Confirmation** (asked only when it can still change the answer)

| Confirmation input | Asked when | Consumed by |
| --- | --- | --- |
| Source edition and OS | VM/AVS/Arc/container or licensing in play | Compatibility, HA/DR support, AHB/ESU, patching |
| Compatibility level | SQL DB, Fabric SQL DB or modernization candidate | Refactoring effort, compatibility scoring |
| Current HA/DR topology (FCI, AG, log shipping, none) | Near-zero/minimal downtime, or VM/AVS/MI Link in play | Method feasibility, rollback, resilience |
| RPO and RTO, separately | Any production migration | Method ranking and DR design |
| Peak log generation / change rate | MI Link, LRS, replication, log shipping, Data Box seed | Catch-up feasibility, downtime risk |
| CPU, memory, IOPS and latency peaks | Any PaaS target or tier choice | Sizing and tier-selection rules |
| Authentication (Windows / Entra ID / SQL) | SQL DB/MI, or cross-domain source | Login remediation, AD/Entra dependencies |
| SQL CLR permission set (`SAFE` / `EXTERNAL_ACCESS` / `UNSAFE`) | CLR present or unknown and PaaS still possible | Eligibility and remediation |
| Network, DNS and Active Directory dependencies | MI Link, AG/DAG, linked servers, Windows auth, VM/AVS | Connectivity, identity, failover feasibility |
| Backup retention and restore requirements | Native restore, LRS, SQL DB tiers | Operational burden and compliance |
| Target region and real feature availability | Any Azure target | Regional eligibility and sovereignty |
| DR architecture and rollback plan | Any production cutover | Reversibility and resilience scoring |
| Software Assurance / AHB entitlement | SQL DB/MI/VM cost comparison | Cost-lever eligibility |
| Maintenance and patching restrictions | VM/AVS/container vs managed PaaS | Operational burden, target ranking |

The canonical list lives in [`SKILL.md`](../SKILL.md) under *Interview structure* — treat that as the
source of truth if the two ever drift.

### Deterministic core, adaptive agent

A common question: *"if it's deterministic, can the agent still adapt to a complex situation?"* Yes —
there are **two layers**, and only the inner one is rigid:

| Layer | What it does | Behaviour |
| --- | --- | --- |
| **Deterministic core** (`decision-rules.md`, Phase A + Phase B) | The *what*: which paths are eligible, which candidate ranks highest, and which tier to assess. | Rigid **by design** — reproducible, auditable, no invented paths or retired tools. |
| **Adaptive agent layer** (the LLM around the core) | The *how*: run the interview, handle an estate, sequence a plan, resolve contradictions. | Context-aware — pre-fills known answers, runs one recommendation **per profile**, surfaces trade-offs, builds runbooks. |

So the determinism is a **guardrail, not a straitjacket**: it keeps every building block grounded, while
the agent composes those blocks into a plan as complex as the context demands (multi-profile estates,
phased modernization, cutover sequencing).

---

## 3. How an agent benefits from the skill

Why wrap this in a skill instead of just asking a model to "plan a SQL migration"?

- **Grounded, on-demand expertise.** The skill injects verified knowledge and rules *only when relevant*,
  keeping the agent's context clean the rest of the time. Every recommendation cites Microsoft Learn, so
  it is traceable.
- **Preliminary by design.** The output is a recommended assessment path that still requires tooling evidence
  and architect validation before execution.
- **Built-in guardrails reduce hallucination.** Hard rules — never recommend retired tooling (DMA, the
  Azure Data Studio extension, DMS *classic*); always separate **target / control plane / method**; be
  honest about previews, source constraints and size caps.
- **Deterministic and auditable.** The same profile always yields the same eligibility/ranking result, so a
  partner can reproduce and defend the preliminary disposition.
- **A structured interview, not a guess.** `ask_user`, one question at a time, multiple-choice — reliable
  input instead of the model assuming missing facts.
- **Composable.** Its Markdown/JSON output feeds other steps or skills (e.g. generate a summary slide),
  and it can hand off to a discovery pass for large estates.
- **Multilingual.** It interviews in the user's language.
- **Zero-dependency and portable.** Prompt-driven markdown means no build, no packages, easy to review,
  fork, and host.

---

## 4. Repository architecture

The repo separates the **prompt logic**, the **knowledge**, and the **freshness automation**:

<p align="center">
  <img src="./skill-architecture.svg" alt="Architecture of the sql-migration-advisor skill: a Copilot agent loads SKILL.md, which grounds every answer in the knowledge base and falls back to the deterministic decision rules offline, while a weekly GitHub Action re-verifies the knowledge base." width="960">
</p>

<sub>Diagram source: [`skill-architecture.architecture.json`](./skill-architecture.architecture.json) · interactive dark/light version with export menu: [`skill-architecture.html`](./skill-architecture.html) (open in a browser).</sub>


| Path | Purpose |
| --- | --- |
| [`SKILL.md`](../SKILL.md) | The skill itself: trigger `description`, core principles, the two-tier interview (triage, then confirmation), the output-card template, and guardrails. |
| [`reference/decision-rules.md`](../reference/decision-rules.md) | The deterministic engine: Phase A eligibility, Phase B ranking, tier selection and uncertainty handling. Distilled from the knowledge base; used as the **offline fallback**. |
| [`docs/sql-server-to-azure-migration.md`](../docs/sql-server-to-azure-migration.md) | The **knowledge base** — every target family, method, tool and commercial lever, with Microsoft Learn links. The single source of truth. |
| [`docs/sql-server-to-azure-migration.pdf`](../docs/sql-server-to-azure-migration.pdf) | The same knowledge base as a branded, partner-ready PDF (regenerated by the pipeline in `tools/pdf/`). |
| [`examples/sample-recommendation.md`](../examples/sample-recommendation.md) | A worked end-to-end example that calibrates tone and the card format. |
| [`lab/`](../lab/) | A self-contained hands-on lab (legacy SQL Server 2016 → SQL Server on Azure VM). |
| `.github/workflows/weekly-kb-check.yml` + `tools/weekly-check/` | The weekly freshness automation and consistency gates (see §5). |
| [`reference/claims-registry.json`](../reference/claims-registry.json) | High-risk claim hashes and source pointers for drift detection. |
| [`tests/`](../tests/) | Golden scenarios and deterministic anti-regression checks. |

**Source-of-truth precedence:** the live knowledge base wins. `decision-rules.md` is a faithful
distillation for offline use; if the two ever disagree, the skill prefers the live doc and says so.

---

## 5. How the knowledge base stays current (the weekly GitHub Action)

A migration knowledge base rots quickly — tools retire, previews go GA, dates change. The repo keeps
itself honest with a scheduled workflow, [`weekly-kb-check.yml`](../.github/workflows/weekly-kb-check.yml),
that runs every **Monday 05:00 UTC** (and on manual `workflow_dispatch`).

<p align="center">
  <img src="./weekly-update.svg" alt="Weekly freshness automation: a Monday schedule triggers a link and news scan (lychee + RSS), a GPT-5 review on GitHub Models returns a JSON verdict, decide.mjs judges staleness, apply-update.mjs bumps the version and changelog, and a pull request is opened for a human to merge into the knowledge base." width="1040">
</p>

What each stage does:

1. **Consistency check (`check-consistency.mjs`).** Blocks the run when the knowledge base, decision rules
   and README badge/changelog disagree on the current version.
2. **Link classification.** Classifies knowledge-base links as `ok`, `unreachable`, or
   `unverified-bot-blocked` for HTTP 403/429. Bot blocking is reported as uncertainty, not treated as a
   healthy source and not auto-described as fixed.
3. **Gather news (`gather-news.mjs`).** Pulls public Microsoft RSS feeds (Azure Updates, Azure SQL Blog,
   SQL Server Blog), filters by an include/exclude keyword list ([`keywords.json`](../tools/weekly-check/keywords.json))
   over a rolling 7-day window. No dependencies — plain `fetch` + a small RSS parser.
4. **Claims drift detection (`verify-claims.mjs`).** Re-fetches the source sections in
   [`reference/claims-registry.json`](../reference/claims-registry.json), hashes the relevant text and
   reports silent Microsoft Learn edits behind high-risk claims.
5. **AI review (`build-prompt.mjs` → GitHub Models).** Sends the evidence, the knowledge base and the
   decision tree to the model to flag real changes and any drift between documents. The verdict is an input
   to review, not proof that content was fixed.
6. **Decide (`decide.mjs`).** Separates substantive changes from housekeeping and report-only findings.
   Broken links, bot-blocked links and AI suggestions can open an issue or PR body, but they do not justify a
   version bump by themselves.
7. **Apply (`apply-update.mjs`).** A version bump requires `--substantive` and a verified content diff
   versus `HEAD`. `--housekeeping` can update freshness stamps without changing the version or adding a
   changelog row. Changelog text is constrained to what actually changed.
8. **Open a PR.** `peter-evans/create-pull-request` opens a reviewable PR with evidence and regenerated
   artifacts when files changed. **A human reviews and merges** — the automation never pushes content edits
   straight to `main`.

### The review model

The review runs on **`openai/gpt-5`** via GitHub Models (`actions/ai-inference@v2`), using the built-in
`GITHUB_TOKEN` with `permissions: models: read` — **no external secret required**. GPT-5 was chosen
because it is the most capable model *available on GitHub Models*: it reasons, has broad up-to-date
knowledge, and has a large enough context window to review the knowledge base, decision tree, link report,
news digest and claims-drift summary in one pass. Its output is advisory: the gates require actual file diffs
before versioning changes.

> **Note for implementers:** GitHub Models does **not** host any Anthropic/Claude models — only OpenAI,
> Meta, Microsoft, Mistral AI, DeepSeek and Cohere. To run Claude (or any non-hosted model) you must
> replace the `actions/ai-inference` step with a provider call (Anthropic API, Amazon Bedrock, or
> **Microsoft Foundry**) and add the corresponding secret. The AI step is `continue-on-error`; if it fails,
> the deterministic checks still report, but no AI-only version bump is allowed.

### Golden test suite

The repo now includes [`tests/`](../tests/) with golden migration scenarios, consistency checks and
anti-regression cases. The suite guards the behaviours that were easiest to over-claim: unknowns on
decision-driving dependencies remain provisional, formerly unreachable branches stay reachable, retired tools
stay excluded, README/KB/rules versions remain aligned, and the same inputs produce the same output contract.

### Audit response

An external audit was run before broader positioning. It found real P0 issues, and the project responded by
turning them into gates rather than notes.

| Audit finding | What changed |
| --- | --- |
| Accuracy gaps in hard constraints | Knowledge base v1.5 corrected the PolyBase, DTC, LRS, replication and cross-cloud method rules. |
| Overstated finality | The advisor is now framed as discovery and pre-selection pending assessment tooling and architect validation. |
| Silent assumptions | Outputs carry confidence, status, assumptions, unknowns, blockers and evidence required. |
| Unsafe freshness automation | Version bumps require substantive diffs; bot-blocked links and AI verdicts are report-only. |
| Weak regression coverage | Golden scenarios and consistency gates run in CI. |

### Prerequisites for the automation

- Repo setting **Settings → Actions → General → "Allow GitHub Actions to create and approve pull requests"** enabled.
- Workflow `permissions:` include `contents: write`, `pull-requests: write`, `models: read`.

---

## 6. Design principles & guardrails (worth preserving when you port it)

- **Interview first, recommend second** — never guess the path; ask one question at a time.
- **Frame the result as preliminary** — recommend the assessment path, then require tooling evidence and architect validation.
- **Ground every answer in the source doc** — never invent targets, tools, or version gates.
- **Separate the three layers** — *target* (where the DB lands), *control plane* (how you assess/orchestrate),
  *method* (the data vehicle). Mixing them is the #1 mistake.
- **Never recommend retired tooling** — the doc tracks retirements and replacements.
- **Be honest about previews and limits** — call out preview status, size caps, SLA notes.
- **One recommendation per distinct profile** — a large estate has many; run the interview per profile
  or start with a discovery pass.
- **Keep it prompt-driven and dependency-free** — the skill is reviewable markdown; the automation uses
  only Node's built-ins + off-the-shelf Actions.

---

## 7. Implementing / porting this on a Microsoft open-source repo

A checklist to reuse the pattern for another domain (or to adopt this one):

1. **Keep the split**: `SKILL.md` (thin prompt logic) + a knowledge base (source of truth) +
   `decision-rules.md` (deterministic, offline fallback) + `examples/` (tone calibration).
2. **Make the knowledge base the single source of truth** and have the skill fetch it live, with the
   distilled rules as a documented fallback. State the precedence explicitly.
3. **Encode the guardrails in `SKILL.md`** (retired-tool list, layer separation, preview honesty) so the
   behaviour survives model changes.
4. **Adopt the freshness automation** (`tools/weekly-check/` + the workflow). Re-point `keywords.json`
   feeds/keywords to your domain. Confirm the model choice against the live GitHub Models catalog, or wire
   an external provider + secret if you need a specific model.
5. **Keep humans in the loop** — the Action opens a PR; it does not auto-merge content or claim fixes it did not apply.
6. **Mind file hygiene** — `SKILL.md` should be UTF-8 with **LF** line endings (a CRLF front-matter
   delimiter can stop the skill from loading).
7. **Localize** — the interview should follow the user's language.

---

## 8. Roadmap — from an advisor to a migration platform

This is deliberately ambitious. `sql-migration-advisor` is the **first** of three grounded, Copilot-native
building blocks. The advisor tells you *where* to land and *how*; the next two are meant to help you
*measure* and then *execute* the move — so a practitioner can go from "I have a SQL Server estate" to
"it's running on Azure" without ever leaving Copilot.

<p align="center">
  <img src="./roadmap.svg" alt="Roadmap: three skills/agents — Advisor (shipped, green), Assessment (planned, amber) and Migration (planned, amber) — each connecting up to HVE Core, which is green and only partially integrated. The Advisor link is solid (integrating); the Assessment and Migration links are dashed (planned)." width="960">
</p>

<sub>Colour code: green = shipped, amber = planned. HVE Core is green but only partially wired in today. Diagram source: [`roadmap.architecture.json`](./roadmap.architecture.json) · interactive version: [`roadmap.html`](./roadmap.html).</sub>

### The three building blocks

- **Advisor — shipped (green).** This repo. It interviews the user, applies Phase A eligibility and Phase B
  ranking, and returns a grounded, self-refreshing preliminary recommendation (target, method, downtime,
  blockers, confidence, evidence required, cost levers, program fit).
- **Assessment — planned (amber).** A skill/agent that reads the *actual* estate (versions, sizes,
  instance-level feature dependencies, blockers) and turns the advisor's recommendation into a sized,
  evidence-backed plan.
- **Migration — planned (amber).** A skill/agent that *executes and validates* the move (orchestration,
  cutover, post-migration checks), keeping a human in control at every gate.

Each new block inherits the same principles as the advisor: grounded in a verified knowledge base,
deterministic where it can be, honest about limits, and human-in-the-loop.

### Integrating into HVE Core

The intent is to contribute these building blocks to
[HVE Core](https://github.com/microsoft/hve-core) — Microsoft's **Hypervelocity Engineering** library of
Copilot agents, prompts, coding instructions, and validated skills. HVE Core already ships as a VS Code
extension and a Copilot CLI plugin, so an advisor / assessment / migration skill packaged its way becomes
installable by any team in a single step, with standards applied automatically.

Integration is **partial today** — that is what the diagram's *partially integrated* HVE Core box and the
dotted links convey. The advisor is the furthest along and can already be consumed as a standalone Copilot
skill; wiring all three into HVE Core's collections and conventions is the work ahead.

One concrete integration vehicle is [Squad](https://github.com/bradygaster/squad) — Brady Gaster's
"human-led AI agent teams" for GitHub Copilot, where specialists (lead, frontend, backend, tester) live in
your repo as files, persist across sessions, and coordinate work while a human stays accountable. A
Squad-style team is a natural way to orchestrate the advisor → assessment → migration hand-off end to end.
Squad is alpha and it is *one* option among others — but it is a good worked example of the pattern.

**See it in action** — the video below is the shipped advisor today. The roadmap extends this same
grounded, human-in-the-loop pattern to assessment and migration, orchestrated (for example) by a
Squad-style team.

<video src="https://github.com/user-attachments/assets/5594fc75-4fb7-40a9-b9a1-0cc761c8aebe" poster="https://github.com/fredgis/sql-migration-advisor/raw/main/images/sql-migration-advisor-demo-poster.jpg" controls muted></video>

### Roadmap steps

- **Ship + document the advisor (done).** This repo, its knowledge base, the weekly freshness Action, and
  this guide.
- **Package the advisor for HVE Core.** A collection entry that follows HVE Core conventions and installs
  as a Copilot CLI plugin / VS Code extension — the first real integration.
- **Design the Assessment skill.** Define its knowledge base, its interview, and its evidence outputs;
  reuse the same deterministic-rules + freshness-automation pattern.
- **Build the Assessment skill/agent.** Take the advisor's recommendation as input and produce a sized,
  blocker-aware migration plan grounded in the scanned estate.
- **Design the Migration skill.** Orchestration steps, cutover gates, and validation checks — with an
  explicit human approval at every gate.
- **Build the Migration skill/agent.** Execute against the assessment output and validate the result.
- **Orchestrate the three together.** Wire advisor → assessment → migration into one flow (for example via
  a Squad-style team) and contribute the set to HVE Core.
- **Close the loop.** Shared knowledge base and weekly freshness across all three blocks, plus telemetry to
  keep the recommendations sharp.

Yes, it's ambitious — three grounded skills, a shared freshness discipline, and a clean integration into a
Microsoft-owned platform. But each piece is small, reviewable, and useful on its own, and the advisor
already proves the pattern works end to end.

---

### Related reading

- [`SKILL.md`](../SKILL.md) — the skill contract and the full questionnaire.
- [`reference/decision-rules.md`](../reference/decision-rules.md) — the deterministic engine.
- [`examples/sample-recommendation.md`](../examples/sample-recommendation.md) — a worked run.
- [`docs/sql-server-to-azure-migration.md`](../docs/sql-server-to-azure-migration.md) — the knowledge base.

---

*This skill is prompt-driven markdown — no build step, no runtime dependencies. Fork it, re-point the
knowledge base, and adapt the interview to make it your own.*
