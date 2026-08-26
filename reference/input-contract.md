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
| Azure VM | `AZURE_VM` |
| AWS EC2 | `AWS_EC2` |
| AWS RDS for SQL Server | `AWS_RDS` |
| GCP Compute Engine | `GCP_COMPUTE` |
| GCP Cloud SQL | `GCP_CLOUD_SQL` |

`AZURE_VM` was added in v2.12. It had been folded into `ON_PREM` through the shared
"on-prem / Azure VM" label, even though several rules turn on whether the source is already in
Azure — the network path to a Managed Instance, the Blob upload route, and whether a data-center
exit driver applies at all. `ON_PREM` keeps its old meaning, so an existing answer stays valid;
a source already running in Azure should now say so.

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

### Largest database size — `size`

**The classes do not overlap.** Until v2.1 the question offered both `> 4 TB` and `> 128 TB`, so a 200 TB database matched two answers and the reader chose which one meant it.

| Label | ID |
|---|---|
| < 150 GB | `UNDER_150_GB` |
| 150 GB – 4 TB | `FROM_150_GB_TO_4_TB` |
| > 4 TB – 128 TB | `FROM_4_TB_TO_128_TB` |
| > 128 TB | `OVER_128_TB` |
| Not sure | `UNKNOWN` |

### Cutover downtime tolerance — `downtime`

| Label | ID |
|---|---|
| Near-zero | `NEAR_ZERO` |
| Minimal (minutes to a short window) | `MINIMAL` |
| Offline (full restore window acceptable) | `OFFLINE` |
| Not sure | `UNKNOWN` |

### Sovereignty and residency — `compliance`

| Label | ID |
|---|---|
| Standard commercial | `STANDARD_COMMERCIAL` |
| EU data boundary | `EU_DATA_BOUNDARY` |
| Government / sovereign cloud | `GOVERNMENT_SOVEREIGN` |
| Edge / air-gapped / disconnected | `EDGE_AIR_GAPPED` |
| Not sure | `UNKNOWN` |

### List-or-none intents

Three questions ask whether something exists before asking what it is, so that *none* and *not checked* cannot collapse into the same blank answer.

| Field | Labels and IDs |
|---|---|
| `feature_dependencies_intent` | None of them, confirmed → `NONE_CONFIRMED` · Let me list them → `LIST_FEATURES` · Not checked yet → `UNKNOWN` |
| `ancillary_services_intent` | None, confirmed → `NONE_CONFIRMED` · Let me list them → `LIST_SERVICES` · Not checked yet → `UNKNOWN` |
| `tier_drivers_intent` | None, confirmed → `NONE_CONFIRMED` · Let me list them → `LIST_TIER_DRIVERS` · Not sure → `UNKNOWN` |

### Source host and edition — `source_os`, `source_edition`

| Field | Labels and IDs |
|---|---|
| `source_os` | Windows Server 2012 or later → `WINDOWS_SERVER_2012_OR_LATER` · Windows Server before 2012 → `WINDOWS_SERVER_BELOW_2012` · Windows 10/11 client → `WINDOWS_CLIENT` · Linux → `LINUX` · Not sure → `UNKNOWN` |
| `source_edition` | Enterprise → `ENTERPRISE` · Standard → `STANDARD` · Developer → `DEVELOPER` · Express → `EXPRESS` · Web → `WEB` · Not sure → `UNKNOWN` |

### Encryption, permissions and authentication

| Field | Labels and IDs |
|---|---|
| `tde_status` | TDE enabled → `TDE_ENABLED` · TDE not enabled → `TDE_NOT_ENABLED` · Not sure → `UNKNOWN` |
| `clr_permission_set` | SAFE → `CLR_SAFE` · EXTERNAL_ACCESS → `CLR_EXTERNAL_ACCESS` · UNSAFE → `CLR_UNSAFE` · Not sure → `UNKNOWN` |
| `source_permissions` | sysadmin available on the source → `SYSADMIN_AVAILABLE` · Limited rights → `LIMITED_RIGHTS` · Not sure → `UNKNOWN` |
| `authentication` | SQL logins only → `SQL_LOGINS_ONLY` · Windows / AD logins → `WINDOWS_LOGINS` · Microsoft Entra ID → `ENTRA_ID` · Mixed → `MIXED_AUTH` · Not sure → `UNKNOWN` |

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
| `size` | ID | `UNDER_150_GB` · `FROM_150_GB_TO_4_TB` · `FROM_4_TB_TO_128_TB` · `OVER_128_TB` | Hyperscale ceiling, seeding strategy, tier selection | Tier held at `unknown_requires_assessment` |
| `downtime` | ID | `NEAR_ZERO` · `MINIMAL` · `OFFLINE` | Method ranking and the cutover class | `businessCutoverDowntime` becomes `unknown_requires_assessment`; never inferred from the chosen method |
| `network_bandwidth` | ID | See §6 | Seeding strategy, Data Box | Seeding strategy not asserted |
| `mi_link_ports` | ID | See §6 | MI Link viability | MI Link becomes `unknown_requires_assessment` |
| `blob_https_reachability` | ID | See §6 | `BACKUP-BLOB-PATH`: any backup/restore or BACPAC path to Azure Blob | **The method gate cannot report `passed`.** It becomes `unknown_requires_assessment` |
| `network_ports` | composite | Legacy. Superseded by the three fields above; the mirror reads it as their union so scenarios written before the split still run | MI Link viability, Data Box seeding | Same as the field it stands in for |
| `compliance` | ID | `STANDARD_COMMERCIAL` · `EU_DATA_BOUNDARY` · `GOVERNMENT_SOVEREIGN` · `EDGE_AIR_GAPPED` | Regional and sovereignty constraints | Sovereignty-restricted targets are not ranked first |

