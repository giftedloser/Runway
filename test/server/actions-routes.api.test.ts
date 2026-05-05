import Database from "better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

// Stub the delegated-auth middleware so requireDelegatedAuth becomes a no-op
// for tests. We still want to exercise the route guards (action allowlist,
// device lookup, validation), not the session/cookie machinery.
vi.mock("../../src/server/auth/auth-middleware.js", () => ({
  requireDelegatedAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAppAccess: (_req: unknown, _res: unknown, next: () => void) => next(),
  hasValidDelegatedSession: () => false,
  hasValidAppAccessSession: () => false,
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
  deleteAutopilotDevice: vi.fn().mockResolvedValue({ success: true, status: 204, message: "ok" })
};

vi.mock("../../src/server/actions/remote-actions.js", () => remoteActionMocks);

// Imports must come AFTER vi.mock so the mocks are wired before module
// resolution.
const { createApp } = await import("../../src/server/app.js");
const { runMigrations } = await import("../../src/server/db/migrate.js");
const { __resetActionRateLimitForTests } = await import(
  "../../src/server/auth/rate-limit.js"
);

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
       ?, ?, ?, ?, ?, 'POS-01', 'North',
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
  __resetActionRateLimitForTests();
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

  it("allows rotate-laps in bulk mode and rejects retire", async () => {
    const app = createApp(db);
    seedDevice(db, { deviceKey: "dev-1", intuneId: "intune-1" });

    // Retire was removed from the bulk surface — irreversible actions
    // stay one-click-per-device.
    const retire = await request(app)
      .post("/api/actions/bulk")
      .send({ action: "retire", deviceKeys: ["dev-1"] });
    expect(retire.status).toBe(400);
    expect(remoteActionMocks.retireDevice).not.toHaveBeenCalled();

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

  it("stamps one bulk_run_id across all logged rows in a bulk request", async () => {
    const app = createApp(db);
    seedDevice(db, { deviceKey: "dev-a", intuneId: "intune-a", serial: "BULK001" });
    seedDevice(db, { deviceKey: "dev-b", intuneId: "intune-b", serial: "BULK002" });

    const response = await request(app)
      .post("/api/actions/bulk")
      .send({ action: "sync", deviceKeys: ["dev-a", "dev-b"] });

    expect(response.status).toBe(200);
    expect(response.body.bulkRunId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );

    const rows = db
      .prepare("SELECT bulk_run_id FROM action_log ORDER BY id ASC")
      .all() as Array<{ bulk_run_id: string | null }>;
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.bulk_run_id)).toEqual([
      response.body.bulkRunId,
      response.body.bulkRunId
    ]);
  });
});

describe("POST /api/actions/bulk — partial Graph failure", () => {
  it("keeps going when individual Graph calls fail, fail-thrown, or 401, and audits each outcome", async () => {
    const app = createApp(db);
    seedDevice(db, { deviceKey: "dev-ok", intuneId: "intune-ok", serial: "OK0001" });
    seedDevice(db, { deviceKey: "dev-503", intuneId: "intune-503", serial: "FAIL503" });
    seedDevice(db, { deviceKey: "dev-401", intuneId: "intune-401", serial: "AUTH401" });
    seedDevice(db, { deviceKey: "dev-throw", intuneId: "intune-throw", serial: "THROW01" });

    remoteActionMocks.syncDevice
      .mockResolvedValueOnce({ success: true, status: 204, message: "ok" })
      .mockResolvedValueOnce({
        success: false,
        status: 503,
        message: "Sync failed with status 503."
      })
      .mockResolvedValueOnce({
        success: false,
        status: 401,
        message: "Sync failed with status 401."
      })
      .mockRejectedValueOnce(new Error("network blew up"));

    const response = await request(app)
      .post("/api/actions/bulk")
      .send({
        action: "sync",
        deviceKeys: ["dev-ok", "dev-503", "dev-401", "dev-throw"]
      });

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(4);
    expect(response.body.successCount).toBe(1);
    expect(response.body.failureCount).toBe(3);
    expect(remoteActionMocks.syncDevice).toHaveBeenCalledTimes(4);

    const statuses = response.body.results.map(
      (r: { deviceKey: string; status: number }) => [r.deviceKey, r.status]
    );
    expect(statuses).toEqual([
      ["dev-ok", 204],
      ["dev-503", 503],
      ["dev-401", 401],
      ["dev-throw", 500]
    ]);

    const rows = db
      .prepare(
        "SELECT graph_response_status, notes, bulk_run_id FROM action_log ORDER BY id ASC"
      )
      .all() as Array<{
      graph_response_status: number;
      notes: string;
      bulk_run_id: string | null;
    }>;
    expect(rows).toHaveLength(4);
    expect(rows.map((r) => r.graph_response_status)).toEqual([204, 503, 401, 500]);
    expect(new Set(rows.map((r) => r.bulk_run_id)).size).toBe(1);
    expect(rows[3].notes).toMatch(/network blew up/);
    expect(rows.every((r) => r.notes.startsWith("[bulk]"))).toBe(true);
  });

  it("does not abort the run when the very first device 401s (mid-flight token rejection)", async () => {
    const app = createApp(db);
    seedDevice(db, { deviceKey: "dev-a", intuneId: "intune-a", serial: "A1" });
    seedDevice(db, { deviceKey: "dev-b", intuneId: "intune-b", serial: "B2" });
    seedDevice(db, { deviceKey: "dev-c", intuneId: "intune-c", serial: "C3" });

    remoteActionMocks.rotateLapsPassword
      .mockResolvedValueOnce({
        success: false,
        status: 401,
        message: "LAPS rotation failed with status 401."
      })
      .mockResolvedValueOnce({ success: true, status: 204, message: "ok" })
      .mockResolvedValueOnce({ success: true, status: 204, message: "ok" });

    const response = await request(app)
      .post("/api/actions/bulk")
      .send({ action: "rotate-laps", deviceKeys: ["dev-a", "dev-b", "dev-c"] });

    // The bulk endpoint deliberately continues — surfacing per-device 401s
    // rather than short-circuiting lets the operator see whether the failure
    // is fleet-wide (true token expiry) or device-specific.
    expect(response.status).toBe(200);
    expect(remoteActionMocks.rotateLapsPassword).toHaveBeenCalledTimes(3);
    expect(response.body.successCount).toBe(2);
    expect(response.body.failureCount).toBe(1);
  });
});

