import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";

import { runMigrations } from "../../src/server/db/migrate.js";
import { computeAllDeviceStates } from "../../src/server/engine/compute-all-device-states.js";
import { persistSnapshot } from "../../src/server/sync/persist.js";
import type {
  AutopilotRow,
  EntraRow,
  GroupMembershipRow,
  GroupRow,
  IntuneRow,
  ProfileAssignmentRow,
  ProfileRow
} from "../../src/server/db/types.js";
import type { SnapshotPayload } from "../../src/server/sync/types.js";
import type { FlagCode } from "../../src/shared/types.js";

/**
 * End-to-end engine tests: feed crafted snapshot rows through
 * `persistSnapshot` (which writes to a real in-memory schema), run
 * `computeAllDeviceStates`, and read back the resulting `device_state`
 * rows. These pin the contract for the highest-blast-radius surface in
 * the codebase — the flag detection logic that drives every operator
 * decision.
 */

// Anchor relative to wallclock so the engine's `Date.now()`-based
// staleness checks (provisioning_stalled, profile_assigned_not_enrolled)
// behave deterministically regardless of when the test runs.
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
    serial_number: "SN-DEFAULT",
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
    device_name: "DEV-01",
    serial_number: "SN-DEFAULT",
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

function entra(overrides: Partial<EntraRow> & { id: string }): EntraRow {
  return {
    device_id: overrides.device_id ?? overrides.id,
    display_name: "DEV-01",
    serial_number: "SN-DEFAULT",
    trust_type: "ServerAd",
    is_managed: 1,
    mdm_app_id: null,
    registration_datetime: null,
    device_physical_ids: JSON.stringify(["[ZTDID]:ZTD-1"]),
    last_synced_at: NOW,
    raw_json: null,
    ...overrides
  };
}

function group(overrides: Partial<GroupRow> & { id: string; display_name: string }): GroupRow {
  return {
    membership_rule: null,
    membership_rule_processing_state: null,
    membership_type: "Assigned",
    last_synced_at: NOW,
    raw_json: null,
    ...overrides
  };
}

function membership(group_id: string, member_device_id: string): GroupMembershipRow {
  return { group_id, member_device_id, last_synced_at: NOW };
}

function profile(overrides: Partial<ProfileRow> & { id: string; display_name: string }): ProfileRow {
  return {
    deployment_mode: "userDriven",
    out_of_box_experience: null,
    hybrid_join_config: null,
    assigned_group_ids: null,
    last_synced_at: NOW,
    raw_json: null,
    ...overrides
  };
}

