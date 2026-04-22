import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";

import { runMigrations } from "../../src/server/db/migrate.js";
import { createRule } from "../../src/server/db/queries/rules.js";
import { computeAllDeviceStates } from "../../src/server/engine/compute-all-device-states.js";
import { persistSnapshot } from "../../src/server/sync/persist.js";
import type {
  AutopilotRow,
  IntuneRow
} from "../../src/server/db/types.js";
import type { SnapshotPayload } from "../../src/server/sync/types.js";
import type { RulePredicate } from "../../src/shared/types.js";

/**
 * Integration tests for the custom-rule seam. These pin that a rule
 * authored through the normal `createRule` path is loaded by the
 * engine, evaluated against the derived RuleContext built inside
 * `computeAllDeviceStates`, and its id/severity end up reflected in
 * the resulting `device_state` row. The rule DSL has its own unit
 * suite; this file asserts the wiring — the part that matters most
 * when an operator writes a hand-crafted rule before a real run.
 */

const NOW_MS = Date.now();
const NOW = new Date(NOW_MS).toISOString();
const HOURS_AGO_72 = new Date(NOW_MS - 72 * 60 * 60 * 1000).toISOString();

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  runMigrations(db);
});

function autopilot(overrides: Partial<AutopilotRow> & { id: string }): AutopilotRow {
  return {
    serial_number: "SN-1",
    model: null,
    manufacturer: null,
    group_tag: null,
    assigned_user_upn: null,
    deployment_profile_id: null,
    deployment_profile_name: null,
    profile_assignment_status: null,
    deployment_mode: null,
    entra_device_id: null,
    first_seen_at: HOURS_AGO_72,
    first_profile_assigned_at: null,
    last_synced_at: NOW,
    raw_json: null,
    ...overrides
  };
}

function intune(overrides: Partial<IntuneRow> & { id: string }): IntuneRow {
  return {
    device_name: "DEV",
    serial_number: "SN-1",
    entra_device_id: null,
    os_version: null,
    compliance_state: "compliant",
    enrollment_type: null,
    managed_device_owner_type: null,
    last_sync_datetime: NOW,
    primary_user_upn: null,
    enrollment_profile_name: null,
    autopilot_enrolled: 1,
    management_agent: null,
    last_synced_at: NOW,
    raw_json: null,
    ...overrides
  };
}

function snapshot(overrides: Partial<SnapshotPayload> = {}): SnapshotPayload {
  return {
    autopilotRows: [],
    intuneRows: [],
    entraRows: [],
    groupRows: [],
    membershipRows: [],
    profileRows: [],
    profileAssignmentRows: [],
    ...overrides
  };
}

interface DeviceStateSnapshot {
  serial_number: string | null;
  overall_health: string;
  active_flags: string[];
  active_rule_ids: string[];
}

function readStates(): DeviceStateSnapshot[] {
  const rows = db
    .prepare(
      "SELECT serial_number, overall_health, active_flags, active_rule_ids FROM device_state ORDER BY serial_number ASC"
    )
    .all() as Array<{
    serial_number: string | null;
    overall_health: string;
    active_flags: string;
    active_rule_ids: string;
  }>;
  return rows.map((r) => ({
    serial_number: r.serial_number,
    overall_health: r.overall_health,
    active_flags: JSON.parse(r.active_flags),
    active_rule_ids: JSON.parse(r.active_rule_ids)
  }));
}

