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
deterministic. A weekly GitHub Action re-verifies the knowledge base and opens a pull request when
something is stale.

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
3. **Interview first, recommend second.** It asks ~8–11 short, mostly multiple-choice questions **one
   at a time** (scope, source version, downtime tolerance, instance-level feature dependencies, size,
   sovereignty, …). It never guesses the path before asking, and skips branches that don't apply.
4. **Score deterministically.** It applies the decision engine's **Steps A→D**: pick the **Target**
   → pick the **Method** → classify **downtime + blockers** → attach **cost levers + program + the next
   assessment tool**. Same answers ⇒ same recommendation.
5. **Output a recommendation card.** A readable Markdown card: target, method, downtime class, blockers
   with remediations, cost levers (AHB / ESU), and the Microsoft program fit. See
   [`examples/sample-recommendation.md`](../examples/sample-recommendation.md) for a worked run.
6. **Offer follow-ups.** A per-database table for an estate, a cutover runbook, or a one-slide summary
   (handed off to another skill).

### Deterministic core, adaptive agent

A common question: *"if it's deterministic, can the agent still adapt to a complex situation?"* Yes —
there are **two layers**, and only the inner one is rigid:

| Layer | What it does | Behaviour |
| --- | --- | --- |
| **Deterministic core** (`decision-rules.md`, Steps A→D) | The *what*: which target + method for a given profile. | Rigid **by design** — reproducible, auditable, no invented paths or retired tools. |
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
- **Built-in guardrails reduce hallucination.** Hard rules — never recommend retired tooling (DMA, the
  Azure Data Studio extension, DMS *classic*); always separate **target / control plane / method**; be
  honest about previews and size caps.
- **Deterministic and auditable.** The same profile always yields the same core recommendation, so a
  partner can reproduce and defend the advice.
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
| [`SKILL.md`](../SKILL.md) | The skill itself: trigger `description`, core principles, the ~10-question interview, the output-card template, and guardrails. |
| [`reference/decision-rules.md`](../reference/decision-rules.md) | The deterministic engine (Steps A→D). Distilled from the knowledge base; used as the **offline fallback**. |
| [`docs/sql-server-to-azure-migration.md`](../docs/sql-server-to-azure-migration.md) | The **knowledge base** — every target family, method, tool and commercial lever, with Microsoft Learn links. The single source of truth. |
| [`docs/sql-server-to-azure-migration.pdf`](../docs/sql-server-to-azure-migration.pdf) | The same knowledge base as a branded, partner-ready PDF (regenerated by the pipeline in `tools/pdf/`). |
| [`examples/sample-recommendation.md`](../examples/sample-recommendation.md) | A worked end-to-end example that calibrates tone and the card format. |
| [`lab/`](../lab/) | A self-contained hands-on lab (legacy SQL Server 2016 → SQL Server on Azure VM). |
| `.github/workflows/weekly-kb-check.yml` + `tools/weekly-check/` | The weekly freshness automation (see §5). |

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

1. **Link check (`lychee`).** Verifies every URL in the knowledge base; broken/moved links alone are
   enough to warrant a PR.
2. **Gather news (`gather-news.mjs`).** Pulls public Microsoft RSS feeds (Azure Updates, Azure SQL Blog,
   SQL Server Blog), filters by an include/exclude keyword list ([`keywords.json`](../tools/weekly-check/keywords.json))
   over a rolling 7-day window. No dependencies — plain `fetch` + a small RSS parser.
3. **AI review (`build-prompt.mjs` → GitHub Models).** Sends the **full** knowledge base **and** the
   **full** decision tree, plus the link report and news, and asks the model to flag real changes
   *and any drift between the two documents*. It replies with a single JSON verdict:
   `{ needsUpdate, bump, changelog, suggestions }`.
4. **Decide (`decide.mjs`).** A PR is warranted if there are broken links **or** the review returns
   `needsUpdate: true`. It writes the changelog line and the PR body (substantive edits are *suggested*
   for a human, never auto-written into the prose).
5. **Apply (`apply-update.mjs`).** Deterministically bumps the version, prepends a changelog row, keeps
   the README badge/changelog in sync, and syncs the decision-tree's freshness stamp. Then the PDF and
   preview are regenerated (best-effort).
6. **Open a PR.** `peter-evans/create-pull-request` opens *"Weekly KB freshness update"* on the
   `weekly-kb-update` branch with labels `automated` + `knowledge-base`. **A human reviews and merges** —
   the automation never pushes content edits straight to `main`.

### The review model

The review runs on **`openai/gpt-5`** via GitHub Models (`actions/ai-inference@v2`), using the built-in
`GITHUB_TOKEN` with `permissions: models: read` — **no external secret required**. GPT-5 was chosen
because it is the most capable model *available on GitHub Models*: it reasons, has broad up-to-date
knowledge, and has a 200K-token context window and 100K-token output budget — enough to review the whole
KB plus the decision tree in one pass (~16K tokens of input today).

> **Note for implementers:** GitHub Models does **not** host any Anthropic/Claude models — only OpenAI,
> Meta, Microsoft, Mistral AI, DeepSeek and Cohere. To run Claude (or any non-hosted model) you must
> replace the `actions/ai-inference` step with a provider call (Anthropic API, Amazon Bedrock, or
> **Microsoft Foundry**) and add the corresponding secret. The AI step is `continue-on-error`, so even if
> the review fails, the link check + version bump still run and the workflow never breaks.

### Prerequisites for the automation

- Repo setting **Settings → Actions → General → "Allow GitHub Actions to create and approve pull requests"** enabled.
- Workflow `permissions:` include `contents: write`, `pull-requests: write`, `models: read`.

---

## 6. Design principles & guardrails (worth preserving when you port it)

- **Interview first, recommend second** — never guess the path; ask one question at a time.
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
5. **Keep humans in the loop** — the Action opens a PR; it does not auto-merge content.
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

- **Advisor — shipped (green).** This repo. It interviews the user, scores Steps A→D, and returns a
  grounded, self-refreshing recommendation (target, method, downtime, blockers, cost levers, program fit).
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

> **Squad in action** — <!-- SQUAD_VIDEO_URL: paste the Squad demo video URL here to embed/link it -->
> watch the walkthrough on the [Squad repository](https://github.com/bradygaster/squad).

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
