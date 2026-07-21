# How the `sql-migration-advisor` skill works

*A guide for implementers and program managers who want to ship, host, or adapt this skill.*

This document explains three things:

1. **How the skill works** — the runtime loop, end to end.
2. **How an agent gets value from it** — why a prompt-driven skill beats asking a raw model.
3. **How it stays current** — the weekly GitHub Action that keeps the knowledge base fresh.

It closes with implementation notes for porting the pattern to a Microsoft-owned open-source repo.

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

```mermaid
flowchart TD
    U["User: migrate a SQL Server environment to Azure"] --> T{"Trigger matches<br/>SKILL.md description?"}
    T -- yes --> L["Load the source of truth"]
    L --> KB["docs/sql-server-to-azure-migration.md<br/>fetched live"]
    L -. "offline fallback" .-> DR["reference/decision-rules.md"]
    KB --> I["Guided interview<br/>~8-11 questions, one at a time, via ask_user"]
    DR --> I
    I --> S["Score with Steps A to D<br/>deterministic decision engine"]
    S --> O["Recommendation card<br/>target · method · downtime · blockers · cost · program"]
    O --> F["Optional follow-ups<br/>runbook · per-DB table · one-slide hand-off"]
```

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

```mermaid
flowchart LR
    Agent["GitHub Copilot agent"] -->|loads| SK
    subgraph Repo["sql-migration-advisor (open-source repo)"]
        SK["SKILL.md<br/>trigger · principles · interview · card template"]
        DR["reference/decision-rules.md<br/>deterministic engine A to D · offline fallback"]
        KB["docs/…migration.md + .pdf<br/>knowledge base · source of truth"]
        EX["examples/sample-recommendation.md"]
        LAB["lab/ · hands-on lab"]
        subgraph CI["Freshness automation"]
            WF[".github/workflows/weekly-kb-check.yml<br/>+ tools/weekly-check/*.mjs"]
        end
    end
    SK -->|grounds every answer in| KB
    SK -. "offline fallback" .-> DR
    EX -. "calibrates tone" .-> SK
    WF -->|re-verifies + version-bumps| KB
    WF -->|syncs freshness stamp| DR
```

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

```mermaid
sequenceDiagram
    autonumber
    participant Cron as Schedule / manual dispatch
    participant GA as GitHub Action
    participant Lychee as Link check (lychee)
    participant News as gather-news.mjs (RSS)
    participant AI as GPT-5 review (GitHub Models)
    participant Dec as decide.mjs
    participant App as apply-update.mjs
    participant PR as Pull Request
    Cron->>GA: trigger
    GA->>Lychee: verify every link in the KB
    GA->>News: fetch Azure / SQL news (7-day window, keyword-filtered)
    GA->>AI: full KB + full decision tree + link report + news
    AI-->>GA: JSON verdict — needsUpdate, bump, changelog, suggestions
    GA->>Dec: broken links? OR needsUpdate?
    alt something is stale
        Dec->>App: bump version + prepend changelog + sync decision-rules stamp
        App->>GA: regenerate PDF + preview (best-effort)
        GA->>PR: open "Weekly KB freshness update" for human review
    else nothing changed
        Dec-->>GA: no-op (writes a job summary only)
    end
```

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

### Related reading

- [`SKILL.md`](../SKILL.md) — the skill contract and the full questionnaire.
- [`reference/decision-rules.md`](../reference/decision-rules.md) — the deterministic engine.
- [`examples/sample-recommendation.md`](../examples/sample-recommendation.md) — a worked run.
- [`docs/sql-server-to-azure-migration.md`](../docs/sql-server-to-azure-migration.md) — the knowledge base.

---

*This skill is prompt-driven markdown — no build step, no runtime dependencies. Fork it, re-point the
knowledge base, and adapt the interview to make it your own.*
