import Database from "better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

// Stub the delegated-auth middleware so requireDelegatedAuth becomes a no-op
// for tests. We still want to exercise the route guards (action allowlist,
// device lookup, validation), not the session/cookie machinery.
vi.mock("../../src/server/auth/auth-middleware.js", () => ({
  requireDelegatedAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  getDelegatedToken: () => "fake-token",
  getDelegatedUser: () => "tester@example.com"
}));

// Stub the actual Graph calls so no network ever happens. Each function
// returns a successful 204-style result; we assert via call counts which
// ones the route fired.
const remoteActionMocks = {
  syncDevice: vi.fn().mockResolvedValue({ success: true, status: 204, message: "ok" }),
  rebootDevice: vi.fn().mockResolvedValue({ success: true, status: 204, message: "ok" }),
  renameDevice: vi.fn().mockResolvedValue({ success: true, status: 204, message: "ok" }),
  autopilotReset: vi.fn().mockResolvedValue({ success: true, status: 204, message: "ok" }),
  retireDevice: vi.fn().mockResolvedValue({ success: true, status: 204, message: "ok" }),
  wipeDevice: vi.fn().mockResolvedValue({ success: true, status: 204, message: "ok" }),
  rotateLapsPassword: vi.fn().mockResolvedValue({ success: true, status: 204, message: "ok" }),
  deleteIntuneDevice: vi.fn().mockResolvedValue({ success: true, status: 204, message: "ok" }),
  deleteEntraDevice: vi.fn().mockResolvedValue({ success: true, status: 204, message: "ok" }),
  deleteAutopilotDevice: vi.fn().mockResolvedValue({ success: true, status: 204, message: "ok" })
};

vi.mock("../../src/server/actions/remote-actions.js", () => remoteActionMocks);

// Imports must come AFTER vi.mock so the mocks are wired before module
// resolution.
const { createApp } = await import("../../src/server/app.js");
const { runMigrations } = await import("../../src/server/db/migrate.js");

