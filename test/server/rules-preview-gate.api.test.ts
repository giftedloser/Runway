import Database from "better-sqlite3";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Stub MSAL — we never need it to actually mint a token; the auth flow
// stores a synthetic delegated session in the express-session store.
const delegatedAuthMock = vi.hoisted(() => ({
  createAuthState: vi.fn(() => "test-state"),
  getAuthUrl: vi.fn(async (state?: string) => `https://login.example.test/?state=${state ?? "missing"}`),
  getAppAccessAuthUrl: vi.fn(async (state?: string) => `https://login.example.test/app?state=${state ?? "missing"}`),
  acquireDelegatedToken: vi.fn(async () => ({
    accessToken: "delegated-token",
    account: { username: "admin@example.com", name: "Admin User" },
    expiresOn: new Date("2030-04-22T18:00:00.000Z")
  })),
  acquireAppAccessToken: vi.fn(async () => ({
    account: { username: "tech@example.com", name: "Tech User" },
    expiresOn: new Date("2030-04-22T18:00:00.000Z")
  }))
}));

vi.mock("../../src/server/auth/delegated-auth.js", () => delegatedAuthMock);

describe("POST /api/rules/preview auth gate", () => {
  let db: Database.Database;
  let envBackup: NodeJS.ProcessEnv;

  beforeEach(async () => {
    envBackup = { ...process.env };
    process.env.NODE_ENV = "test";
    process.env.AZURE_TENANT_ID = "11111111-1111-1111-1111-111111111111";
    process.env.AZURE_CLIENT_ID = "22222222-2222-2222-2222-222222222222";
    process.env.AZURE_CLIENT_SECRET = "super-secret-value-for-tests";
    process.env.AZURE_REDIRECT_URI = "http://localhost:3001/api/auth/callback";
    process.env.SESSION_SECRET = "test-session-secret";
    // App-access disabled so a single delegated sign-in is enough to
    // exercise the rule preview gate. The tenant-side app-access flow
    // is covered by auth.api.test.ts.
    process.env.APP_ACCESS_MODE = "disabled";
    delete process.env.APP_ACCESS_ALLOWED_USERS;
    delete process.env.RUNWAY_DESKTOP_TOKEN;

    delegatedAuthMock.createAuthState.mockClear();
    delegatedAuthMock.acquireDelegatedToken.mockClear();

    db = new Database(":memory:");
    const { runMigrations } = await import("../../src/server/db/migrate.js");
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
    vi.resetModules();
    process.env = envBackup;
  });

  // Mutating verbs need a loopback/tauri Origin even in test mode; this
  // mirrors how the real client/Tauri shell calls the API.
  const ALLOWED_ORIGIN = "http://localhost:5173";

  it("returns 401 to an unauthenticated client", async () => {
    const { createApp } = await import("../../src/server/app.js");
    const app = createApp(db);

    await request(app)
      .post("/api/rules/preview")
      .set("Origin", ALLOWED_ORIGIN)
      .send({
        predicate: {
          type: "leaf",
          field: "deviceName",
          op: "exists",
          value: null
        },
        scope: "global",
        severity: "info"
      })
      .expect(401);
  });

  it("admits the same payload after a delegated admin sign-in", async () => {
    const { createApp } = await import("../../src/server/app.js");
    const app = createApp(db);
    const agent = request.agent(app);

    await agent.get("/api/auth/login").expect(200);
    await agent
      .get("/api/auth/callback")
      .query({ code: "abc123", state: "test-state" })
      .expect(200);

    const response = await agent
      .post("/api/rules/preview")
      .set("Origin", ALLOWED_ORIGIN)
      .send({
        predicate: {
          type: "leaf",
          field: "deviceName",
          op: "exists",
          value: null
        },
        scope: "global",
        severity: "info"
      })
      .expect(200);

    expect(response.body).toHaveProperty("count");
    expect(response.body).toHaveProperty("sampleDevices");
  });
});