function profileAssignment(profile_id: string, group_id: string): ProfileAssignmentRow {
  return { profile_id, group_id, last_synced_at: NOW };
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

interface DeviceStateRow {
  device_key: string;
  serial_number: string | null;
  overall_health: string;
  active_flags: string;
  flag_count: number;
}

function readStates(): Array<DeviceStateRow & { flags: FlagCode[] }> {
  const rows = db
    .prepare("SELECT device_key, serial_number, overall_health, active_flags, flag_count FROM device_state")
    .all() as DeviceStateRow[];
  return rows.map((r) => ({ ...r, flags: JSON.parse(r.active_flags) as FlagCode[] }));
}

describe("computeAllDeviceStates — flag detection", () => {
  it("flags no_autopilot_record when intune sees a device autopilot doesn't", () => {
    persistSnapshot(
      db,
      snapshot({
        intuneRows: [intune({ id: "int-1", serial_number: "SN-A", device_name: "ORPHAN-A" })]
      })
    );

    const count = computeAllDeviceStates(db);
    expect(count).toBe(1);

    const states = readStates();
    expect(states[0].flags).toContain("no_autopilot_record");
    expect(states[0].overall_health).not.toBe("healthy");
  });

  it("flags orphaned_autopilot when an autopilot row has no matching intune enrollment", () => {
    persistSnapshot(
      db,
      snapshot({
        autopilotRows: [autopilot({ id: "ap-1", serial_number: "SN-B" })]
      })
    );

    computeAllDeviceStates(db);
    const states = readStates();
    expect(states).toHaveLength(1);
    expect(states[0].flags).toContain("orphaned_autopilot");
  });

  it("flags no_profile_assigned when autopilot has no deployment profile", () => {
    persistSnapshot(
      db,
      snapshot({
        autopilotRows: [
          autopilot({
            id: "ap-1",
            serial_number: "SN-C",
            deployment_profile_id: null,
            deployment_profile_name: null
          })
        ],
        intuneRows: [intune({ id: "int-1", serial_number: "SN-C" })]
      })
    );

    computeAllDeviceStates(db);
    const states = readStates();
    expect(states[0].flags).toContain("no_profile_assigned");
  });

  it("flags profile_assignment_failed when status is not 'assigned'", () => {
    persistSnapshot(
      db,
      snapshot({
        autopilotRows: [
          autopilot({
            id: "ap-1",
            serial_number: "SN-D",
            deployment_profile_name: "Lodge-UD",
            profile_assignment_status: "failed"
          })
        ],
        intuneRows: [intune({ id: "int-1", serial_number: "SN-D" })]
      })
    );

    computeAllDeviceStates(db);
    const states = readStates();
    expect(states[0].flags).toContain("profile_assignment_failed");
  });

  it("flags profile_assigned_not_enrolled when profile is old and intune row missing", () => {
    persistSnapshot(
      db,
      snapshot({
        autopilotRows: [
          autopilot({
            id: "ap-1",
            serial_number: "SN-E",
            deployment_profile_name: "Lodge-UD",
            profile_assignment_status: "assigned",
            first_profile_assigned_at: HOURS_AGO_72,
            first_seen_at: HOURS_AGO_72
          })
        ]
      })
    );

    computeAllDeviceStates(db);
    const states = readStates();
    expect(states[0].flags).toContain("profile_assigned_not_enrolled");
  });

  it("flags hybrid_join_risk when profile is hybrid but trust type is not ServerAd", () => {
    persistSnapshot(
      db,
      snapshot({
        autopilotRows: [
          autopilot({
            id: "ap-1",
            serial_number: "SN-F",
            deployment_profile_id: "prof-hybrid",
            entra_device_id: "entra-f"
          })
        ],
        intuneRows: [intune({ id: "int-1", serial_number: "SN-F", entra_device_id: "entra-f" })],
        entraRows: [
          entra({
            id: "entra-f",
            serial_number: "SN-F",
            trust_type: "AzureAd"
          })
        ],
        profileRows: [
          profile({
            id: "prof-hybrid",
            display_name: "Lodge-Hybrid",
            deployment_mode: "hybridAzureADJoined",
            hybrid_join_config: "enabled"
          })
        ]
      })
    );

    computeAllDeviceStates(db);
    const states = readStates();
    expect(states[0].flags).toContain("hybrid_join_risk");
  });

  it("does NOT flag hybrid_join_risk when profile name merely contains 'hybrid' as a substring", () => {
    // Regression guard: a profile called "HybridTest" or "NotHybridProfile"
    // must not trip the word-boundary check.
    persistSnapshot(
      db,
      snapshot({
        autopilotRows: [
          autopilot({
            id: "ap-1",
            serial_number: "SN-G",
            deployment_profile_id: "prof-fake",
            entra_device_id: "entra-g"
          })
        ],
        intuneRows: [intune({ id: "int-1", serial_number: "SN-G", entra_device_id: "entra-g" })],
        entraRows: [entra({ id: "entra-g", serial_number: "SN-G", trust_type: "AzureAd" })],
        profileRows: [
          profile({
            id: "prof-fake",
            display_name: "NotHybridProfile",
            deployment_mode: "userDriven"
          })
        ]
      })
    );

    computeAllDeviceStates(db);
    const states = readStates();
    expect(states[0].flags).not.toContain("hybrid_join_risk");
  });

  it("flags user_mismatch when autopilot user differs from intune primary user (case-insensitive)", () => {
    persistSnapshot(
      db,
      snapshot({
        autopilotRows: [
          autopilot({
            id: "ap-1",
            serial_number: "SN-H",
            deployment_profile_name: "Lodge-UD",
            assigned_user_upn: "alice@casino.com"
          })
        ],
        intuneRows: [
          intune({
            id: "int-1",
            serial_number: "SN-H",
            primary_user_upn: "bob@casino.com"
          })
        ]
      })
    );

    computeAllDeviceStates(db);
    const states = readStates();
    expect(states[0].flags).toContain("user_mismatch");
  });

  it("does NOT flag user_mismatch when UPNs match with different casing", () => {
    persistSnapshot(
      db,
      snapshot({
        autopilotRows: [
          autopilot({
            id: "ap-1",
            serial_number: "SN-I",
            deployment_profile_name: "Lodge-UD",
            assigned_user_upn: "Alice@Casino.com"
          })
        ],
        intuneRows: [
          intune({
            id: "int-1",
            serial_number: "SN-I",
            primary_user_upn: "alice@casino.COM"
          })
        ]
      })
    );

    computeAllDeviceStates(db);
    const states = readStates();
    expect(states[0].flags).not.toContain("user_mismatch");
  });

  it("flags missing_ztdid when entra device_physical_ids has no ZTDID entry", () => {
    persistSnapshot(
      db,
      snapshot({
        autopilotRows: [
          autopilot({
            id: "ap-1",
            serial_number: "SN-J",
            deployment_profile_name: "Lodge-UD",
            entra_device_id: "entra-j"
          })
        ],
        intuneRows: [intune({ id: "int-1", serial_number: "SN-J", entra_device_id: "entra-j" })],
        entraRows: [
          entra({
            id: "entra-j",
            serial_number: "SN-J",
            device_physical_ids: JSON.stringify(["[GID]:foo"])
          })
        ]
      })
    );

    computeAllDeviceStates(db);
    const states = readStates();
    expect(states[0].flags).toContain("missing_ztdid");
  });

  it("flags provisioning_stalled when intune last sync is old and chain is broken", () => {
    persistSnapshot(
      db,
      snapshot({
        autopilotRows: [
          autopilot({
            id: "ap-1",
            serial_number: "SN-K",
            deployment_profile_name: "Lodge-UD",
            profile_assignment_status: "assigned"
          })
        ],
        intuneRows: [
          intune({
            id: "int-1",
            serial_number: "SN-K",
            last_sync_datetime: HOURS_AGO_72,
            compliance_state: "noncompliant"
          })
        ]
      })
    );

    computeAllDeviceStates(db);
    const states = readStates();
    expect(states[0].flags).toContain("provisioning_stalled");
  });

  it("flags tag_mismatch when the assigned profile is not in the tag's expected list", () => {
    persistSnapshot(
      db,
      snapshot({
        autopilotRows: [
          autopilot({
            id: "ap-1",
            serial_number: "SN-L",
            group_tag: "Lodge",
            deployment_profile_id: "prof-wrong",
            deployment_profile_name: "WrongProfile",
            entra_device_id: "entra-l"
          })
        ],
        intuneRows: [intune({ id: "int-1", serial_number: "SN-L", entra_device_id: "entra-l" })],
        entraRows: [entra({ id: "entra-l", serial_number: "SN-L" })],
        profileRows: [profile({ id: "prof-wrong", display_name: "WrongProfile" })],
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
    expect(states[0].flags).toContain("tag_mismatch");
  });

  it("flags not_in_target_group when the device is not a member of the expected group", () => {
    persistSnapshot(
      db,
      snapshot({
        autopilotRows: [
          autopilot({
            id: "ap-1",
            serial_number: "SN-M",
            group_tag: "Lodge",
            deployment_profile_name: "Lodge-UD",
            entra_device_id: "entra-m"
          })
        ],
        intuneRows: [intune({ id: "int-1", serial_number: "SN-M", entra_device_id: "entra-m" })],
        entraRows: [entra({ id: "entra-m", serial_number: "SN-M" })],
        groupRows: [group({ id: "grp-lodge", display_name: "Lodge-Devices" })],
        // No membership row → device is not in the group
        tagConfigRows: [
          {
            groupTag: "Lodge",
            expectedProfileNames: ["Lodge-UD"],
            expectedGroupNames: ["Lodge-Devices"],
            propertyLabel: "Lodge"
          }
        ]
      })
    );

    computeAllDeviceStates(db);
    const states = readStates();
    expect(states[0].flags).toContain("not_in_target_group");
  });

  it("returns a clean healthy device when all signals line up", () => {
    persistSnapshot(
      db,
      snapshot({
        autopilotRows: [
          autopilot({
            id: "ap-1",
            serial_number: "SN-OK",
            group_tag: "Lodge",
            deployment_profile_id: "prof-lodge",
            deployment_profile_name: "Lodge-UD",
            profile_assignment_status: "assigned",
            assigned_user_upn: "alice@casino.com",
            entra_device_id: "entra-ok"
          })
        ],
        intuneRows: [
          intune({
            id: "int-1",
            serial_number: "SN-OK",
            entra_device_id: "entra-ok",
            primary_user_upn: "alice@casino.com",
            last_sync_datetime: NOW,
            compliance_state: "compliant"
          })
        ],
        entraRows: [
          entra({
            id: "entra-ok",
            serial_number: "SN-OK",
            trust_type: "ServerAd"
          })
        ],
        groupRows: [group({ id: "grp-lodge", display_name: "Lodge-Devices" })],
        membershipRows: [membership("grp-lodge", "entra-ok")],
        profileRows: [profile({ id: "prof-lodge", display_name: "Lodge-UD" })],
        profileAssignmentRows: [profileAssignment("prof-lodge", "grp-lodge")],
        tagConfigRows: [
          {
            groupTag: "Lodge",
            expectedProfileNames: ["Lodge-UD"],
            expectedGroupNames: ["Lodge-Devices"],
            propertyLabel: "Lodge"
          }
        ]
      })
    );

    computeAllDeviceStates(db);
    const states = readStates();
    expect(states).toHaveLength(1);
    expect(states[0].flags).toEqual([]);
    expect(states[0].overall_health).toBe("healthy");
  });

  it("computes states for multiple devices in a single pass", () => {
    persistSnapshot(
      db,
      snapshot({
        autopilotRows: [
          autopilot({ id: "ap-1", serial_number: "SN-1" }),
          autopilot({ id: "ap-2", serial_number: "SN-2", deployment_profile_name: "Lodge-UD" })
        ],
        intuneRows: [
          intune({ id: "int-2", serial_number: "SN-2" }),
          intune({ id: "int-3", serial_number: "SN-3", device_name: "ORPHAN" })
        ]
      })
    );

    const count = computeAllDeviceStates(db);
    expect(count).toBe(3);
    const states = readStates();
    const bySerial = new Map(states.map((s) => [s.serial_number, s]));
    expect(bySerial.get("SN-1")?.flags).toContain("orphaned_autopilot");
    expect(bySerial.get("SN-2")?.flags).toEqual([]);
    expect(bySerial.get("SN-3")?.flags).toContain("no_autopilot_record");
  });
});
