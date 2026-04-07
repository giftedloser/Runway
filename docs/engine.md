# Health Engine

PilotCheck's health engine is a pure function from joined raw state to a
typed list of flags. There is no statefulness, no I/O during evaluation, and
no "magic" — every diagnostic in the UI traces back to a named rule file
you can read.

## Severity model

Each flag has a severity in:

| Severity   | Meaning                                                       |
| ---------- | ------------------------------------------------------------- |
| `critical` | Device is broken or actively non-compliant — needs attention  |
| `warning`  | Device will break soon, or is mid-provisioning past SLA       |
| `info`     | Worth knowing but not actionable on its own                   |

Device-level health is the worst severity across active flags, falling back
to `healthy` when no flags fire and `unknown` when there isn't enough data
to evaluate (typically a brand-new sync).

## Built-in flags

| Flag code                          | Severity   | Fires when                                                                          |
| ---------------------------------- | ---------- | ----------------------------------------------------------------------------------- |
| `no_autopilot_record`              | `critical` | Intune device exists but has no Autopilot record on the same serial / ZTDID         |
| `no_profile_assigned`              | `critical` | Autopilot record exists but no deployment profile resolves to it                    |
| `profile_assignment_failed`        | `critical` | Intune reports a profile assignment failure                                         |
| `profile_assigned_not_enrolled`    | `warning`  | Profile is assigned but device hasn't enrolled within `PROFILE_ASSIGNED_NOT_ENROLLED_HOURS` |
| `not_in_target_group`              | `critical` | Group tag's mapped target group does not contain the device                         |
| `deployment_mode_mismatch`         | `warning`  | Effective deployment mode differs from the tag dictionary expectation               |
| `hybrid_join_risk`                 | `warning`  | Hybrid-join configuration drift (trust type vs profile)                             |
| `user_mismatch`                    | `warning`  | Autopilot assigned user differs from Intune primary user                            |
| `provisioning_stalled`             | `critical` | Device is mid-OOBE for longer than `PROVISIONING_STALLED_HOURS`                     |
| `compliance_drift`                 | `warning`  | Intune compliance state regressed since the previous sync                           |
| `orphaned_autopilot`               | `info`     | Autopilot record exists with no matching Intune device                              |
| `missing_ztdid`                    | `warning`  | Entra device is missing the ZTDID extension attribute                               |
| `identity_conflict`                | `critical` | Multiple Entra/Intune objects resolve to the same hardware                          |
| `tag_mismatch`                     | `warning`  | Group tag does not appear in the tag dictionary at all                              |

Flags are bucketed in the device detail header into four "breakpoints" so an
operator can see at a glance which subsystem is failing:

- **Identity** — `identity_conflict`, `missing_ztdid`
- **Targeting** — `not_in_target_group`, `tag_mismatch`, `no_profile_assigned`, `deployment_mode_mismatch`
- **Enrollment** — `no_autopilot_record`, `profile_assignment_failed`, `profile_assigned_not_enrolled`, `orphaned_autopilot`, `provisioning_stalled`
- **Drift** — `hybrid_join_risk`, `user_mismatch`, `compliance_drift`

## Custom rules (Rule DSL v1)

Beyond the built-in flags, operators can define site-specific rules in
**Settings → Custom Rules**. Each rule is a `RuleDefinition` with a tiny
predicate DSL:

```ts
type RulePredicate =
  | { type: "leaf"; field: string; op: RuleOp; value: string | number | boolean | null }
  | { type: "and"; children: RulePredicate[] }
  | { type: "or"; children: RulePredicate[] }
  | { type: "not"; child: RulePredicate };

type RuleOp =
  | "eq" | "neq"
  | "contains" | "not_contains"
  | "starts_with" | "ends_with"
  | "exists" | "missing"
  | "older_than_hours" | "newer_than_hours"
  | "in" | "not_in";
```

A rule has:

- **scope** — `global`, `property` (matches one tag dictionary property), or
  `profile` (matches one deployment profile)
- **severity** — `info`, `warning`, or `critical`
- **predicate** — the tree above
- **enabled** — toggle without deleting

The DSL is intentionally tiny. The escape hatch for complex logic is a
proper plugin (a TypeScript file the engine `import`s), not more DSL.

## Tag dictionary

The `tag_config` table maps Autopilot group tags to their expected
deployment profile and target Entra group. This is what makes
`tag_mismatch`, `not_in_target_group`, and `deployment_mode_mismatch`
possible — without a tag dictionary entry, PilotCheck has no idea what a
device is *supposed* to look like.

The dictionary is editable in **Settings → Group Tag → Profile Mapping**
and supports JSON import/export so it can be versioned in source control or
shared between environments.
