import Database from "better-sqlite3";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const delegatedAuthMock = vi.hoisted(() => ({
  createAuthState: vi.fn(() => "test-state"),
  getAuthUrl: vi.fn(async (state?: string) => `https://login.example.test/?state=${state ?? "missing"}`),
  acquireDelegatedToken: vi.fn(async () => ({
    accessToken: "delegated-token",
    account: {
      username: "admin@example.com",
      name: "Admin User"
    },
    expiresOn: new Date("2030-04-22T18:00:00.000Z")
  }))
}));

vi.mock("../../src/server/auth/delegated-auth.js", () => delegatedAuthMock);

describe("delegated auth flow", () => {
  let db: Database.Database;
  let envBackup: NodeJS.ProcessEnv;

  beforeEach(async () => {
    envBackup = { ...process.env };
    process.env.NODE_ENV = "test";
    process.env.AZURE_TENANT_ID = "11111111-1111-1111-1111-111111111111";
    process.env.AZURE_CLIENT_ID = "22222222-2222-2222-2222-222222222222";
    process.env.AZURE_CLIENT_SECRET = "super-secret-value";
    process.env.AZURE_REDIRECT_URI = "http://localhost:3001/api/auth/callback";
    process.env.SESSION_SECRET = "test-session-secret";

    delegatedAuthMock.createAuthState.mockClear();
    delegatedAuthMock.getAuthUrl.mockClear();
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

  it("stores a generated state before returning the login URL", async () => {
    const { createApp } = await import("../../src/server/app.js");
    const app = createApp(db);
    const agent = request.agent(app);

    const response = await agent.get("/api/auth/login").expect(200);

    expect(response.body.loginUrl).toContain("state=test-state");
    expect(delegatedAuthMock.createAuthState).toHaveBeenCalledTimes(1);
    expect(delegatedAuthMock.getAuthUrl).toHaveBeenCalledWith("test-state");
  });

  it("rejects callbacks with a missing or mismatched state", async () => {
    const { createApp } = await import("../../src/server/app.js");
    const app = createApp(db);
    const agent = request.agent(app);

    await agent.get("/api/auth/login").expect(200);

    await agent
      .get("/api/auth/callback")
      .query({ code: "abc123", state: "wrong-state" })
      .expect(400);

    expect(delegatedAuthMock.acquireDelegatedToken).not.toHaveBeenCalled();
  });

  it("creates an authenticated session after a valid callback", async () => {
    const { createApp } = await import("../../src/server/app.js");
    const app = createApp(db);
    const agent = request.agent(app);

    await agent.get("/api/auth/login").expect(200);

    await agent
      .get("/api/auth/callback")
      .query({ code: "abc123", state: "test-state" })
      .expect(200);

    const status = await agent.get("/api/auth/status").expect(200);
    expect(status.body).toMatchObject({
      authenticated: true,
      user: "admin@example.com",
      name: "Admin User",
      expiresAt: "2030-04-22T18:00:00.000Z"
    });
    expect(delegatedAuthMock.acquireDelegatedToken).toHaveBeenCalledWith("abc123");
  });

  it("clears the delegated session on logout", async () => {
    const { createApp } = await import("../../src/server/app.js");
    const app = createApp(db);
    const agent = request.agent(app);

    await agent.get("/api/auth/login").expect(200);
    await agent
      .get("/api/auth/callback")
      .query({ code: "abc123", state: "test-state" })
      .expect(200);

    await agent.post("/api/auth/logout").expect(200, { authenticated: false });

    const status = await agent.get("/api/auth/status").expect(200);
    expect(status.body.authenticated).toBe(false);
    expect(status.body.user).toBeNull();
  });
});
