# Input contract

The single source of truth for what the interview collects, what each field means, and what happens when it is not known.

`SKILL.md` shows human labels and records **IDs**. The decision rules match on IDs. A label can be translated or reworded without touching a rule; an ID cannot drift.

**Version:** coordinated with the knowledge base line stated in `SKILL.md`.

---

## 1. Contract principles

1. **Rules consume IDs, never displayed labels.** Matching on prose is how the interview and the rules stopped speaking the same language: the rules answered to `assessment-only` while the interview displayed `Assessment only`, and 86 green scenarios coexisted with an interview whose answers were discarded.
2. **`NONE_CONFIRMED`, `UNKNOWN` and `NOT_APPLICABLE` are three different answers.** Collapsing them is the single defect this repository has fixed four times.
3. **Never infer a hard-gate value from neighbouring prose.** "We are fairly modern" is not a version.
4. **A blank, declined or unrecognised answer resolves to `UNKNOWN`.** Never to `NONE_CONFIRMED`.
5. **Keep the user's own words when useful**, but never let them reach a rule directly. Normalise first.
6. **Every field here has at least one consumer.** A field no rule reads is a question that wastes the user's time, and it is removed rather than kept for appearances.

---

## 2. Answer semantics

| Value | Meaning | Effect on a hard gate |
|---|---|---|
| `NONE_CONFIRMED` | The user checked and there are none | Clears the blocker |
| `UNKNOWN` | Not checked, declined, blank, or unrecognised | Holds the candidate at `unknown_requires_assessment` and adds an entry to `evidenceRequired` |
| `NOT_APPLICABLE` | The question cannot apply to this profile | Neither clears nor blocks; excluded from the trace |

The distinction is the whole point. "We have no linked servers" clears a blocker on Azure SQL Database. "I have not looked at linked servers" must not.

---

## 3. Option IDs

Show the label. Record the ID.

### Scope — `scope`

| Label | ID |
|---|---|
| Single database | `SINGLE_DB` |
| A few databases (2–10) | `FEW_DATABASES` |
| Large estate (10+ servers/DBs) | `LARGE_ESTATE` |

### Source location — `source_location`

| Label | ID |
|---|---|
| On-prem | `ON_PREM` |
| AWS EC2 | `AWS_EC2` |
| AWS RDS for SQL Server | `AWS_RDS` |
| GCP Compute Engine | `GCP_COMPUTE` |
| GCP Cloud SQL | `GCP_CLOUD_SQL` |

### Source version — `source_version`

| Label | ID |
|---|---|
| 2008/2008 R2 | `SQL2008` |
| 2012 | `SQL2012` |
| 2014 | `SQL2014` |
| 2016 | `SQL2016` |
| 2017/2019 | `SQL2017_2019` |
| 2022 | `SQL2022` |
| 2025 | `SQL2025` |

### Migration intent — `intent`

| Label | ID |
|---|---|
| Move to Azure now | `MIGRATE_NOW` |
| Modernize in place / not ready to move yet (assess first) | `MODERNIZE_IN_PLACE` |
| Assessment only | `ASSESSMENT_ONLY` |
| Rehost first, modernize later | `REHOST_FIRST` |

### Primary driver — `driver`

| Label | ID |
|---|---|
| End-of-support / ESU pressure | `EOS_ESU` |
| Cost optimization | `COST` |
| App modernization | `APP_MODERNIZATION` |
| Data-center exit (VMware estate) | `DATACENTER_EXIT` |
| Analytics / Fabric unification | `FABRIC_ANALYTICS` |
| Sovereignty / edge | `SOVEREIGNTY_EDGE` |

### Management model — `management_model`

| Label | ID |
|---|---|
| Fully managed PaaS | `MANAGED_PAAS` |
| Need OS / file-system / engine control | `OS_CONTROL` |
| Need Kubernetes on-prem / edge / multi-cloud | `KUBERNETES` |

### Kubernetes engine model — `kubernetes_model`

| Label | ID |
|---|---|
| Managed engine (Arc data controller) | `ARC_MANAGED_ENGINE` |
| Full DIY container | `DIY_CONTAINER` |

---

## 4. Canonical fields

### Triage — always collected

| Field | Type | Values | Consumed by | When `UNKNOWN` |
|---|---|---|---|---|
| `scope` | ID | `SINGLE_DB` · `FEW_DATABASES` · `LARGE_ESTATE` | Estate-discovery branch | Treated as a single profile; the estate branch does not fire |
| `source_location` | ID | 5 location IDs | MI Link, transactional replication, native restore, cross-cloud matrix | MI Link and replication become `unknown_requires_assessment` |
| `source_version` | ID | 7 version IDs | Every version floor: MI Link 2016+, LRS 2008–2022, AG 2012+, DAG 2016+, replication publisher 2016+, Arc 2014+ | All version-gated methods become `unknown_requires_assessment` |
| `intent` | ID | 4 intent IDs | Arc in-place control-plane path | Assumed `MIGRATE_NOW`, stated as an assumption |
| `driver` | ID | 6 driver IDs | Fabric branch, AVS branch, ranking preference | No driver-specific branch fires; ranking falls back to compatibility |
| `management_model` | ID | 3 model IDs | PaaS vs IaaS vs Kubernetes family | Blocks the family split; return a shortlist |
| `feature_dependencies` | list | See §5 | Phase A eligibility for SQL MI and SQL DB | SQL MI and SQL DB held at `unknown_requires_assessment` |
| `size` | enum | `< 150 GB` · `150 GB – 4 TB` · `> 4 TB` · `> 128 TB` | Hyperscale ceiling, seeding strategy, tier selection | Tier held at `unknown_requires_assessment` |
| `downtime` | enum | `near-zero` · `minimal` · `offline` | Method ranking and the cutover class | `businessCutoverDowntime` becomes `unknown_requires_assessment`; never inferred from the chosen method |
| `network_ports` | enum | See §6 | MI Link viability, Data Box seeding | MI Link becomes `unknown_requires_assessment` |
| `compliance` | enum | `standard commercial` · `EU data boundary` · `government / sovereign` · `edge / air-gapped` | Regional and sovereignty constraints | Sovereignty-restricted targets are not ranked first |