function seedDevice(
  db: Database.Database,
  overrides: {
    deviceKey: string;
    intuneId: string | null;
    entraId?: string | null;
    autopilotId?: string | null;
    serial?: string;
  }
) {
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
       ?, ?, ?, ?, ?, 'POS-01', 'Lodge',
       NULL, NULL, NULL, NULL,
       NULL, NULL, 0, 1, 0,
       0, NULL, 1, NULL,
       0, 0, 0, NULL,
       NULL, 0, 0, '{}', 1,
       NULL, '[]', 0, 'healthy', '', 'low',
       'serial', 0, '[]', '2026-04-07T00:00:00.000Z'
     )`
  ).run(
    overrides.deviceKey,
    overrides.serial ?? "AAA111",
    overrides.autopilotId ?? null,
    overrides.intuneId,
    overrides.entraId ?? null
  );
}

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  runMigrations(db);
  Object.values(remoteActionMocks).forEach((fn) => fn.mockClear());
});

describe("POST /api/actions/bulk — guardrails", () => {
  it("rejects the still-destructive actions in bulk mode (wipe, autopilot-reset, rename, delete-*)", async () => {
    const app = createApp(db);
    seedDevice(db, { deviceKey: "dev-1", intuneId: "intune-1" });

    for (const action of [
      "wipe",
      "autopilot-reset",
      "rename",
      "delete-intune",
      "delete-entra",
      "delete-autopilot"
    ]) {
      const response = await request(app)
        .post("/api/actions/bulk")
        .send({ action, deviceKeys: ["dev-1"] });
      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/sync|reboot|retire|rotate-laps/i);
    }
    expect(remoteActionMocks.wipeDevice).not.toHaveBeenCalled();
    expect(remoteActionMocks.autopilotReset).not.toHaveBeenCalled();
  });

  it("allows retire and rotate-laps in bulk mode (high-value fleet ops)", async () => {
    const app = createApp(db);
    seedDevice(db, { deviceKey: "dev-1", intuneId: "intune-1" });

    const retire = await request(app)
      .post("/api/actions/bulk")
      .send({ action: "retire", deviceKeys: ["dev-1"] });
    expect(retire.status).toBe(200);
    expect(retire.body.successCount).toBe(1);
    expect(remoteActionMocks.retireDevice).toHaveBeenCalledTimes(1);

    const laps = await request(app)
      .post("/api/actions/bulk")
      .send({ action: "rotate-laps", deviceKeys: ["dev-1"] });
    expect(laps.status).toBe(200);
    expect(laps.body.successCount).toBe(1);
    expect(remoteActionMocks.rotateLapsPassword).toHaveBeenCalledTimes(1);
  });

  it("rejects empty or missing deviceKeys", async () => {
    const app = createApp(db);
    const empty = await request(app)
      .post("/api/actions/bulk")
      .send({ action: "sync", deviceKeys: [] });
    expect(empty.status).toBe(400);

    const missing = await request(app).post("/api/actions/bulk").send({ action: "sync" });
    expect(missing.status).toBe(400);
  });

  it("caps bulk requests at 200 devices to prevent fat-finger fan-out", async () => {
    const app = createApp(db);
    const tooMany = Array.from({ length: 201 }, (_, i) => `dev-${i}`);
    const response = await request(app)
      .post("/api/actions/bulk")
      .send({ action: "sync", deviceKeys: tooMany });
    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/200/);
    expect(remoteActionMocks.syncDevice).not.toHaveBeenCalled();
  });

  it("dispatches sync for known devices and reports per-device results", async () => {
    const app = createApp(db);
    seedDevice(db, { deviceKey: "dev-known", intuneId: "intune-known" });
    seedDevice(db, { deviceKey: "dev-no-intune", intuneId: null, serial: "BBB222" });

    const response = await request(app)
      .post("/api/actions/bulk")
      .send({ action: "sync", deviceKeys: ["dev-known", "dev-no-intune", "dev-missing"] });

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(3);
    expect(response.body.successCount).toBe(1);
    expect(response.body.failureCount).toBe(2);
    expect(remoteActionMocks.syncDevice).toHaveBeenCalledTimes(1);
    expect(remoteActionMocks.syncDevice).toHaveBeenCalledWith("fake-token", "intune-known");
  });
});

describe("POST /api/actions/:deviceKey/:action — guardrails", () => {
  it("returns 400 on unknown actions", async () => {
    const app = createApp(db);
    seedDevice(db, { deviceKey: "dev-1", intuneId: "intune-1" });

    const response = await request(app)
      .post("/api/actions/dev-1/bogus-action")
      .send({});
    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/unknown action/i);
  });

  it("returns 404 when the device key is not in device_state", async () => {
    const app = createApp(db);
    const response = await request(app).post("/api/actions/missing/sync").send({});
    expect(response.status).toBe(404);
  });

  it("returns 400 when the device has no Intune enrollment", async () => {
    const app = createApp(db);
    seedDevice(db, { deviceKey: "dev-no-intune", intuneId: null });
    const response = await request(app)
      .post("/api/actions/dev-no-intune/sync")
      .send({});
    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/no Intune enrollment/i);
    expect(remoteActionMocks.syncDevice).not.toHaveBeenCalled();
  });

  it("rejects rename payloads that violate the Windows NetBIOS rules", async () => {
    const app = createApp(db);
    seedDevice(db, { deviceKey: "dev-rename", intuneId: "intune-rename" });

    const cases = [
      { deviceName: "" },
      { deviceName: "-LeadingHyphen" },
      { deviceName: "name with spaces" },
      { deviceName: "WAY_TOO_LONG_NAME_HERE" },
      { deviceName: "has/slash" },
      { deviceName: undefined }
    ];
    for (const body of cases) {
      const response = await request(app)
        .post("/api/actions/dev-rename/rename")
        .send(body);
      expect(response.status).toBe(400);
    }
    expect(remoteActionMocks.renameDevice).not.toHaveBeenCalled();
  });

  it("accepts a valid rename and forwards it to the Graph dispatcher", async () => {
    const app = createApp(db);
    seedDevice(db, { deviceKey: "dev-rename", intuneId: "intune-rename" });
    const response = await request(app)
      .post("/api/actions/dev-rename/rename")
      .send({ deviceName: "POS-001" });
    expect(response.status).toBe(200);
    expect(remoteActionMocks.renameDevice).toHaveBeenCalledWith(
      "fake-token",
      "intune-rename",
      "POS-001"
    );
  });

  it("dispatches each destructive action to its dedicated remote-action function", async () => {
    const app = createApp(db);
    seedDevice(db, { deviceKey: "dev-d", intuneId: "intune-d" });

    await request(app).post("/api/actions/dev-d/wipe").send({});
    await request(app).post("/api/actions/dev-d/retire").send({});
    await request(app).post("/api/actions/dev-d/autopilot-reset").send({});
    await request(app).post("/api/actions/dev-d/rotate-laps").send({});
    await request(app).post("/api/actions/dev-d/reboot").send({});

    expect(remoteActionMocks.wipeDevice).toHaveBeenCalledTimes(1);
    expect(remoteActionMocks.retireDevice).toHaveBeenCalledTimes(1);
    expect(remoteActionMocks.autopilotReset).toHaveBeenCalledTimes(1);
    expect(remoteActionMocks.rotateLapsPassword).toHaveBeenCalledTimes(1);
    expect(remoteActionMocks.rebootDevice).toHaveBeenCalledTimes(1);
  });

  it("allows orphan cleanup actions that do not require an Intune enrollment", async () => {
    const app = createApp(db);
    seedDevice(db, {
      deviceKey: "dev-orphan",
      intuneId: null,
      entraId: "entra-orphan",
      autopilotId: "autopilot-orphan"
    });

    const entra = await request(app).post("/api/actions/dev-orphan/delete-entra").send({});
    const autopilot = await request(app)
      .post("/api/actions/dev-orphan/delete-autopilot")
      .send({});

    expect(entra.status).toBe(200);
    expect(autopilot.status).toBe(200);
    expect(remoteActionMocks.deleteEntraDevice).toHaveBeenCalledWith("fake-token", "entra-orphan");
    expect(remoteActionMocks.deleteAutopilotDevice).toHaveBeenCalledWith(
      "fake-token",
      "autopilot-orphan"
    );
  });

  it("writes an audit log row for every executed action", async () => {
    const app = createApp(db);
    seedDevice(db, { deviceKey: "dev-audit", intuneId: "intune-audit" });

    await request(app).post("/api/actions/dev-audit/sync").send({});
    await request(app).post("/api/actions/dev-audit/reboot").send({});

    const rows = db
      .prepare("SELECT action_type, triggered_by FROM action_log ORDER BY id ASC")
      .all() as Array<{ action_type: string; triggered_by: string }>;
    expect(rows).toEqual([
      { action_type: "sync", triggered_by: "tester@example.com" },
      { action_type: "reboot", triggered_by: "tester@example.com" }
    ]);
  });
});