### Conditional — collected only when a candidate is still in play

| Field | Type | Required when | Consumed by | When `UNKNOWN` |
|---|---|---|---|---|
| `kubernetes_model` | ID | `management_model = KUBERNETES` | Arc-enabled SQL MI vs container | Both held at `unknown_requires_assessment` |
| `source_os` | ID | MI Link is a candidate | MI Link host gate: Windows Server 2012+, Linux from SQL Server 2017 | MI Link becomes `unknown_requires_assessment`, and the host appears in `evidenceRequired`. A host nobody checked is not a host known to be unsupported: refusing on absence of evidence makes an information gap look like an incompatibility |
| `source_edition` | ID | MI Link is a candidate | MI Link edition gate: Enterprise, Standard, Developer | MI Link becomes `unknown_requires_assessment`. A **known** Express or Web edition eliminates MI Link only, never the MI target |
| `clr_permission_set` | ID | SQL CLR is listed, or unknown, while a PaaS target survives | `CLR-PERMISSION` | SQL MI and SQL DB held at `unknown_requires_assessment` |
| `tde_status` | ID | A backup-based method is a candidate | Certificate migration before restore | Held at `unknown_requires_assessment`; never assumed absent |
| `source_permissions` | ID | An orchestrated method or SSMS 22 is recommended | Tooling prerequisites, AG endpoints | Stated as required evidence, never assumed present |
| `authentication` | ID | Always, once a target survives | Login and user migration effort | Recorded as an unknown; logins are never assumed to be SQL-only |
| `rpo` | free text | A target survives and HA/DR matters | Target HA/DR design, method suitability | Recorded as required evidence; no HA/DR posture is asserted |
| `rto` | free text | A target survives and HA/DR matters | Target HA/DR design, method suitability | Recorded as required evidence |
| `target_region` | free text | A target survives | Regional feature availability, sovereignty | Regional availability stated as unverified |
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
| CLR permission set | CLR is listed or unknown, and a PaaS target survives | `CLR_SAFE` · `CLR_EXTERNAL_ACCESS` · `CLR_UNSAFE` · `UNKNOWN` |

**`CLR_SAFE` is not a clearance.** Under `clr strict security`, on by default since SQL Server 2017, the engine treats SAFE and EXTERNAL_ACCESS assemblies as if they were UNSAFE unless they are signed or their hash is trusted. Reporting SAFE as *favorable* overstates what it proves. See `CLR-PERMISSION` in the decision rules.

---

## 6. Network — three separate questions

One question used to mix bandwidth, MI Link ports and Blob reachability. They gate different things, so a single answer could satisfy one while leaving another unverified — and in a real session that produced a method gate reported as `passed` while the Blob path was unknown.

### Bandwidth — `network_bandwidth`

| Label | ID |
|---|---|
| Good ExpressRoute / high bandwidth | `GOOD_BANDWIDTH` |
| Limited WAN | `LIMITED_WAN` |
| Very large multi-TB move | `VERY_LARGE_MULTI_TB` |
| Not sure | `UNKNOWN` |

### MI Link ports — `mi_link_ports`

| Label | ID |
|---|---|
| Confirmed open in both directions, 5022 and 11000–11999 | `PORTS_CONFIRMED_OPEN` |
| 5022 or 11000–11999 blocked | `PORTS_BLOCKED` |
| Not sure | `UNKNOWN` |

`PORTS_CONFIRMED_OPEN` is **the only value that lets MI Link be confirmed**. Before this contract a user could declare ports blocked but never confirmed open, so MI Link could only be un-refuted, never verified.

### Blob reachability — `blob_https_reachability`

| Label | ID |
|---|---|
| HTTPS to Azure Blob confirmed, upload tested | `BLOB_HTTPS_CONFIRMED` |
| Blocked by proxy, firewall or policy | `BLOB_HTTPS_BLOCKED` |
| Not verified | `BLOB_HTTPS_UNKNOWN` |

Every backup-based method — native `.bak` restore, BACPAC, Data Box seeding — moves through this path. It is the field `BACKUP-BLOB-PATH` consumes, and an unverified path is what keeps that gate at `unknown_requires_assessment` rather than `passed`.

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
