# Input contract — `generate-migration-prerequisite-plan`

> **Schema version:** `1.0`
> **Prerequisite knowledge-base line:** `v1.2`

This contract accepts either the structured result of `recommend-migration-path` or a standalone
target-and-method selection. Both modes normalize into one selected path from
[`path-catalog.json`](path-catalog.json), then collect only the facts that can change a prerequisite
status for that path.

## 1. Modes

| Mode | Required input | Behavior |
| --- | --- | --- |
| `advisor_handoff` | The Advisor JSON object or its recommendation fields | Preserve the Advisor target, tier, method, assumptions, blockers, unknowns, evidence requirements and provenance. Do not re-ask a fact already present. |
| `standalone` | Target and migration method | Resolve the pair to one catalog path, then ask the path's unresolved prerequisite questions. |

If the target/method pair resolves to zero paths, return `unresolved_path`. If it resolves to more
than one path, ask only the catalog's disambiguation question. Never choose a path by guessing.

## 2. Accepted Advisor shapes

The handoff accepts both shapes already emitted inside this repository:

1. The public card contract: `recommendation.primary.target`, `recommendation.primary.tier`,
   `recommendation.primary.method`, `recommendationStatus`, `confidence`, `unknowns`,
   `hardBlockers`, `evidenceRequired`, and `knowledgeBase`.
2. The regression-mirror shape: `primary_target` or `primaryTarget`, `tier`, `method`,
   `targetAvailabilityDuringSync`, `businessCutoverDowntime`, `recommendationStatus`,
   `confidence`, `unknowns`, `hardBlockers`, and `evidenceRequired`.

Normalize the two shapes before applying prerequisite rules. The handoff is a recommendation, not
proof that its assumptions or user-reported evidence were verified.

## 3. Absence and evidence semantics

| Value | Meaning | Prerequisite effect |
| --- | --- | --- |
| `CONFIRMED` | A typed answer or evidence record satisfies the requirement | `confirmed` |
| `MISSING` | A typed answer establishes that the requirement is not met | `missing` |
| `UNKNOWN` | Not assessed, blank, declined, ambiguous or unrecognized | `unknown` |
| `NOT_APPLICABLE` | The applicability condition is demonstrably false | `not_applicable` |

Never convert free prose such as “network should be fine” into `CONFIRMED`. A confirmation that
requires evidence needs an evidence record containing its type, date, origin and a shareable
reference or hash. A self-declared Advisor evidence flag remains a claim until that record exists.

## 4. Top-level request

```json
{
  "schemaVersion": "1.0",
  "mode": "advisor_handoff",
  "requestedOutput": "both",
  "language": "en",
  "advisorOutput": {},
  "standaloneSelection": null,
  "knownFacts": {},
  "evidence": []
}
```

`requestedOutput` is `markdown`, `json`, or `both`. Markdown and JSON render the same normalized
decision state; neither format may add an inference missing from the other.

## 5. Canonical facts

The authoritative field-to-path mapping is in `path-catalog.json`. Ask a field only when it is
listed in `commonQuestionFields` or the selected path's `questionFields`, is not already answered,
and can still change at least one applicable prerequisite.

**Disambiguation exception.** A field named in a path's `disambiguation` block is askable even
before a path is selected, because it exists to choose between candidate paths. `ha_migration_pattern`
(P01 vs P02) and `arc_restore_entrypoint` (P17 vs P18) are askable only through this exception;
neither field is listed in `commonQuestionFields` or in any path's `questionFields`. `bulk_copy_tool`
and `dms_migration_mode` need no exception because their disambiguation field is already inside the
`questionFields` of the paths they distinguish.

### Common source, target and operational facts

