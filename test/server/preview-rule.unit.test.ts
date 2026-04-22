import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";

import { runMigrations } from "../../src/server/db/migrate.js";
import { computeAllDeviceStates } from "../../src/server/engine/compute-all-device-states.js";
import { previewRule } from "../../src/server/engine/preview-rule.js";
import { persistSnapshot } from "../../src/server/sync/persist.js";
import type { AutopilotRow, IntuneRow } from "../../src/server/db/types.js";
import type { SnapshotPayload } from "../../src/server/sync/types.js";
import type { RulePredicate } from "../../src/shared/types.js";

/**
 * preview-rule is the "would this fire?" probe behind the rule editor.
 * It must mirror the live engine exactly — the count it returns is what
 * the UI shows next to the Save button, so a drift between preview and
 * the post-save reality directly burns operator trust.
 *
 * These tests cover:
 *   - sample/total accounting against a populated device_state table
 *   - sampleLimit truncation while count remains the true match total
 *   - scope filters (global/property/profile) routed through the same
 *     evaluator as the live engine
 *   - boolean field operators (hasAutopilotRecord, hybridJoinConfigured)
 *     since those round-trip through SQLite as 0/1 ints
 */

const NOW_MS = Date.parse("2026-04-19T12:00:00.000Z");
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

/**
 * Seed the DB with N devices, each compliant or noncompliant per the
 * caller's spec. We use group_tag/property pairs so we can also exercise
 * the property-scope filter.
 */
function seedDevices(specs: Array<{
  serial: string;
  compliance?: "compliant" | "noncompliant";
  groupTag?: string;
  propertyLabel?: string;
  profile?: string;
  managementAgent?: string | null;
}>) {
  const tagConfigRows = Array.from(
    new Set(specs.map((s) => s.groupTag).filter((g): g is string => Boolean(g)))
  ).map((groupTag) => {
    const sample = specs.find((s) => s.groupTag === groupTag);
    return {
      groupTag,
      expectedProfileNames: sample?.profile ? [sample.profile] : [],
      expectedGroupNames: [],
      propertyLabel: sample?.propertyLabel ?? groupTag
    };
  });

  persistSnapshot(
    db,
    snapshot({
      autopilotRows: specs.map((s, i) =>
        autopilot({
          id: `ap-${i}`,
          serial_number: s.serial,
          group_tag: s.groupTag ?? null,
          deployment_profile_name: s.profile ?? null,
          profile_assignment_status: s.profile ? "assigned" : null
        })
      ),
      intuneRows: specs.map((s, i) =>
        intune({
          id: `int-${i}`,
          serial_number: s.serial,
          device_name: `DEV-${s.serial}`,
          compliance_state: s.compliance ?? "compliant",
          management_agent: s.managementAgent ?? null
        })
      ),
      tagConfigRows
    })
  );

  computeAllDeviceStates(db);
}

describe("previewRule — counting & sampling", () => {
  it("returns count = matches and total = all device_state rows", () => {
    seedDevices([
      { serial: "SN-A", compliance: "noncompliant" },
      { serial: "SN-B", compliance: "noncompliant" },
      { serial: "SN-C", compliance: "compliant" }
    ]);

    const predicate: RulePredicate = {
      type: "leaf",
      field: "complianceState",
      op: "eq",
      value: "noncompliant"
    };

    const result = previewRule(db, predicate);
    expect(result.count).toBe(2);
    expect(result.total).toBe(3);
    expect(result.sampleDevices.map((d) => d.serialNumber).sort()).toEqual(["SN-A", "SN-B"]);
  });

  it("truncates sampleDevices to sampleLimit while count reflects every match", () => {
    // 12 noncompliant devices, ask for 5. count must still be 12.
    seedDevices(
      Array.from({ length: 12 }, (_, i) => ({
        serial: `SN-${i}`,
        compliance: "noncompliant" as const
      }))
    );

    const result = previewRule(
      db,
      { type: "leaf", field: "complianceState", op: "eq", value: "noncompliant" },
      "global",
      null,
      "warning",
      5
    );

    expect(result.count).toBe(12);
    expect(result.total).toBe(12);
    expect(result.sampleDevices).toHaveLength(5);
  });

  it("returns count 0 and an empty sample when nothing matches", () => {
    seedDevices([{ serial: "SN-A", compliance: "compliant" }]);
    const result = previewRule(db, {
      type: "leaf",
      field: "complianceState",
      op: "eq",
      value: "noncompliant"
    });
    expect(result.count).toBe(0);
    expect(result.total).toBe(1);
    expect(result.sampleDevices).toEqual([]);
  });

  it("returns total 0 when device_state is empty", () => {
    const result = previewRule(db, {
      type: "leaf",
      field: "complianceState",
      op: "eq",
      value: "noncompliant"
    });
    expect(result).toEqual({ count: 0, total: 0, sampleDevices: [] });
  });
});

