---
name: generate-migration-prerequisite-plan
description: "Builds a sourced, scenario-specific prerequisite plan for a SQL Server to Azure migration path. Consumes the structured output of recommend-migration-path or works standalone from a known target and method, asks only unresolved path-specific questions, and returns a readiness summary plus detailed prerequisites as polished Markdown, structured JSON, or both. Trigger when the user asks what must be ready before executing a recommended SQL migration, wants a migration prerequisites checklist, or asks for a partner-ready readiness plan."
allowed-tools: ask_user
---

# Skill: Generate Migration Prerequisite Plan

## Description

Turn one selected SQL Server-to-Azure migration path into an auditable prerequisite plan. This
skill begins after path selection: it does not select a target, change the Advisor recommendation,
provision resources, remediate findings or execute a migration.

It supports the 28 paths in
[`reference/path-catalog.json`](reference/path-catalog.json), using the source-backed knowledge base
[`docs/sql-server-to-azure-migration-prerequisite.md`](../../docs/sql-server-to-azure-migration-prerequisite.md).

## When to use

Use this skill when the user:

- has a `recommend-migration-path` result and wants the concrete prerequisites for that path;
- already knows the target and method and wants a standalone readiness checklist;
- needs a partner-delivery artifact for discovery, design, build, rehearsal or go/no-go;
- wants the prerequisite state as Markdown, JSON, or both.

Do not use it to choose a target, run an assessment, deploy Azure resources, open network ports,
move data, perform remediation, approve a design or certify production readiness.

## Contracts

Read these bundled files before asking anything:

1. [`reference/input-contract.md`](reference/input-contract.md)
2. [`reference/output-contract.md`](reference/output-contract.md)
3. [`reference/path-catalog.json`](reference/path-catalog.json)
4. [`reference/questions.json`](reference/questions.json)
5. [`schemas/input.schema.json`](schemas/input.schema.json)
6. [`schemas/output.schema.json`](schemas/output.schema.json)
7. [`../../docs/sql-server-to-azure-migration-prerequisite.md`](../../docs/sql-server-to-azure-migration-prerequisite.md)

If a file is missing, invalid, or reports a different prerequisite knowledge-base version, stop
with a policy-integrity warning. Never compensate with remembered or invented prerequisites.

## Input modes

### Advisor handoff

Accept pasted JSON or the recommendation fields already present in the conversation. Normalize the
public contract and regression-mirror shapes described by the input contract. Preserve:

- target, tier and method;
- Advisor knowledge-base/rule versions;
- recommendation status and confidence;
- target availability during synchronization and business cutover downtime;
- assumptions, blockers, unknowns and evidence requirements.

The Advisor output is context, not proof. Its self-reported evidence flags never confirm an
evidence-gated prerequisite by themselves.

### Standalone

Ask for target and migration method. Resolve them through the path catalog. If aliases match
multiple paths, ask the catalog disambiguation field only. Never infer Distributed AG versus
Always On AG, direct Arc restore versus endpoint-based restore, or bcp versus Smart Bulk Copy.

## Interview behavior

- Ask only fields listed in `commonQuestionFields` or the selected path's `questionFields`.
- Remove fields already supplied by the Advisor or by structured user input.
- Ask only while an answer can change at least one applicable prerequisite.
- Ask one question at a time with `ask_user`; never use multi-select.
- Ask each field at most once. Blank, declined, ambiguous and unrecognized answers become
  `UNKNOWN`.
- Use the user's language while recording canonical values.
- Do not ask for credentials, secrets, connection strings, customer identifiers or private key
  material.

## Operations

1. **Load and verify policy.** Confirm the four reference files, both schemas, and the prerequisite
   KB all declare schema/KB line `1.0`/`v1.1`.
2. **Normalize input.** Determine `advisor_handoff` or `standalone`, preserve unknowns, and show the
   sanitized normalized target/method back to the user.
3. **Resolve the path.** Match target and method aliases. Ask only the documented disambiguation
   question when needed. If unresolved, return the closest catalog labels without creating a plan.
4. **Load prerequisite layers.** Apply common prerequisites, target overlays, method overlays and
   the selected path section. Keep `required`, `conditional` and `recommended` separate.
5. **Carry inherited facts.** Consume compatible Advisor fields without re-asking. Expose conflicts.
6. **Ask missing path questions.** Follow `questions.json`; record answer type, canonical value and
   consuming prerequisite IDs.
7. **Evaluate prerequisite status.**
   - `confirmed`: typed answer or verified evidence satisfies it.
   - `missing`: typed answer establishes it is unmet.
   - `unknown`: it has not been established.
   - `not_applicable`: its applicability condition is demonstrably false.
8. **Derive overall status** exactly as defined in the output contract.
9. **Self-check.** Run all 13 output invariants. Expose any failure instead of silently repairing it.
10. **Render.** Build the JSON object first. Render polished Markdown from the same object using the
    template. Return the requested format.

## Path-specific support labels

Keep these caveats visible:

- `P14` is a composed pattern: Data Box transports the seed; a separately supported mechanism must
  perform delta synchronization.
- `P15` is third-party: distinguish Striim requirements from Microsoft Azure SQL requirements.
- `P16` uses a Preview Migration Assistant against a GA Fabric SQL database target.
- `P22` is an official Azure sample, not an Azure service, supported migration product or SLA. Its
  `Azure-Samples/smartbulkcopy` repository is archived, and its README requires .NET Core 3.1, a
  runtime that is out of support.

## Output

Lead with the readiness verdict and blocker count, then render:

1. area summary;
2. detailed prerequisite table;
3. blocking actions;
4. remaining unknowns;
5. assumptions and inherited Advisor facts;
6. ordered next actions;
7. official source register.

Use the exact table columns:

| Area | Prerequisite | Status | Blocking | Owner | Evidence required | Official source |
| --- | --- | --- | --- | --- | --- | --- |

Every row must retain its stable prerequisite ID even when the visible title is shortened.

## Guardrails

- Never silently default an unknown.
- Never promote free prose to confirmed.
- Never re-ask an Advisor-supplied fact.
- Never report `ready` while an applicable required item is missing or unknown.
- Never let a recommended item block readiness.
- Never present preview, third-party, sample or composed-pattern support as first-party GA service
  support.
- Never describe Smart Bulk Copy as an Azure service, product or supported migration runtime, and
  always surface its archived-sample status when rendering readiness.
- Never create a Markdown conclusion that is absent from the JSON state.
- Never echo sensitive identifiers.