| Field | Type | Purpose |
| --- | --- | --- |
| `source_version` | version label or absence marker | Product and method version floors |
| `source_edition` | edition or absence marker | HA, MI Link and feature eligibility |
| `source_os` | OS family/version or absence marker | Windows/Linux/container/platform gates |
| `source_location` | location or absence marker | On-premises, hosted VM and managed-source constraints |
| `database_count` | positive integer or absence marker | Link, restore and batching limits |
| `largest_database_size_gb` | non-negative number or absence marker | Capacity, transfer and time-window feasibility |
| `target_region` | Azure/Fabric region or absence marker | Regional service and capacity availability |
| `target_tier` | target service tier or absence marker | Capacity, cutover and HA prerequisites |
| `source_permissions` | structured role/status | Source-side operations |
| `target_permissions` | structured role/status | Azure, Fabric, SQL and Kubernetes operations |
| `downtime_tolerance` | duration/class or absence marker | Cutover feasibility |
| `rpo` / `rto` | duration or absence marker | Synchronization, cutover and rollback gates |
| `peak_change_rate` | measured rate or absence marker | Catch-up feasibility |
| `performance_baseline_status` | readiness status | Target sizing evidence |
| `tde_status` | enabled/disabled/unknown | Encryption-material prerequisites |
| `authentication_model` | SQL/Windows/Entra/mixed/unknown | Identity and application remediation |
| `feature_inventory_status` | readiness status | Database feature compatibility |
| `instance_object_inventory_status` | readiness status | Logins, jobs, credentials and linked objects |
| `network_path_status` | readiness status | End-to-end reachability |
| `dns_status` | readiness status | Name resolution and listener/endpoint use |
| `validation_plan_status` | readiness status | Technical and business validation |
| `rollback_plan_status` | readiness status | Reversibility and decision point |
| `application_cutover_owner` | named role or absence marker | Connection-string and traffic switch ownership |

### Path-specific facts

| Area | Fields |
| --- | --- |
| AG / DAG | `ha_migration_pattern`, `source_ha_topology`, `domain_model`, `ag_endpoint_status`, `quorum_status` |
| Backup / restore | `recovery_model`, `backup_chain_status`, `blob_https_status`, `blob_access_model`, `tde_material_status` |
| Azure Migrate / AVS | `azure_migrate_platform`, `azure_migrate_appliance_status`, `test_migration_status`, `hcx_service_mesh_status` |
| MI Link / LRS | `mi_link_ports_status`, `mi_link_capacity_status`, `lrs_window_days`, `lrs_storage_layout_status` |
| SQL DB schema/data | `schema_compatibility_status`, `bacpac_consistency_status`, `dms_runtime_status`, `bulk_target_schema_status` |
| Replication / CDC | `replication_primary_keys_status`, `replication_topology`, `striim_runtime_status` |
| Data Box | `data_box_device_status`, `delta_sync_method` |
| Fabric | `fabric_capacity_status`, `fabric_workspace_role`, `fabric_gateway_type`, `fabric_dacpac_size_mb` |
| Arc / containers | `arc_cluster_support_status`, `arc_connectivity_mode`, `arc_backup_storage_class_status`, `arc_external_endpoint_status`, `arc_restore_entrypoint`, `container_image_status`, `container_volume_status` |
| Bulk / pipelines | `bulk_copy_tool`, `adf_integration_runtime_status`, `adf_connection_status` |
| Modern DMS | `dms_migration_mode`, `dms_backup_landing_zone`, `recovery_model_status` |

Question definitions, accepted values, consumers and distinct status effects are machine-readable in
[`questions.json`](questions.json). A question absent from that file must not be asked.

## 6. Evidence records

```json
{
  "id": "EV-001",
  "type": "connectivity_test",
  "status": "verified",
  "collectedAt": "2026-08-13T10:00:00Z",
  "origin": "customer-run preflight",
  "tool": "Test-NetConnection",
  "toolVersion": null,
  "reference": "sha256:…",
  "supports": ["P08-004"]
}
```

`status` is `reported` or `verified`. Only `verified` can confirm an evidence-gated prerequisite.
Never include credentials, connection strings, secrets, certificate private keys, customer names,
server names, tenant IDs or subscription IDs in the generated plan.

## 7. Asking rules

- Use `ask_user`; ask one compact question at a time.
- Never use a multi-select. Use a single choice, typed number, or short structured text.
- Ask each field at most once. A declined, blank or ambiguous answer becomes `UNKNOWN`.
- Ask in the user's language; store canonical values.
- Do not ask for a fact inherited from the Advisor unless the two supplied values conflict.
- When values conflict, show both values and mark the field `UNKNOWN`; do not silently choose one.
- Stop asking when remaining answers cannot change an applicable prerequisite status.

## 8. Out of scope

This contract does not authorize provisioning, configuration changes, migration execution,
remediation, credential collection, target selection or architecture approval.
