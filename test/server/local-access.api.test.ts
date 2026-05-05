import Database from "better-sqlite3";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("requireLocalAccess gate", () => {
  let db: Database.Database;
  let envBackup: NodeJS.ProcessEnv;

  beforeEach(async () => {
    envBackup = { ...process.env };
    vi.resetModules();
    // Force production-mode middleware (isDevOrTest=false) so the gate
    // is the active guard, not the dev passthrough.
    process.env.NODE_ENV = "production";
    process.env.SESSION_SECRET = "long-test-session-secret-1234567890abcdef";
    process.env.RUNWAY_DESKTOP_TOKEN = "x".repeat(40);
    process.env.AZURE_TENANT_ID = "";
    process.env.AZURE_CLIENT_ID = "";
    process.env.AZURE_CLIENT_SECRET = "";
    process.env.AZURE_CLIENT_CERT_PATH = "";
    process.env.AZURE_CLIENT_CERT_THUMBPRINT = "";
    process.env.APP_ACCESS_MODE = "disabled";

    db = new Database(":memory:");
    const { runMigrations } = await import("../../src/server/db/migrate.js");
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
    vi.resetModules();
    process.env = envBackup;
  });

  it("rejects /api requests with no token, no session, no allowed origin", async () => {
    const { createApp } = await import("../../src/server/app.js");
    const app = createApp(db);
    const res = await request(app).get("/api/devices");
    expect(res.status).toBe(401);
  });

  it("admits /api requests carrying the desktop token", async () => {
    const { createApp } = await import("../../src/server/app.js");
    const app = createApp(db);
    const res = await request(app)
      .get("/api/devices")
      .set("X-Runway-Desktop-Token", process.env.RUNWAY_DESKTOP_TOKEN!);
    expect(res.status).toBe(200);
  });

  it("blocks mutating methods from a non-allowed origin", async () => {
    const { createApp } = await import("../../src/server/app.js");
    const app = createApp(db);
    const res = await request(app)
      .post("/api/sync/full")
      .set("X-Runway-Desktop-Token", process.env.RUNWAY_DESKTOP_TOKEN!)
      .set("Origin", "https://evil.example.com");
    expect(res.status).toBe(403);
  });

  it("blocks mutating methods from unrelated localhost ports", async () => {
    const { createApp } = await import("../../src/server/app.js");
    const app = createApp(db);
    const res = await request(app)
      .post("/api/sync/full")
      .set("X-Runway-Desktop-Token", process.env.RUNWAY_DESKTOP_TOKEN!)
      .set("Origin", "http://localhost:9999");
    expect(res.status).toBe(403);
  });

  it("admits mutating requests from the configured client origin", async () => {
    const { createApp } = await import("../../src/server/app.js");
    const app = createApp(db);
    const res = await request(app)
      .post("/api/sync/full")
      .set("X-Runway-Desktop-Token", process.env.RUNWAY_DESKTOP_TOKEN!)
      .set("Origin", "http://localhost:5173");
    expect(res.status).not.toBe(403);
  });

  it("admits mutating requests from a tauri:// origin", async () => {
    const { createApp } = await import("../../src/server/app.js");
    const app = createApp(db);
    const res = await request(app)
      .post("/api/sync/full")
      .set("X-Runway-Desktop-Token", process.env.RUNWAY_DESKTOP_TOKEN!)
      .set("Origin", "tauri://localhost");
    // Either succeeds or fails for a downstream reason — the only
    // assertion that matters is that the origin guard didn't 403 it.
    expect(res.status).not.toBe(403);
  });

  // ── Desktop token compare (timing-safe) ──────────────────────────
  it("rejects an empty desktop token header", async () => {
    const { createApp } = await import("../../src/server/app.js");
    const app = createApp(db);
    const res = await request(app)
      .get("/api/devices")
      .set("X-Runway-Desktop-Token", "");
    expect(res.status).toBe(401);
  });

  it("rejects a desktop token with a length mismatch", async () => {
    const { createApp } = await import("../../src/server/app.js");
    const app = createApp(db);
    const expected = process.env.RUNWAY_DESKTOP_TOKEN!;
    const res = await request(app)
      .get("/api/devices")
      .set("X-Runway-Desktop-Token", expected.slice(0, expected.length - 1));
    expect(res.status).toBe(401);
  });

  it("rejects a desktop token of the same length but different content", async () => {
    const { createApp } = await import("../../src/server/app.js");
    const app = createApp(db);
    const expected = process.env.RUNWAY_DESKTOP_TOKEN!;
    const wrong = "y".repeat(expected.length);
    expect(wrong).not.toEqual(expected);
    expect(wrong.length).toEqual(expected.length);
    const res = await request(app)
      .get("/api/devices")
      .set("X-Runway-Desktop-Token", wrong);
    expect(res.status).toBe(401);
  });
});