describe("POST /api/actions/:deviceKey/:action — partial Graph failure", () => {
  it("propagates the Graph status code as the HTTP status when a single action fails", async () => {
    const app = createApp(db);
    seedDevice(db, { deviceKey: "dev-403", intuneId: "intune-403" });
    remoteActionMocks.wipeDevice.mockResolvedValueOnce({
      success: false,
      status: 403,
      message: "Wipe failed with status 403."
    });

    const response = await request(app).post("/api/actions/dev-403/wipe").send({});
    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/403/);

    const row = db
      .prepare("SELECT graph_response_status, notes FROM action_log")
      .get() as { graph_response_status: number; notes: string };
    expect(row.graph_response_status).toBe(403);
    expect(row.notes).toMatch(/403/);
  });

  it("captures thrown exceptions as a 500 audit row instead of leaking the stack to the client", async () => {
    const app = createApp(db);
    seedDevice(db, { deviceKey: "dev-throw", intuneId: "intune-throw" });
    remoteActionMocks.retireDevice.mockRejectedValueOnce(new Error("connection reset"));

    const response = await request(app).post("/api/actions/dev-throw/retire").send({});
    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("connection reset");

    const row = db
      .prepare("SELECT graph_response_status, notes FROM action_log")
      .get() as { graph_response_status: number; notes: string };
    expect(row.graph_response_status).toBe(500);
    expect(row.notes).toBe("connection reset");
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
      autopilotId: "autopilot-orphan"
    });

    const autopilot = await request(app)
      .post("/api/actions/dev-orphan/delete-autopilot")
      .send({});

    expect(autopilot.status).toBe(200);
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
      .prepare("SELECT action_type, triggered_by, bulk_run_id FROM action_log ORDER BY id ASC")
      .all() as Array<{ action_type: string; triggered_by: string; bulk_run_id: string | null }>;
    expect(rows).toEqual([
      { action_type: "sync", triggered_by: "tester@example.com", bulk_run_id: null },
      { action_type: "reboot", triggered_by: "tester@example.com", bulk_run_id: null }
    ]);
  });

  it("neutralizes spreadsheet formulas in action-log CSV exports", async () => {
    const app = createApp(db);
    db.prepare(
      `INSERT INTO action_log (
        device_serial, device_name, intune_id, action_type, triggered_by,
        triggered_at, graph_response_status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      "=SERIAL",
      "+DEVICE",
      "-INTUNE",
      "sync",
      "@operator@example.com",
      "2026-04-07T00:00:00.000Z",
      204,
      "=HYPERLINK(\"https://example.com\")"
    );

    const response = await request(app).get("/api/actions/logs/export?format=csv");

    expect(response.status).toBe(200);
    expect(response.text).toContain("'=SERIAL");
    expect(response.text).toContain("'+DEVICE");
    expect(response.text).toContain("'-INTUNE");
    expect(response.text).toContain("'@operator@example.com");
    expect(response.text).toContain("\"'=HYPERLINK(\"\"https://example.com\"\")\"");
  });
});