describe("custom rule → computeAllDeviceStates integration", () => {
  it("attaches a matching global rule's id to the device_state row", () => {
    const predicate: RulePredicate = {
      type: "leaf",
      field: "complianceState",
      op: "eq",
      value: "noncompliant"
    };
    const rule = createRule(db, {
      name: "Flag noncompliant devices",
      description: "Any noncompliant device should raise a warning.",
      severity: "warning",
      scope: "global",
      predicate
    });

    persistSnapshot(
      db,
      snapshot({
        autopilotRows: [
          autopilot({
            id: "ap-1",
            serial_number: "SN-RULE",
            deployment_profile_name: "Lodge-UD",
            profile_assignment_status: "assigned"
          })
        ],
        intuneRows: [
          intune({
            id: "int-1",
            serial_number: "SN-RULE",
            compliance_state: "noncompliant"
          })
        ]
      })
    );

    computeAllDeviceStates(db);
    const [state] = readStates();
    expect(state.active_rule_ids).toContain(rule.id);
  });

  it("promotes overall_health when a rule fires that is worse than the built-in flag health", () => {
    // Built-in flags would leave this device healthy (autopilot assigned,
    // intune fresh, compliant). A custom critical rule must still push
    // overall_health to critical.
    const rule = createRule(db, {
      name: "Lodge property must always be warning or worse",
      description: "",
      severity: "critical",
      scope: "global",
      predicate: {
        type: "leaf",
        field: "propertyLabel",
        op: "eq",
        value: "Lodge"
      }
    });

    persistSnapshot(
      db,
      snapshot({
        autopilotRows: [
          autopilot({
            id: "ap-1",
            serial_number: "SN-P",
            group_tag: "Lodge",
            deployment_profile_name: "Lodge-UD",
            profile_assignment_status: "assigned"
          })
        ],
        intuneRows: [intune({ id: "int-1", serial_number: "SN-P" })],
        tagConfigRows: [
          {
            groupTag: "Lodge",
            expectedProfileNames: ["Lodge-UD"],
            expectedGroupNames: [],
            propertyLabel: "Lodge"
          }
        ]
      })
    );

    computeAllDeviceStates(db);
    const [state] = readStates();
    expect(state.active_rule_ids).toEqual([rule.id]);
    expect(state.overall_health).toBe("critical");
    // Built-in flag pass should still leave no flags raised.
    expect(state.active_flags).toEqual([]);
  });

  it("does NOT reduce overall_health when a rule's severity is weaker than an existing built-in flag", () => {
    // Device has no autopilot record → built-in `no_autopilot_record`
    // flag fires as critical. A matching info-level rule must not pull
    // the final health down to info.
    createRule(db, {
      name: "Info on all devices with an intune record",
      description: "",
      severity: "info",
      scope: "global",
      predicate: {
        type: "leaf",
        field: "hasIntuneRecord",
        op: "eq",
        value: true
      }
    });

    persistSnapshot(
      db,
      snapshot({
        // Compliance transition needs a prior row for compliance_drift
        // to fire — keep it simple and rely on the warning-level flag
        // `user_mismatch` by seeding a UPN mismatch so the built-in
        // rank floor is "warning" and clearly above the rule's "info".
        autopilotRows: [
          autopilot({
            id: "ap-1",
            serial_number: "SN-X",
            deployment_profile_name: "Lodge-UD",
            profile_assignment_status: "assigned",
            assigned_user_upn: "alice@casino.com"
          })
        ],
        intuneRows: [
          intune({
            id: "int-1",
            serial_number: "SN-X",
            primary_user_upn: "bob@casino.com"
          })
        ]
      })
    );

    computeAllDeviceStates(db);
    const [state] = readStates();
    expect(state.active_flags).toContain("user_mismatch");
    // user_mismatch is warning-severity; the info-level rule must not
    // drag overall_health below it.
    const rank: Record<string, number> = {
      healthy: 0,
      info: 1,
      warning: 2,
      critical: 3,
      unknown: 0
    };
    expect(rank[state.overall_health]).toBeGreaterThanOrEqual(rank.warning);
  });

  it("skips disabled rules and rules whose scope does not match the device", () => {
    createRule(db, {
      name: "Disabled rule",
      description: "",
      severity: "critical",
      scope: "global",
      enabled: false,
      predicate: { type: "leaf", field: "serialNumber", op: "exists", value: null }
    });
    createRule(db, {
      name: "Property-scoped to Casino — won't match Lodge devices",
      description: "",
      severity: "critical",
      scope: "property",
      scopeValue: "Casino",
      predicate: { type: "leaf", field: "serialNumber", op: "exists", value: null }
    });

    persistSnapshot(
      db,
      snapshot({
        autopilotRows: [
          autopilot({
            id: "ap-1",
            serial_number: "SN-S",
            group_tag: "Lodge",
            deployment_profile_name: "Lodge-UD",
            profile_assignment_status: "assigned"
          })
        ],
        intuneRows: [intune({ id: "int-1", serial_number: "SN-S" })],
        tagConfigRows: [
          {
            groupTag: "Lodge",
            expectedProfileNames: ["Lodge-UD"],
            expectedGroupNames: [],
            propertyLabel: "Lodge"
          }
        ]
      })
    );

    computeAllDeviceStates(db);
    const [state] = readStates();
    expect(state.active_rule_ids).toEqual([]);
    expect(state.overall_health).toBe("healthy");
  });

  it("evaluates a rule against derived context fields (assignmentChainComplete)", () => {
    // Rules can read fields that only exist in the derived context,
    // not on any raw row. `assignmentChainComplete` is computed inside
    // compute-all-device-states before evaluateRules runs, so this
    // test pins that wiring.
    const rule = createRule(db, {
      name: "Warn when the assignment chain is incomplete",
      description: "",
      severity: "warning",
      scope: "global",
      predicate: {
        type: "leaf",
        field: "assignmentChainComplete",
        op: "eq",
        value: false
      }
    });

    persistSnapshot(
      db,
      snapshot({
        autopilotRows: [autopilot({ id: "ap-1", serial_number: "SN-C" })],
        intuneRows: [intune({ id: "int-1", serial_number: "SN-C" })]
      })
    );

    computeAllDeviceStates(db);
    const [state] = readStates();
    expect(state.active_rule_ids).toContain(rule.id);
  });

  it("evaluates SCCM ConfigMgr client fields from Intune managementAgent", () => {
    const rule = createRule(db, {
      name: "ConfigMgr client required",
      description: "",
      severity: "warning",
      scope: "global",
      predicate: {
        type: "leaf",
        field: "hasConfigMgrClient",
        op: "eq",
        value: false
      }
    });

    persistSnapshot(
      db,
      snapshot({
        autopilotRows: [
          autopilot({
            id: "ap-sccm",
            serial_number: "SN-SCCM",
            deployment_profile_name: "Lodge-UD",
            profile_assignment_status: "assigned"
          }),
          autopilot({
            id: "ap-mdm",
            serial_number: "SN-MDM",
            deployment_profile_name: "Lodge-UD",
            profile_assignment_status: "assigned"
          })
        ],
        intuneRows: [
          intune({
            id: "int-sccm",
            serial_number: "SN-SCCM",
            management_agent: "configurationManagerClientMdm"
          }),
          intune({
            id: "int-mdm",
            serial_number: "SN-MDM",
            management_agent: "mdm"
          })
        ]
      })
    );

    computeAllDeviceStates(db);
    const states = readStates();
    const connected = states.find((s) => s.serial_number === "SN-SCCM");
    const missing = states.find((s) => s.serial_number === "SN-MDM");
    expect(connected?.active_rule_ids ?? []).not.toContain(rule.id);
    expect(missing?.active_rule_ids).toContain(rule.id);
  });

  it("matches a compound AND predicate spanning autopilot and intune context", () => {
    const rule = createRule(db, {
      name: "Noncompliant Lodge devices",
      description: "",
      severity: "critical",
      scope: "global",
      predicate: {
        type: "and",
        children: [
          { type: "leaf", field: "propertyLabel", op: "eq", value: "Lodge" },
          { type: "leaf", field: "complianceState", op: "eq", value: "noncompliant" }
        ]
      }
    });

    persistSnapshot(
      db,
      snapshot({
        autopilotRows: [
          autopilot({
            id: "ap-match",
            serial_number: "SN-MATCH",
            group_tag: "Lodge",
            deployment_profile_name: "Lodge-UD",
            profile_assignment_status: "assigned"
          }),
          autopilot({
            id: "ap-miss",
            serial_number: "SN-MISS",
            group_tag: "Lodge",
            deployment_profile_name: "Lodge-UD",
            profile_assignment_status: "assigned"
          })
        ],
        intuneRows: [
          intune({
            id: "int-match",
            serial_number: "SN-MATCH",
            compliance_state: "noncompliant"
          }),
          intune({ id: "int-miss", serial_number: "SN-MISS", compliance_state: "compliant" })
        ],
        tagConfigRows: [
          {
            groupTag: "Lodge",
            expectedProfileNames: ["Lodge-UD"],
            expectedGroupNames: [],
            propertyLabel: "Lodge"
          }
        ]
      })
    );

    computeAllDeviceStates(db);
    const states = readStates();
    const match = states.find((s) => s.serial_number === "SN-MATCH");
    const miss = states.find((s) => s.serial_number === "SN-MISS");
    expect(match?.active_rule_ids).toContain(rule.id);
    expect(miss?.active_rule_ids ?? []).not.toContain(rule.id);
  });

  it("records multiple matching rule ids in declaration order", () => {
    const first = createRule(db, {
      name: "First rule",
      description: "",
      severity: "info",
      scope: "global",
      predicate: { type: "leaf", field: "serialNumber", op: "exists", value: null }
    });
    const second = createRule(db, {
      name: "Second rule",
      description: "",
      severity: "warning",
      scope: "global",
      predicate: { type: "leaf", field: "hasAutopilotRecord", op: "eq", value: true }
    });

    persistSnapshot(
      db,
      snapshot({
        autopilotRows: [
          autopilot({
            id: "ap-1",
            serial_number: "SN-Z",
            deployment_profile_name: "Lodge-UD",
            profile_assignment_status: "assigned"
          })
        ],
        intuneRows: [intune({ id: "int-1", serial_number: "SN-Z" })]
      })
    );

    computeAllDeviceStates(db);
    const [state] = readStates();
    expect(state.active_rule_ids).toEqual([first.id, second.id]);
  });
});