describe("previewRule — scope filtering routes through the live evaluator", () => {
  it("property scope only counts devices whose propertyLabel matches", () => {
    seedDevices([
      { serial: "SN-L1", compliance: "noncompliant", groupTag: "Lodge", propertyLabel: "Lodge" },
      { serial: "SN-L2", compliance: "noncompliant", groupTag: "Lodge", propertyLabel: "Lodge" },
      { serial: "SN-K1", compliance: "noncompliant", groupTag: "Kiosk", propertyLabel: "Kiosk" }
    ]);

    const result = previewRule(
      db,
      { type: "leaf", field: "complianceState", op: "eq", value: "noncompliant" },
      "property",
      "Lodge"
    );

    expect(result.count).toBe(2);
    expect(result.total).toBe(3);
    expect(result.sampleDevices.every((d) => d.propertyLabel === "Lodge")).toBe(true);
  });

  it("profile scope only counts devices on the named profile", () => {
    seedDevices([
      { serial: "SN-A", compliance: "noncompliant", groupTag: "Lodge", profile: "AP-Lodge-UD" },
      { serial: "SN-B", compliance: "noncompliant", groupTag: "Lodge", profile: "AP-Lodge-UD" },
      { serial: "SN-C", compliance: "noncompliant", groupTag: "Kiosk", profile: "AP-Kiosk-SD" }
    ]);

    const result = previewRule(
      db,
      { type: "leaf", field: "complianceState", op: "eq", value: "noncompliant" },
      "profile",
      "AP-Kiosk-SD"
    );

    expect(result.count).toBe(1);
    expect(result.sampleDevices[0]?.serialNumber).toBe("SN-C");
  });

  it("global scope ignores scopeValue and considers every device", () => {
    seedDevices([
      { serial: "SN-A", compliance: "noncompliant", groupTag: "Lodge", propertyLabel: "Lodge" },
      { serial: "SN-B", compliance: "noncompliant", groupTag: "Kiosk", propertyLabel: "Kiosk" }
    ]);

    const result = previewRule(
      db,
      { type: "leaf", field: "complianceState", op: "eq", value: "noncompliant" },
      "global",
      "Lodge" // ignored when scope is global
    );

    expect(result.count).toBe(2);
  });
});

describe("previewRule — boolean & compound predicates", () => {
  it("hasAutopilotRecord (stored as 0/1 in SQLite) compares as boolean true", () => {
    // Both seeded devices DO have an autopilot record. The eq=true rule
    // must match both — proving the int→bool coercion in rowToContext works.
    seedDevices([
      { serial: "SN-A", compliance: "compliant" },
      { serial: "SN-B", compliance: "noncompliant" }
    ]);

    const result = previewRule(db, {
      type: "leaf",
      field: "hasAutopilotRecord",
      op: "eq",
      value: true
    });

    expect(result.count).toBe(2);
  });

  it("matches the SCCM-derived hasConfigMgrClient field from managementAgent", () => {
    seedDevices([
      {
        serial: "SN-SCCM",
        managementAgent: "configurationManagerClientMdm"
      },
      {
        serial: "SN-MDM",
        managementAgent: "mdm"
      }
    ]);

    const result = previewRule(db, {
      type: "leaf",
      field: "hasConfigMgrClient",
      op: "eq",
      value: true
    });

    expect(result.count).toBe(1);
    expect(result.sampleDevices[0]?.serialNumber).toBe("SN-SCCM");
  });

  it("matches the raw managementAgent string for advanced SCCM rules", () => {
    seedDevices([
      {
        serial: "SN-COMANAGED",
        managementAgent: "configurationManagerClientMdm"
      },
      {
        serial: "SN-NATIVE",
        managementAgent: "mdm"
      }
    ]);

    const result = previewRule(db, {
      type: "leaf",
      field: "managementAgent",
      op: "contains",
      value: "configurationManager"
    });

    expect(result.count).toBe(1);
    expect(result.sampleDevices[0]?.serialNumber).toBe("SN-COMANAGED");
  });

  it("compound and-predicate matches only the intersection", () => {
    seedDevices([
      { serial: "SN-A", compliance: "noncompliant", groupTag: "Lodge", propertyLabel: "Lodge" },
      { serial: "SN-B", compliance: "noncompliant", groupTag: "Kiosk", propertyLabel: "Kiosk" },
      { serial: "SN-C", compliance: "compliant", groupTag: "Lodge", propertyLabel: "Lodge" }
    ]);

    const result = previewRule(db, {
      type: "and",
      children: [
        { type: "leaf", field: "complianceState", op: "eq", value: "noncompliant" },
        { type: "leaf", field: "propertyLabel", op: "eq", value: "Lodge" }
      ]
    });

    expect(result.count).toBe(1);
    expect(result.sampleDevices[0]?.serialNumber).toBe("SN-A");
  });

  it("a malformed leaf predicate is treated as 'no match' (no throw)", () => {
    seedDevices([{ serial: "SN-A", compliance: "noncompliant" }]);

    // Force an unknown op past the type system. The shared evaluator
    // catches the throw; preview must surface that as count: 0 rather
    // than 500ing the rule editor.
    const result = previewRule(db, {
      type: "leaf",
      field: "complianceState",
      // @ts-expect-error -- intentionally invalid op
      op: "explode",
      value: "boom"
    });

    expect(result.count).toBe(0);
    expect(result.total).toBe(1);
  });
});