### Conditional — collected only when a candidate is still in play

| Field | Type | Required when | Consumed by | When `UNKNOWN` |
|---|---|---|---|---|
| `kubernetes_model` | ID | `management_model = KUBERNETES` | Arc-enabled SQL MI vs container | Both held at `unknown_requires_assessment` |
| `source_os` | string | MI Link is a candidate | MI Link host gate: Windows Server 2012+, Linux from SQL Server 2017 | **MI Link refused.** Fail-closed: an unverified prerequisite is not a satisfied prerequisite |
| `source_edition` | string | MI Link is a candidate | MI Link edition gate: Enterprise, Standard, Developer | **MI Link refused** |
| `performance` | free text | SQL MI or SQL DB survives | Service-tier selection | Tier becomes `unknown_requires_assessment`; never defaults to General Purpose |
| `tenant_count` | free text | SQL DB survives | Elastic Pool selection | Elastic Pool is not selected |
| `database_count` | integer | More than one database | MI Link capacity: 100 GP/BC, 500 Next-gen GP | Capacity becomes `unknown_requires_assessment` when the count could exceed a tier limit |
| `fabric_constraints` | free text | `driver = FABRIC_ANALYTICS` | Fabric Migration Assistant gates only, never the target | Fabric held at `unknown_requires_assessment` |
| `migration_batch_size` | integer | The Arc portal migration is used | Arc wizard batch limit | Not evaluated |
| `arc_extension_version` | version string | The Arc portal migration is used | Arc wizard batch limit: 10 per batch from 1.1.3348.364, otherwise 1 | **Not treated as recent.** Yields `unknown_requires_assessment` |
| `evidence` | 4 booleans | The user reports an assessment was run | Recorded as claims to verify elsewhere | No effect: this skill reads no artefact |

---

## 5. Feature dependencies

Asked in two steps so that "none" and "not checked" cannot collapse.

**Step 1**, single select: `None of them, confirmed` → `NONE_CONFIRMED` · `Let me list them` → opens step 2 · `Not checked yet` → `UNKNOWN`

**Step 2**, free text, only after the user chose to list:

| Value | Consumed by |
|---|---|
| `FILESTREAM` / `FileTable` | Hard block on SQL MI and SQL DB |
| `PolyBase` | Requires the qualifier below |
| `DTC` | Requires the qualifier below |
| `Cross-DB queries` | SQL MI remediation, SQL DB block |
| `SQL CLR` | SQL MI remediation, SQL DB block |
| `Linked servers` | SQL MI remediation, SQL DB hard block |
| `SQL Agent jobs` | SQL MI native, SQL DB via Elastic Jobs |
| `Service Broker` | SQL MI remediation, SQL DB block |
| `TDE` | Certificate migration, method selection |

**A free-text list matching nothing is `UNKNOWN`, not `NONE_CONFIRMED`.** The user committed to listing; failing to recognise their words is our problem, not evidence of absence.

### Qualifiers

| Field | Asked when | Values |
|---|---|---|
| PolyBase kind | PolyBase is listed | Cloud files only · External RDBMS connector · S3/Delta/pushdown · `UNKNOWN` |
| DTC topology | DTC is listed | SQL-to-SQL only · Heterogeneous / third-party RDBMS · `UNKNOWN` |
| CLR permission set | CLR is listed or unknown, and a PaaS target survives | SAFE · EXTERNAL_ACCESS · UNSAFE · `UNKNOWN` |

---

## 6. Network and ports

| Value | Meaning |
|---|---|
| `Good ExpressRoute / high bandwidth` | Bandwidth is not a constraint |
| `Ports confirmed open in both directions` | 5022 and 11000–11999 verified in the documented directions. **The only value that lets MI Link be confirmed** |
| `Limited WAN` | Bandwidth constrains the seeding strategy |
| `Very large multi-TB move` | Consider Data Box seeding |
| `5022 or 11000–11999 blocked` | MI Link `unsupported` |
| `1433/443 blocked or unknown` | Blob upload paths need verification |
| `Not sure` | `UNKNOWN` |

Before this contract, a user could declare ports blocked but not confirmed open, so MI Link could only ever be un-refuted, never confirmed.

---

## 7. Compact profile mode

The interview may run to twenty turns or more. Accept a profile up front, in prose or structured form, then ask **only** for the fields that are both missing and capable of changing a surviving candidate.

Rules:

- Normalise the supplied profile into the fields above before asking anything.
- Show the normalised profile back to the user before recommending, so a misreading is visible.
- A field the user supplied is never asked again.
- A field that cannot change any surviving candidate is not asked at all.

---

## 8. Validation rules

1. Every field in §4 has a question in `SKILL.md`, a type, at least one consumer in `reference/decision-rules.md`, and at least one golden scenario whose answer changes because of it.
2. Every option ID in §3 is known to the rules mirror, and every ID the mirror knows appears here.
3. A displayed label and its ID reach the same rule.
4. No hard gate consumes a field absent from this contract.
5. A blank or unrecognised answer never resolves to `NONE_CONFIRMED`.

Rules 1 to 3 are enforced by the `interview-round-trip` and field-coverage gates in `tests/run-tests.mjs`. Rules 4 and 5 are enforced by the golden scenarios.
