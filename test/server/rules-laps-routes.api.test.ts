import Database from "better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

// Stub delegated auth — same pattern as actions-routes tests.
vi.mock("../../src/server/auth/auth-middleware.js", () => ({
  requireDelegatedAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  hasValidDelegatedSession: () => false,
  getDelegatedToken: () => "fake-token",
  getDelegatedUser: () => "tester@example.com"
}));

// Stub LAPS Graph call
const lapsPasswordMock = vi.fn().mockResolvedValue({
  success: true,
  status: 200,
  credential: {
    accountName: "LocalAdmin",
    password: "xK9!mN2@pQ7#",
    passwordExpirationDateTime: "2026-05-01T00:00:00Z",
    backupDateTime: "2026-04-01T00:00:00Z"
  }
});
vi.mock("../../src/server/actions/laps.js", () => ({
  getLapsPassword: lapsPasswordMock
}));

const { createApp } = await import("../../src/server/app.js");
const { runMigrations } = await import("../../src/server/db/migrate.js");
const { seedMockData } = await import("../../src/server/db/seed.js");

let db: Database.Database;

beforeEach(async () => {
  db = new Database(":memory:");
  runMigrations(db);
  await seedMockData(db);
  lapsPasswordMock.mockClear();
});

// ──────────────────────────────────────────────
// Rules CRUD
// ──────────────────────────────────────────────
describe("Rules CRUD /api/rules", () => {
  it("GET returns seeded rules (may be empty)", async () => {
    const app = createApp(db);
    const res = await request(app).get("/api/rules").expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("POST creates a rule and returns 201", async () => {
    const app = createApp(db);
    const rule = {
      name: "Test Rule",
      description: "flag devices with a specific serial prefix",
      severity: "warning",
      scope: "global",
      predicate: {
        type: "leaf",
        field: "serial_number",
        op: "starts_with",
        value: "CZC99"
      }
    };
    const res = await request(app).post("/api/rules").send(rule).expect(201);
    expect(res.body.name).toBe("Test Rule");
    expect(typeof res.body.id).toBe("string");

    // Verify it shows up in the list
    const list = await request(app).get("/api/rules").expect(200);
    expect(list.body.some((r: { name: string }) => r.name === "Test Rule")).toBe(true);
  });

  it("PUT updates an existing rule", async () => {
    const app = createApp(db);
    // First create a rule
    const created = await request(app)
      .post("/api/rules")
      .send({
        name: "Original",
        severity: "info",
        scope: "global",
        predicate: { type: "leaf", field: "serial_number", op: "exists" }
      })
      .expect(201);

    // Update it
    const updated = await request(app)
      .put(`/api/rules/${created.body.id}`)
      .send({ name: "Renamed", severity: "critical" })
      .expect(200);

    expect(updated.body.name).toBe("Renamed");
    expect(updated.body.severity).toBe("critical");
  });

  it("PUT returns 404 for unknown rule ID", async () => {
    const app = createApp(db);
    await request(app)
      .put("/api/rules/nonexistent-id")
      .send({ name: "Nope" })
      .expect(404);
  });

  it("DELETE removes a rule and returns 204", async () => {
    const app = createApp(db);
    const created = await request(app)
      .post("/api/rules")
      .send({
        name: "Doomed",
        severity: "info",
        scope: "global",
        predicate: { type: "leaf", field: "serial_number", op: "exists" }
      })
      .expect(201);

    await request(app).delete(`/api/rules/${created.body.id}`).expect(204);

    // Verify it's gone
    const list = await request(app).get("/api/rules").expect(200);
    expect(list.body.some((r: { id: string }) => r.id === created.body.id)).toBe(false);
  });

  it("DELETE returns 404 for unknown rule ID", async () => {
    const app = createApp(db);
    await request(app).delete("/api/rules/nonexistent-id").expect(404);
  });

  it("POST rejects invalid predicate (missing field)", async () => {
    const app = createApp(db);
    const res = await request(app)
      .post("/api/rules")
      .send({
        name: "Bad",
        severity: "info",
        scope: "global",
        predicate: { type: "leaf", op: "exists" } // missing 'field'
      });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

// ──────────────────────────────────────────────
// LAPS route
// ──────────────────────────────────────────────
describe("GET /api/laps/:deviceKey", () => {
  it("returns LAPS credential for a device with an Entra ID", async () => {
    const app = createApp(db);
    // Get a device from the seeded data
    const devices = await request(app).get("/api/devices").expect(200);
    const deviceKey = devices.body.items[0].deviceKey;

    const res = await request(app).get(`/api/laps/${deviceKey}`).expect(200);
    expect(res.body.accountName).toBe("LocalAdmin");
    expect(res.body.password).toBe("xK9!mN2@pQ7#");
    expect(lapsPasswordMock).toHaveBeenCalledTimes(1);
  });

  it("returns 404 for unknown device", async () => {
    const app = createApp(db);
    await request(app).get("/api/laps/nonexistent-device").expect(404);
  });

  it("logs the LAPS retrieval in the action_log table", async () => {
    const app = createApp(db);
    const devices = await request(app).get("/api/devices").expect(200);
    const deviceKey = devices.body.items[0].deviceKey;

    await request(app).get(`/api/laps/${deviceKey}`).expect(200);

    const logs = db
      .prepare("SELECT action_type, triggered_by FROM action_log WHERE action_type = 'laps_view'")
      .all() as Array<{ action_type: string; triggered_by: string }>;
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].triggered_by).toBe("tester@example.com");
  });
});
