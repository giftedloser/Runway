import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";

import { runMigrations } from "../../src/server/db/migrate.js";
import {
  countNewlyUnhealthy,
  getDeviceDetail,
  getRecentTransitions
} from "../../src/server/db/queries/devices.js";
import type { FlagCode, HealthLevel } from "../../src/shared/types.js";

/**
 * These tests run against an in-memory better-sqlite3 instance with the
 * real production schema (no mocks). They pin the contract for the
 * dashboard "what changed in 24h" feed and the regression counter — both
 * are surfaces operators read to decide which devices need attention.
 */

let db: Database.Database;

function isoMinutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

function insertHistory(row: {
  deviceKey: string;
  computedAt: string;
  health: HealthLevel;
  flags?: FlagCode[];
  serial?: string | null;
}) {
  db.prepare(
    `INSERT INTO device_state_history
       (device_key, serial_number, computed_at, overall_health, active_flags)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    row.deviceKey,
    row.serial ?? null,
    row.computedAt,
    row.health,
    JSON.stringify(row.flags ?? [])
  );
}

function insertDeviceState(row: {
  deviceKey: string;
  deviceName?: string | null;
  serial?: string | null;
  property?: string | null;
  health: HealthLevel;
  flags?: FlagCode[];
}) {
  db.prepare(
    `INSERT INTO device_state (
       device_key, serial_number, autopilot_id, intune_id, entra_id, device_name, property_label,
       group_tag, assigned_profile_name, autopilot_assigned_user_upn, intune_primary_user_upn,
       last_checkin_at, trust_type, has_autopilot_record, has_intune_record, has_entra_record,
       has_profile_assigned, profile_assignment_status, is_in_correct_group, deployment_mode,
       deployment_mode_mismatch, hybrid_join_configured, hybrid_join_risk, user_assignment_match,
       compliance_state, provisioning_stalled, tag_mismatch, assignment_path, assignment_chain_complete,
       assignment_break_point, active_flags, flag_count, overall_health, diagnosis, match_confidence,
       matched_on, identity_conflict, active_rule_ids, computed_at
     ) VALUES (
       ?, ?, NULL, NULL, NULL, ?, ?,
       NULL, NULL, NULL, NULL,
       NULL, NULL, 0, 0, 0,
       0, NULL, 1, NULL,
       0, 0, 0, NULL,
       NULL, 0, 0, '{}', 1,
       NULL, ?, ?, ?, '', 'low',
       'serial', 0, '[]', ?
     )`
  ).run(
    row.deviceKey,
    row.serial ?? null,
    row.deviceName ?? null,
    row.property ?? null,
    JSON.stringify(row.flags ?? []),
    (row.flags ?? []).length,
    row.health,
    new Date().toISOString()
  );
}

beforeEach(() => {
  db = new Database(":memory:");
  runMigrations(db);
});

describe("getRecentTransitions", () => {
  it("returns the latest transition per device inside the window, newest first", () => {
    insertDeviceState({ deviceKey: "dev-a", deviceName: "POS-A", serial: "AAA111", health: "warning" });
    insertDeviceState({ deviceKey: "dev-b", deviceName: "POS-B", serial: "BBB222", health: "healthy" });

    // dev-a went healthy -> warning -> warning (only first transition counts inside window)
    insertHistory({ deviceKey: "dev-a", computedAt: isoMinutesAgo(48 * 60), health: "healthy" });
    insertHistory({ deviceKey: "dev-a", computedAt: isoMinutesAgo(60), health: "warning", flags: ["tag_mismatch"] });
    insertHistory({ deviceKey: "dev-a", computedAt: isoMinutesAgo(30), health: "warning", flags: ["tag_mismatch", "user_mismatch"] });
    // dev-b critical -> healthy 10m ago
    insertHistory({ deviceKey: "dev-b", computedAt: isoMinutesAgo(48 * 60), health: "critical", flags: ["no_profile_assigned"] });
    insertHistory({ deviceKey: "dev-b", computedAt: isoMinutesAgo(10), health: "healthy" });

    const since = isoMinutesAgo(24 * 60);
    const transitions = getRecentTransitions(db, since, 25);

    // Order: dev-a 30m ago (latest), dev-b 10m ago. Newest first → dev-b first.
    expect(transitions.map((t) => t.deviceKey)).toEqual(["dev-b", "dev-a"]);

    const devA = transitions.find((t) => t.deviceKey === "dev-a")!;
    expect(devA.fromHealth).toBe("warning"); // prior in-window state, not pre-window healthy
    expect(devA.toHealth).toBe("warning");
    expect(devA.direction).toBe("lateral");
    expect(devA.addedFlags).toEqual(["user_mismatch"]);
    expect(devA.removedFlags).toEqual([]);

    const devB = transitions.find((t) => t.deviceKey === "dev-b")!;
    expect(devB.fromHealth).toBe("critical");
    expect(devB.toHealth).toBe("healthy");
    expect(devB.direction).toBe("recovery");
    expect(devB.removedFlags).toEqual(["no_profile_assigned"]);
  });

  it("classifies transitions correctly across all severity ranks", () => {
    insertDeviceState({ deviceKey: "regress", health: "critical" });
    insertHistory({ deviceKey: "regress", computedAt: isoMinutesAgo(120), health: "warning" });
    insertHistory({ deviceKey: "regress", computedAt: isoMinutesAgo(10), health: "critical" });

    insertDeviceState({ deviceKey: "fresh", health: "healthy" });
    // No prior history at all → fromHealth = null, treated as rank 0.
    insertHistory({ deviceKey: "fresh", computedAt: isoMinutesAgo(20), health: "healthy" });

    const since = isoMinutesAgo(24 * 60);
    const transitions = getRecentTransitions(db, since, 25);

    const regress = transitions.find((t) => t.deviceKey === "regress")!;
    expect(regress.direction).toBe("regression");

    const fresh = transitions.find((t) => t.deviceKey === "fresh")!;
    expect(fresh.fromHealth).toBeNull();
    // healthy(rank 1) > unknown(rank 0) → counts as a regression-from-nothing
    expect(fresh.direction).toBe("regression");
  });

  it("excludes rows older than the window cutoff", () => {
    insertDeviceState({ deviceKey: "old", health: "warning" });
    insertHistory({ deviceKey: "old", computedAt: isoMinutesAgo(48 * 60), health: "warning" });

    const since = isoMinutesAgo(24 * 60);
    expect(getRecentTransitions(db, since, 25)).toHaveLength(0);
  });

  it("respects the limit", () => {
    for (let i = 0; i < 5; i++) {
      const key = `dev-${i}`;
      insertDeviceState({ deviceKey: key, health: "warning" });
      insertHistory({ deviceKey: key, computedAt: isoMinutesAgo(10 + i), health: "warning" });
    }
    const transitions = getRecentTransitions(db, isoMinutesAgo(60), 3);
    expect(transitions).toHaveLength(3);
  });

  it("returns an empty array when there is no history at all", () => {
    expect(getRecentTransitions(db, isoMinutesAgo(60), 25)).toEqual([]);
  });
});

describe("countNewlyUnhealthy", () => {
  it("only counts devices that crossed from healthy/unknown into warning or critical", () => {
    // dev-a: was healthy before window, became warning inside window → counts
    insertHistory({ deviceKey: "dev-a", computedAt: isoMinutesAgo(48 * 60), health: "healthy" });
    insertHistory({ deviceKey: "dev-a", computedAt: isoMinutesAgo(30), health: "warning" });

    // dev-b: was already critical before window, still critical → does NOT count
    insertHistory({ deviceKey: "dev-b", computedAt: isoMinutesAgo(48 * 60), health: "critical" });
    insertHistory({ deviceKey: "dev-b", computedAt: isoMinutesAgo(20), health: "critical" });

    // dev-c: first-ever observation inside window, lands at critical → counts
    insertHistory({ deviceKey: "dev-c", computedAt: isoMinutesAgo(15), health: "critical" });

    // dev-d: in-window transition is healthy → does NOT count
    insertHistory({ deviceKey: "dev-d", computedAt: isoMinutesAgo(48 * 60), health: "warning" });
    insertHistory({ deviceKey: "dev-d", computedAt: isoMinutesAgo(5), health: "healthy" });

    expect(countNewlyUnhealthy(db, isoMinutesAgo(24 * 60))).toBe(2);
  });
});

describe("getDeviceDetail — nameJoined flag", () => {
  interface DetailedRow {
    deviceKey: string;
    autopilotId: string | null;
    intuneId: string | null;
    entraId: string | null;
    matchedOn: "serial" | "entra_device_id" | "device_id" | "device_name";
    matchConfidence: "high" | "medium" | "low";
  }

  function insertDeviceStateDetailed(row: DetailedRow) {
    db.prepare(
      `INSERT INTO device_state (
         device_key, serial_number, autopilot_id, intune_id, entra_id, device_name, property_label,
         group_tag, assigned_profile_name, autopilot_assigned_user_upn, intune_primary_user_upn,
         last_checkin_at, trust_type, has_autopilot_record, has_intune_record, has_entra_record,
         has_profile_assigned, profile_assignment_status, is_in_correct_group, deployment_mode,
         deployment_mode_mismatch, hybrid_join_configured, hybrid_join_risk, user_assignment_match,
         compliance_state, provisioning_stalled, tag_mismatch, assignment_path, assignment_chain_complete,
         assignment_break_point, active_flags, flag_count, overall_health, diagnosis, match_confidence,
         matched_on, identity_conflict, active_rule_ids, computed_at
       ) VALUES (
         ?, NULL, ?, ?, ?, 'HOSTNAME', NULL,
         NULL, NULL, NULL, NULL,
         NULL, NULL, ?, ?, ?,
         0, NULL, 1, NULL,
         0, 0, 0, NULL,
         NULL, 0, 0, '{}', 1,
         NULL, '[]', 0, 'healthy', '', ?,
         ?, 0, '[]', ?
       )`
    ).run(
      row.deviceKey,
      row.autopilotId,
      row.intuneId,
      row.entraId,
      row.autopilotId ? 1 : 0,
      row.intuneId ? 1 : 0,
      row.entraId ? 1 : 0,
      row.matchConfidence,
      row.matchedOn,
      new Date().toISOString()
    );
  }

  it("is true when ≥2 source records are present and the matched key is device_name", () => {
    insertDeviceStateDetailed({
      deviceKey: "dev-name-join",
      autopilotId: "ap-1",
      intuneId: "in-1",
      entraId: "en-1",
      matchedOn: "device_name",
      matchConfidence: "low"
    });

    const detail = getDeviceDetail(db, "dev-name-join");
    expect(detail).not.toBeNull();
    expect(detail!.identity.nameJoined).toBe(true);
    expect(detail!.identity.matchConfidence).toBe("low");
  });

  it("is false when only one source record is present, even if matched_on is device_name", () => {
    // Solo records legitimately report matched_on = "device_name" as their
    // strongest identifier. There is no cross-system claim to warn about.
    insertDeviceStateDetailed({
      deviceKey: "dev-solo",
      autopilotId: null,
      intuneId: "in-solo",
      entraId: null,
      matchedOn: "device_name",
      matchConfidence: "high"
    });

    const detail = getDeviceDetail(db, "dev-solo");
    expect(detail!.identity.nameJoined).toBe(false);
    expect(detail!.identity.matchConfidence).toBe("high");
  });

  it("is false when multiple records are present but joined by a strong key", () => {
    insertDeviceStateDetailed({
      deviceKey: "dev-serial-join",
      autopilotId: "ap-2",
      intuneId: "in-2",
      entraId: "en-2",
      matchedOn: "serial",
      matchConfidence: "high"
    });

    const detail = getDeviceDetail(db, "dev-serial-join");
    expect(detail!.identity.nameJoined).toBe(false);
  });

  it("is true when exactly two records join by name (two-record bundle counts)", () => {
    insertDeviceStateDetailed({
      deviceKey: "dev-pair-name",
      autopilotId: null,
      intuneId: "in-3",
      entraId: "en-3",
      matchedOn: "device_name",
      matchConfidence: "low"
    });

    const detail = getDeviceDetail(db, "dev-pair-name");
    expect(detail!.identity.nameJoined).toBe(true);
  });
});
