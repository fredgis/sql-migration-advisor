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

`sql-migration-advisor` is a **GitHub Copilot skill** named `recommend-migration-path`: a small,
prompt-driven markdown package ([`skills/recommend-migration-path/SKILL.md`](../skills/recommend-migration-path/SKILL.md))
with **no build step and no runtime dependencies**. It turns a general
agent into a focused **SQL Server → Azure migration consultant**. The skill is backed by a verified
**knowledge base** ([`docs/sql-server-to-azure-migration.md`](../docs/sql-server-to-azure-migration.md))
that acts as the factual source, by two contracts for input and output
([`reference/input-contract.md`](../reference/input-contract.md), [`reference/output-contract.md`](../reference/output-contract.md)),
and by a distilled **decision policy**
([`reference/decision-rules.md`](../reference/decision-rules.md)) kept under regression test. It produces a preliminary disposition for assessment, not an unsupervised final verdict. A
gated weekly GitHub Action re-verifies versions, links, news and high-risk claims, then opens a pull request
only when a substantive change was actually applied.

---

## 2. How the skill works (the runtime loop)

When a user asks something like *"migrate a SQL Server environment to Azure"* (or *"migrer SQL Server
vers Azure"*), the agent loads the skill and runs this loop:

<p align="center">
  <img src="./runtime-loop.svg" alt="Runtime loop: the user's migration ask activates skills/recommend-migration-path/SKILL.md, which runs a guided interview grounded in the bundled contracts, decision rules and knowledge base, applies Steps A to D, self-checks the draft, and produces a recommendation card plus optional follow-ups." width="960">
</p>

Step by step:

1. **Trigger.** The agent matches the user's intent against the `description` in
   [`skills/recommend-migration-path/SKILL.md`](../skills/recommend-migration-path/SKILL.md)
   front matter (keywords like *migrate SQL Server*, *SQL to Azure*, *SQL in a Day*) and activates the skill.
2. **Load the source of truth.** It reads the bundled input contract, decision rules, output contract and
   knowledge base. The bundle is the default because the skill now lives below `skills/` and refers back to
   `../../reference/...`; installing only one `SKILL.md` would leave the vocabulary and rules behind. If the
   user explicitly asks for the tagged live knowledge base and it cannot be read, the skill says it is using
   the bundled copy.
3. **Interview first, recommend second.** It asks Tier 1 triage questions and Tier 2 confirmation
   questions **one at a time** (migration intent, source type, version, downtime tolerance, PolyBase/DTC
   subtype, size, sovereignty, tier-selection inputs, …). It records the stable IDs from
   [`reference/input-contract.md`](../reference/input-contract.md), including the difference between
   `NONE_CONFIRMED`, `UNKNOWN` and `NOT_APPLICABLE`, because "none checked and confirmed" is not the same
   evidence as "nobody has checked".
4. **Filter eligibility.** Phase A applies only hard constraints and returns `eligible`,
   `eligible_with_remediation`, `unsupported`, or `unknown_requires_assessment` for each target/method.
   Each eligibility line cites the rule ID, such as `MI-LINK-HOST` or `FILESTREAM-PAAS`, so a reader can
   challenge the rule in the index at the end of [`reference/decision-rules.md`](../reference/decision-rules.md).
5. **Rank viable paths.** Phase B applies ten ordered steps. That order matters: cost no longer competes
   vaguely with resilience, and a tie ends in a provisional shortlist rather than an invented winner.
6. **Self-check the draft.** Before rendering, the skill re-reads the draft against the 13 invariants in
   [`reference/output-contract.md`](../reference/output-contract.md): the primary target must be eligible,
   the method must pass its own gate, hard-gate unknowns must be visible, status must stay `provisional`,
   and confidence cannot exceed `medium`. If an invariant fails, the skill exposes the inconsistency instead
   of silently repairing it.
7. **Output the contract.** The agent emits machine-readable JSON on request, then renders Markdown: primary
   recommendation, best alternative, why other targets were excluded, confidence, `recommendationStatus`
   (`provisional` only), assumptions, unknowns, hard blockers, evidence required, downtime class,
   cost levers and program fit. See [`examples/sample-recommendation.md`](../examples/sample-recommendation.md)
   for a worked run.
8. **Offer follow-ups.** A per-database table for an estate, a cutover runbook, or a one-slide summary
   (handed off to another skill).

<p align="center">
  <img src="./decision-pipeline.svg" alt="Decision pipeline: a user ask feeds a guided interview, then Phase A filters eligibility against hard constraints, Phase B ranks the survivors, the output contract self-checks the draft, and a provisional recommendation card is produced." width="960">
</p>

<sub>Runs **per conversation** — there is no schedule. Diagram source: [`decision-pipeline.architecture.json`](./decision-pipeline.architecture.json) · interactive: [`decision-pipeline.html`](./decision-pipeline.html).</sub>

### The interview in full

The interview is deliberately two-tier: **Tier 1** is always enough to produce a *provisional*
recommendation, and **Tier 2** is only asked when an answer can still change the outcome. Questions are
asked one at a time, in the user's language, and "Not sure" is always allowed — but a *decision-driving*
unknown is never silently defaulted: it forces `recommendationStatus: provisional` plus an explicit
evidence gap.

**Tier 1 — Triage** (13 questions, plus 3 conditional unlocks)

The middle column is the question **as the agent actually asks it**.

| # | The agent asks | Answer options | What it drives |
| --- | --- | --- | --- |
| 1 | *"How big is this migration?"* | Single database · A few databases (2–10) · Large estate (10+ servers/DBs) | Large estate ⇒ Azure Migrate discovery + `Az.DataMigration`, then profile representative groups |
| 2 | *"Where does the source SQL Server run today?"* | On-prem · AWS EC2 · AWS RDS for SQL Server · GCP Compute Engine · GCP Cloud SQL | Managed sources ⇒ MI Link and transactional replication are out |
| 3 | *"Which SQL Server version is the source?"* | 2008/2008 R2 · 2012 · 2014 · 2016 · 2017/2019 · 2022 · 2025 | MI Link, LRS, native restore, replication, Arc portal, ESU |
| 4 | *"What outcome do you need now?"* | Move to Azure now · Modernize in place / not ready yet (assess first) · Assessment only · Rehost first, modernize later | Unlocks the **Arc in-place** control-plane path |
| 5 | *"What is the main reason to migrate now?"* | End-of-support / ESU pressure · Cost optimization · App modernization · Data-center exit (VMware) · Analytics / Fabric unification · Sovereignty / edge | Target bias and the Fabric branch |
| 6 | *"How much control do you need over the engine and OS?"* | Fully managed PaaS · Need OS / file-system / engine control · Need Kubernetes on-prem / edge / multi-cloud | PaaS vs IaaS vs Kubernetes family |
| 6a | ↳ *"Do you want Microsoft to run the engine on your cluster, or do you want to own it end to end?"* *(only if Q6 = Kubernetes)* | Managed engine (Arc data controller: auto patch/backup/HA) · Full DIY container (we own HA/patch/backup) | **Arc-enabled SQL MI vs container** |
| 7 | *"Do you know which SQL Server features the workload uses?"* | None of them, confirmed · Let me list them · Not checked yet | Names the intent before asking for the list, so "none" and "not checked" can never collapse |
| 7a | ↳ *"List the ones it uses, separated by commas."* *(free text, only after "Let me list them")* | FILESTREAM / FileTable · PolyBase · DTC / distributed transactions · Cross-DB queries · SQL CLR · Linked servers · SQL Agent jobs · Service Broker | Phase A eligibility |
| 7b | ↳ *"What does PolyBase actually query — files in Azure/cloud storage, or an external database like Oracle or Teradata?"* *(only if PolyBase)* | Cloud files only (Blob/ADLS Gen2, Parquet/CSV) · External RDBMS connector · S3 / Delta / pushdown required · Not sure | Cloud files ⇒ **SQL MI stays eligible**; external RDBMS ⇒ MI out |
| 7c | ↳ *"Are those distributed transactions only between SQL Servers, or do they span a non-SQL database?"* *(only if DTC)* | SQL-to-SQL only (MI↔MI or MI↔SQL Server) · Heterogeneous / third-party RDBMS · Not sure | SQL-to-SQL ⇒ **SQL MI stays eligible**; heterogeneous ⇒ MI out |
| 8 | *"How large is the biggest database?"* | < 150 GB · 150 GB – 4 TB · > 4 TB · > 128 TB · Not sure | Hyperscale ceiling, backup size caps, seed-then-sync |
| 9 | *"How much cutover downtime can the business accept?"* | Near-zero (minutes) · Minimal (tens of minutes to a couple of hours) · Offline planned window · Not sure | Method selection and downtime class |
| 10 | *"What is the network path to Azure, and can MI Link ports 5022 and 11000–11999 be opened in the required directions?"* | Good ExpressRoute / high bandwidth · Ports confirmed open in both directions · Limited WAN · Very large multi-TB move · 5022 or 11000–11999 blocked · 1433/443 blocked or unknown · Not sure | MI Link viability, Data Box seeding |
| 11 | *"Any data residency, sovereign, or edge constraints?"* | Standard commercial · EU data boundary · Government / sovereign · Edge / air-gapped · Not sure | Biases SQL VM, AVS, Arc-enabled SQL MI |
| 12 | *"Anything around the database to bring along?"* | Nothing, confirmed · Let me list them · Not sure | Names the intent before asking for the list |
| 12a | ↳ *"List them, separated by commas."* *(free text)* | SSIS packages · SSRS reports · SSAS models · TDE-encrypted DBs · Many SQL Agent jobs · Windows logins | Blockers and remediations |
| 13 | *"Any tier drivers?"* *(asked when SQL MI or SQL DB is still eligible)* | No particular driver, confirmed · Let me list them · Not sure | "Not sure" holds the tier at `unknown_requires_assessment` instead of defaulting to General Purpose |
| 13a | ↳ *"List them, separated by commas."* *(free text)* | Low-latency writes · High IOPS / log throughput · Strict SLA / zone redundancy · Read-scale replicas · Intermittent usage · Many tenants / variable demand | GP vs Business Critical vs Hyperscale vs Serverless vs Elastic Pool |

<details>
<summary><b>What a real exchange looks like</b></summary>

> **Agent** — How big is this migration?<br />
> **User** — A few databases, maybe 6.
>
> **Agent** — Where does the source SQL Server run today?<br />
> **User** — AWS RDS for SQL Server.
>
> *(the agent notes: managed source ⇒ MI Link and transactional replication are already out)*
>
> **Agent** — Which SQL Server version is the source?<br />
> **User** — 2019.
>
> **Agent** — Do you know which SQL Server features the workload uses: FILESTREAM/FileTable, PolyBase, DTC, cross-DB queries, SQL CLR, linked servers, SQL Agent jobs, Service Broker?<br />
> **User** — Let me list them.
>
> **Agent** — List the ones it uses, separated by commas.<br />
> **User** — SQL Agent jobs, and we do use distributed transactions.
>
> **Agent** — Are those distributed transactions only between SQL Servers, or do they span a non-SQL database?<br />
> **User** — Only SQL to SQL.
>
> *(SQL MI stays eligible — this is exactly the question that used to be missing, and its absence wrongly eliminated SQL MI)*
>
> **Agent** — How much cutover downtime can the business accept?<br />
> **User** — A couple of hours is fine.

From here the agent has enough for a **provisional** recommendation, and only asks the Tier 2 questions
that could still change it.

</details>

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

**Structured inputs** — four values are captured as *typed* data, not prose, because rules read them
directly and a wrong guess silently changes the recommendation:

| Field | Asked when | Consumed by |
| --- | --- | --- |
| `database_count` *(integer)* | more than one database is in scope | MI Link capacity (100 GP/BC, 500 Next-gen GP) and the estate-discovery branch — never inferred from a free-text size answer |
| `migration_batch_size` *(integer)* | the Azure Arc portal migration is used | the Arc wizard per-batch limit, which is a different limit from MI Link capacity |
| `arc_extension_version` *(e.g. `1.1.3348.364`)* | the Azure Arc portal migration is used | gates the Arc wizard batch limit — **unknown is not treated as recent**, it requires assessment |
| `evidence` *(4 booleans)* | the user reports that an assessment was run | Recorded as claims to verify elsewhere. They do not raise status or confidence because this skill reads no artefact |

The canonical field list lives in [`reference/input-contract.md`](../reference/input-contract.md). It fixes
20 field names and 30 stable option IDs, so the interview and the rules do not drift when a label is
translated or reworded.

### Tested policy, adaptive agent

A common question: *"if the rules are under test, can the agent still adapt to a complex situation?"* Yes.
There are two layers:

| Layer | What it does | Behaviour |
| --- | --- | --- |
| **Regression-tested policy** (`decision-rules.md`, Phase A + Phase B) | The *what*: which paths are eligible, how surviving candidates are ordered, and which tier to assess. | Constrained by design: no invented paths, no retired tools, and a shortlist when the evidence does not settle the order. |
| **Adaptive agent layer** (the LLM around the core) | The *how*: run the interview, handle an estate, sequence a plan, resolve contradictions. | Context-aware — pre-fills known answers, runs one recommendation **per profile**, surfaces trade-offs, builds runbooks. |

The tested policy is a guardrail, not a promise of identical wording between sessions. The agent composes
the grounded blocks into a plan as complex as the context demands, while the output contract keeps the card
honest about unknowns and confidence.

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
- **Regression-tested and auditable.** The same profile replayed through the rules mirror yields the same eligibility/ranking result, so a
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
  <img src="./skill-architecture.svg" alt="Architecture of the sql-migration-advisor skill: a Copilot agent loads skills/recommend-migration-path/SKILL.md, which grounds every answer in the contracts, knowledge base and decision rules, while a weekly GitHub Action re-verifies the knowledge base." width="960">
</p>

<sub>Diagram source: [`skill-architecture.architecture.json`](./skill-architecture.architecture.json) · interactive dark/light version with export menu: [`skill-architecture.html`](./skill-architecture.html) (open in a browser).</sub>


| Path | Purpose |
| --- | --- |
| [`skills/recommend-migration-path/SKILL.md`](../skills/recommend-migration-path/SKILL.md) | The skill itself: trigger `description`, core principles, the two-tier interview (triage, then confirmation), the output-card template, and guardrails. The skill name is `recommend-migration-path`, because it produces an assessment path rather than deciding for the user. |
| [`reference/input-contract.md`](../reference/input-contract.md) | The interview contract: canonical fields, stable option IDs, answer states, consumers and unknown behaviour. |
| [`reference/output-contract.md`](../reference/output-contract.md) | The output contract: status vocabulary, card shape and the 13 pre-render self-check invariants. |
| [`reference/decision-rules.md`](../reference/decision-rules.md) | The tested policy: Phase A eligibility, the ordered Phase B ranking, tier selection, uncertainty handling and the rule index. Distilled from the knowledge base; bundled with the skill. |
| [`docs/sql-server-to-azure-migration.md`](../docs/sql-server-to-azure-migration.md) | The **knowledge base** — every target family, method, tool and commercial lever, with Microsoft Learn links. The single source of truth. |
| [`docs/sql-server-to-azure-migration.pdf`](../docs/sql-server-to-azure-migration.pdf) | The same knowledge base as a branded, partner-ready PDF (regenerated by the pipeline in `tools/pdf/`). |
| [`examples/sample-recommendation.md`](../examples/sample-recommendation.md) | A worked end-to-end example that calibrates tone and the card format. |
| [`lab/`](../lab/) | A self-contained hands-on lab (legacy SQL Server 2016 → SQL Server on Azure VM). |
| `.github/workflows/weekly-kb-check.yml` + `tools/weekly-check/` | The weekly freshness automation and consistency gates (see §5). |
| [`reference/claims-registry.json`](../reference/claims-registry.json) | High-risk claim hashes and source pointers for drift detection. |
| [`tests/`](../tests/) | Golden scenarios and anti-regression checks. The JavaScript engine here is only a test mirror of the prompt policy; it is not executed in production. |

**Source-of-truth precedence:** the bundled contracts, rules and knowledge base ship together and are the
default. The skill may read the tagged knowledge base when the user asks, but it does not replace the
contracts with prose from the network.

---

## 5. How the knowledge base stays current (the weekly GitHub Action)

A migration knowledge base rots quickly — tools retire, previews go GA, dates change. The repo keeps
itself honest with a scheduled workflow, [`weekly-kb-check.yml`](../.github/workflows/weekly-kb-check.yml),
that runs every **Monday 05:00 UTC** (and on manual `workflow_dispatch`).

<p align="center">
  <img src="./weekly-update.svg" alt="Weekly freshness automation: a Monday schedule triggers a link and news scan (lychee + RSS), a model review on Azure AI Foundry returns a JSON verdict, decide.mjs judges staleness, apply-update.mjs bumps the version and changelog, and a pull request is opened for a human to merge into the knowledge base." width="1040">
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
5. **AI review (`build-prompt.mjs` → `ai-review.mjs`).** Sends the evidence, the knowledge base and the
   decision tree to an Azure AI Foundry model to flag real changes and any drift between documents. The
   verdict is an input to review, not proof that content was fixed.
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

The review runs on an **Azure AI Foundry model deployment**, called from
[`tools/weekly-check/ai-review.mjs`](../tools/weekly-check/ai-review.mjs) using the Responses API and Node
built-ins only. It replaces GitHub Models, which entered a retirement brownout and began returning
HTTP 410.

Authentication is **Entra ID via GitHub OIDC**: the workflow requests an `id-token`, `azure/login` exchanges
it for an Azure token, and the script calls the endpoint with that short-lived bearer token. There is **no
API key** (key auth is disabled on the deployment) and **no stored client secret** — only a federated
credential on the app registration, scoped to this repository.

The review runs at **`xhigh` reasoning effort**: it is a weekly, whole-corpus pass over the knowledge base
*and* the decision tree, which is exactly the case that justifies the deepest reasoning available. Reasoning
tokens are billed against `max_output_tokens`, and a 30-day news window already spends around 18,000 of them,
so the budget is 32,000 — a response that comes back `incomplete` is discarded rather than half-parsed, since
the JSON contract is all-or-nothing. Both knobs are overridable via `AI_REASONING_EFFORT` and
`AI_MAX_OUTPUT_TOKENS`.

The prompt is written for a reasoning model rather than a chat model: it states the task first, then what
counts as evidence, then an explicit *precision beats recall* bar — **every finding must carry a Microsoft
source URL**, and style, wording and structure observations are out of scope. The model answers with a
structured `findings[]` array (file, locator, current text, correction, why, source, confidence, affected
claim), which `decide.mjs` renders directly into the issue or PR body. That shape is what makes a finding
reviewable: a human can check the cited source without reconstructing what the model meant.

Five repository secrets carry the coordinates, so nothing about the tenant, subscription, application or
resource appears in this public repo:

| Secret | Purpose |
| --- | --- |
| `AZURE_CLIENT_ID` | The app registration federated to this repository |
| `AZURE_TENANT_ID` · `AZURE_SUBSCRIPTION_ID` | Sign-in context for `azure/login` |
| `AZURE_AI_ENDPOINT` | e.g. `https://<resource>.services.ai.azure.com/openai/v1` |
| `AZURE_AI_DEPLOYMENT` | The model deployment name |

The service principal needs the **Cognitive Services OpenAI User** role on the AI resource, and a federated
credential per trusted subject (`ref:refs/heads/main` for scheduled and dispatched runs, `pull_request` for
knowledge-base PRs).

> **Note for implementers:** the model is a swappable component. Any provider works as long as the step
> writes the verdict JSON to `response.txt` — point `ai-review.mjs` at a different endpoint, or replace it
> with a provider-specific call. The step is `continue-on-error` and the script exits 0 on any failure, so a
> model outage degrades to "no AI verdict": the scripted checks still run, and no AI-only version bump
> is ever allowed.

### Golden test suite

<p align="center">
  <img src="./quality-gate.svg" alt="Quality gate: decision-rules.data.json is the single source of constants; it feeds evaluate.mjs, which replays 112 golden scenarios into a blocking CI gate, while check-rules-data.mjs verifies the same 187 constants against the decision-rules markdown in strict mode." width="960">
</p>

<sub>Runs on **every push and pull request** — separate from the weekly knowledge-base check (Mondays 05:00 UTC). Diagram source: [`quality-gate.architecture.json`](./quality-gate.architecture.json) · interactive: [`quality-gate.html`](./quality-gate.html).</sub>

The repo now includes [`tests/`](../tests/) with golden migration scenarios, consistency checks and
anti-regression cases. The suite guards the behaviours that were easiest to over-claim: unknowns on
decision-driving dependencies remain provisional, formerly unreachable branches stay reachable, retired tools
stay excluded, README/KB/rules versions remain aligned, and the output contract stays stable.

The gate list currently has 20 entries: `golden-scenarios-json`, `golden-scenarios-schema`,
`required-scenarios-registry`, `golden-decision-outcomes`, `output-consistency-invariant`,
`decision-distribution-sanity`, `must-not-recommend-metadata`, `forbidden-patterns`,
`rules-data-consistency`, `version-consistency`, `golden-rule-presence`, `branch-reachability`,
`no-silent-defaults`, `engine-guard-checks`, `interview-round-trip`, `cross-cloud-matrix-honoured`,
`contracts-wired`, `rule-index-consistent`, `retired-tooling-guard`, and `audit-scenario-coverage`.

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
- Workflow `permissions:` include `contents: write`, `pull-requests: write`, `issues: write`, `id-token: write`.
- For the model review, an Azure AI Foundry deployment plus five repository secrets — `AZURE_CLIENT_ID`,
  `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_AI_ENDPOINT`, `AZURE_AI_DEPLOYMENT` — and, on the app
  registration, the **Cognitive Services OpenAI User** role on the AI resource plus a federated credential
  per trusted subject (`repo:<owner>/<repo>:ref:refs/heads/main` and `repo:<owner>/<repo>:pull_request`).
  Without them the review step is skipped and every scripted check still runs.

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

1. **Keep the split**: `SKILL.md` (thin prompt logic) + input/output contracts + a knowledge base
   (source of truth) + `decision-rules.md` (tested policy) + `examples/` (tone calibration).
2. **Make the knowledge base the factual source** and ship the rules and contracts beside the skill. If the
   skill supports a live fetch, pin it to a release tag and keep the bundled copy as the normal path.
3. **Encode the guardrails in `SKILL.md`** (retired-tool list, layer separation, preview honesty) so the
   behaviour survives model changes.
4. **Adopt the freshness automation** (`tools/weekly-check/` + the workflow). Re-point `keywords.json`
   feeds/keywords to your domain. Point the review at your own model deployment, or wire
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
tested where it can be, honest about limits, and human-in-the-loop.

### Integrating into HVE Core

The intent is to contribute these building blocks to
[HVE Core](https://github.com/microsoft/hve-core) — Microsoft's **Hypervelocity Engineering** library of
Copilot agents, prompts, coding instructions, and skills. HVE Core already ships as a VS Code
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
  reuse the same tested-rules + freshness-automation pattern.
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

- [`skills/recommend-migration-path/SKILL.md`](../skills/recommend-migration-path/SKILL.md) — the skill contract and the full questionnaire.
- [`reference/input-contract.md`](../reference/input-contract.md) — the canonical input fields, option IDs and answer states.
- [`reference/output-contract.md`](../reference/output-contract.md) — the card shape, status vocabulary and self-check invariants.
- [`reference/decision-rules.md`](../reference/decision-rules.md) — the tested policy and rule index.
- [`examples/sample-recommendation.md`](../examples/sample-recommendation.md) — a worked run.
- [`docs/sql-server-to-azure-migration.md`](../docs/sql-server-to-azure-migration.md) — the knowledge base.

---

*This skill is prompt-driven markdown — no build step, no runtime dependencies. Fork it, re-point the
knowledge base, and adapt the interview to make it your own.*
