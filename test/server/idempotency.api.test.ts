import Database from "better-sqlite3";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/server/auth/auth-middleware.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/server/auth/auth-middleware.js")>(
    "../../src/server/auth/auth-middleware.js"
  );
  return {
    ...actual,
    requireDelegatedAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
    getDelegatedToken: () => "test-token",
    getDelegatedUser: () => "test-admin"
  };
});

vi.mock("../../src/server/actions/remote-actions.js", () => ({
  syncDevice: vi.fn(async () => ({
    success: true,
    status: 204,
    message: "Sync initiated."
  })),
  rebootDevice: vi.fn(),
  renameDevice: vi.fn(),
  autopilotReset: vi.fn(),
  retireDevice: vi.fn(),
  wipeDevice: vi.fn(),
  rotateLapsPassword: vi.fn(),
  changePrimaryUser: vi.fn(),
  deleteIntuneDevice: vi.fn(),
  deleteAutopilotDevice: vi.fn()
}));

describe("Idempotency-Key replay", () => {
  let db: Database.Database;
  let envBackup: NodeJS.ProcessEnv;

  beforeEach(async () => {
    vi.clearAllMocks();
    envBackup = { ...process.env };
    process.env.NODE_ENV = "test";
    process.env.SESSION_SECRET = "test-session-secret";

    db = new Database(":memory:");
    const { runMigrations } = await import("../../src/server/db/migrate.js");
    runMigrations(db);
    db.prepare(
      `INSERT INTO device_state
        (device_key, serial_number, intune_id, device_name, active_flags,
         flag_count, overall_health, diagnosis, match_confidence, matched_on,
         identity_conflict, assignment_path, computed_at, has_autopilot_record,
         has_intune_record, has_entra_record, has_profile_assigned,
         is_in_correct_group, deployment_mode_mismatch, hybrid_join_configured,
         hybrid_join_risk, user_assignment_match, provisioning_stalled,
         tag_mismatch, assignment_chain_complete, assignment_break_point)
       VALUES ('dev-1', 'SN1', 'intune-1', 'PC-1', '[]', 0, 'healthy', '',
         'high', 'serial', 0, '{}', '2026-01-01T00:00:00Z', 1, 1, 1, 1, 1, 0,
         1, 0, 1, 0, 0, 1, 'none')`
    ).run();
  });

  afterEach(() => {
    db.close();
    vi.resetModules();
    process.env = envBackup;
  });

  it("replays a duplicate request with the same Idempotency-Key", async () => {
    const { createApp } = await import("../../src/server/app.js");
    const remote = await import("../../src/server/actions/remote-actions.js");
    const app = createApp(db);
    const key = "11111111-1111-4111-8111-111111111111";

    const first = await request(app)
      .post("/api/actions/dev-1/sync")
      .set("Idempotency-Key", key)
      .send({});
    expect(first.status).toBe(200);
    expect(first.body.success).toBe(true);

    const second = await request(app)
      .post("/api/actions/dev-1/sync")
      .set("Idempotency-Key", key)
      .send({});
    expect(second.status).toBe(200);
    expect(second.body.replayed).toBe(true);
    // syncDevice should have been called exactly once across both requests.
    expect(remote.syncDevice).toHaveBeenCalledTimes(1);
  });

  it("returns 409 when the same key is reused with a different action", async () => {
    const { createApp } = await import("../../src/server/app.js");
    const app = createApp(db);
    const key = "22222222-2222-4222-8222-222222222222";

    await request(app).post("/api/actions/dev-1/sync").set("Idempotency-Key", key).send({});
    const conflict = await request(app)
      .post("/api/actions/dev-1/reboot")
      .set("Idempotency-Key", key)
      .send({});
    expect(conflict.status).toBe(409);
  });

  it("returns 409 when the same key is reused for another device", async () => {
    const { createApp } = await import("../../src/server/app.js");
    const remote = await import("../../src/server/actions/remote-actions.js");
    db.prepare(
      `INSERT INTO device_state
        (device_key, serial_number, intune_id, device_name, active_flags,
         flag_count, overall_health, diagnosis, match_confidence, matched_on,
         identity_conflict, assignment_path, computed_at, has_autopilot_record,
         has_intune_record, has_entra_record, has_profile_assigned,
         is_in_correct_group, deployment_mode_mismatch, hybrid_join_configured,
         hybrid_join_risk, user_assignment_match, provisioning_stalled,
         tag_mismatch, assignment_chain_complete, assignment_break_point)
       VALUES ('dev-2', 'SN2', 'intune-2', 'PC-2', '[]', 0, 'healthy', '',
         'high', 'serial', 0, '{}', '2026-01-01T00:00:00Z', 1, 1, 1, 1, 1, 0,
         1, 0, 1, 0, 0, 1, 'none')`
    ).run();
    const app = createApp(db);
    const key = "33333333-3333-4333-8333-333333333333";

    await request(app).post("/api/actions/dev-1/sync").set("Idempotency-Key", key).send({});
    const conflict = await request(app)
      .post("/api/actions/dev-2/sync")
      .set("Idempotency-Key", key)
      .send({});

    expect(conflict.status).toBe(409);
    expect(conflict.body.message).toMatch(/different device or request body/i);
    expect(remote.syncDevice).toHaveBeenCalledTimes(1);
  });

  it("replays old matching keys instead of dispatching into a unique-index failure", async () => {
    const { createApp } = await import("../../src/server/app.js");
    const remote = await import("../../src/server/actions/remote-actions.js");
    const app = createApp(db);
    const key = "44444444-4444-4444-8444-444444444444";

    const first = await request(app)
      .post("/api/actions/dev-1/sync")
      .set("Idempotency-Key", key)
      .send({});
    expect(first.status).toBe(200);

    db.prepare(
      "UPDATE action_log SET triggered_at = ? WHERE idempotency_key = ?"
    ).run("2020-01-01T00:00:00.000Z", key);

    const second = await request(app)
      .post("/api/actions/dev-1/sync")
      .set("Idempotency-Key", key)
      .send({});
    expect(second.status).toBe(200);
    expect(second.body.replayed).toBe(true);
    expect(remote.syncDevice).toHaveBeenCalledTimes(1);
  });

  it("rejects a malformed Idempotency-Key with 400", async () => {
    const { createApp } = await import("../../src/server/app.js");
    const app = createApp(db);
    const res = await request(app)
      .post("/api/actions/dev-1/sync")
      .set("Idempotency-Key", "not-a-uuid")
      .send({});
    expect(res.status).toBe(400);
  });
});
