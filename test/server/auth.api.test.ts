import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import Database from "better-sqlite3";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const delegatedAuthMock = vi.hoisted(() => ({
  createAuthState: vi.fn(() => "test-state"),
  getAuthUrl: vi.fn(async (state?: string) => `https://login.example.test/?state=${state ?? "missing"}`),
  getAppAccessAuthUrl: vi.fn(async (state?: string) => `https://login.example.test/app?state=${state ?? "missing"}`),
  acquireDelegatedToken: vi.fn(async () => ({
    accessToken: "delegated-token",
    account: {
      username: "admin@example.com",
      name: "Admin User"
    },
    expiresOn: new Date("2030-04-22T18:00:00.000Z")
  })),
  acquireAppAccessToken: vi.fn(async () => ({
    account: {
      username: "tech@example.com",
      name: "Tech User"
    },
    expiresOn: new Date("2030-04-22T18:00:00.000Z")
  }))
}));

vi.mock("../../src/server/auth/delegated-auth.js", () => delegatedAuthMock);

describe("delegated auth flow", () => {
  let db: Database.Database;
  let envBackup: NodeJS.ProcessEnv;
  let tempDirs: string[];

  beforeEach(async () => {
    envBackup = { ...process.env };
    tempDirs = [];
    process.env.NODE_ENV = "test";
    process.env.AZURE_TENANT_ID = "11111111-1111-1111-1111-111111111111";
    process.env.AZURE_CLIENT_ID = "22222222-2222-2222-2222-222222222222";
    process.env.AZURE_CLIENT_SECRET = "super-secret-value";
    process.env.AZURE_REDIRECT_URI = "http://localhost:3001/api/auth/callback";
    process.env.SESSION_SECRET = "test-session-secret";
    delete process.env.APP_ACCESS_MODE;
    delete process.env.APP_ACCESS_ALLOWED_USERS;
    delete process.env.RUNWAY_DESKTOP_TOKEN;
    delete process.env.PILOTCHECK_ENV_PATH;

    delegatedAuthMock.createAuthState.mockClear();
    delegatedAuthMock.getAuthUrl.mockClear();
    delegatedAuthMock.getAppAccessAuthUrl.mockClear();
    delegatedAuthMock.acquireDelegatedToken.mockClear();
    delegatedAuthMock.acquireAppAccessToken.mockClear();

    db = new Database(":memory:");
    const { runMigrations } = await import("../../src/server/db/migrate.js");
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
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

  it("notifies both runtime and local client origins after callback", async () => {
    const { createApp } = await import("../../src/server/app.js");
    const app = createApp(db);
    const agent = request.agent(app);

    await agent.get("/api/auth/login").expect(200);

    const response = await agent
      .get("/api/auth/callback")
      .query({ code: "abc123", state: "test-state" })
      .expect(200);

    expect(response.text).toContain('"http://localhost:3001"');
    expect(response.text).toContain('"http://localhost:5173"');
    expect(response.text).toContain('"http://127.0.0.1:5173"');
    expect(response.text).toContain('window.location.assign("/")');
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

  it("requires app access by default once Graph is configured", async () => {
    const { createApp } = await import("../../src/server/app.js");
    const app = createApp(db);

    const status = await request(app).get("/api/auth/access-status").expect(200);
    expect(status.body).toMatchObject({
      required: true,
      configured: true,
      mode: "entra",
      authenticated: false
    });

    await request(app).get("/api/settings").expect(401);
  });

  it("keeps the explicit disabled access mode available for local-only/dev runs", async () => {
    process.env.APP_ACCESS_MODE = "disabled";
    process.env.APP_ACCESS_ALLOWED_USERS = "admin@example.com,other@example.com";
    const { createApp } = await import("../../src/server/app.js");
    const app = createApp(db);
    const agent = request.agent(app);

    const status = await request(app).get("/api/auth/access-status").expect(200);
    expect(status.body).toMatchObject({
      required: false,
      configured: false,
      mode: "disabled",
      authenticated: false
    });
    const publicSettings = await request(app).get("/api/settings").expect(200);
    expect(publicSettings.body.appAccess).toMatchObject({
      allowedUsersConfigured: true,
      allowedUsersCount: 2
    });
    expect(publicSettings.body.appAccess).not.toHaveProperty("allowedUsers");
    await request(app)
      .put("/api/settings/sync.intervalMinutes")
      .send({ value: 30 })
      .expect(401);

    await agent.get("/api/auth/login").expect(200);
    await agent
      .get("/api/auth/callback")
      .query({ code: "abc123", state: "test-state" })
      .expect(200);

    const authedSettings = await agent.get("/api/settings").expect(200);
    expect(authedSettings.body.appAccess).toMatchObject({
      allowedUsersConfigured: true,
      allowedUsersCount: 2
    });
    expect(authedSettings.body.appAccess).not.toHaveProperty("allowedUsers");
  });

  it.each([
    "AZURE_CLIENT_SECRET",
    "SESSION_SECRET",
    "AZURE_CLIENT_CERT_PATH",
    "AZURE_CLIENT_CERT_THUMBPRINT",
    "APP_ACCESS_ALLOWED_USERS"
  ])("rejects secret-tier key %s for delegated admins", async (key) => {
    process.env.APP_ACCESS_MODE = "disabled";
    const { createApp } = await import("../../src/server/app.js");
    const app = createApp(db);
    const agent = request.agent(app);

    await agent.get("/api/auth/login").expect(200);
    await agent
      .get("/api/auth/callback")
      .query({ code: "abc123", state: "test-state" })
      .expect(200);

    await agent
      .put(`/api/settings/${key}`)
      .send({ value: "should-not-store" })
      .expect(400)
      .expect((response) => {
        expect(response.body.message).toBe(`Unknown app setting "${key}".`);
      });
  });

  it("requires app access for API routes when the Entra gate is enabled", async () => {
    const { createApp } = await import("../../src/server/app.js");
    const app = createApp(db);
    const agent = request.agent(app);

    await agent.get("/api/settings").expect(401);

    const login = await agent.get("/api/auth/access-login").expect(200);
    expect(login.body.loginUrl).toContain("state=test-state");
    expect(delegatedAuthMock.getAppAccessAuthUrl).toHaveBeenCalledWith("test-state");

    const callback = await agent
      .get("/api/auth/callback")
      .query({ code: "abc123", state: "test-state" })
      .expect(200);
    expect(callback.text).toContain("pilotcheck-access-auth-complete");

    const status = await agent.get("/api/auth/access-status").expect(200);
    expect(status.body).toMatchObject({
      required: true,
      authenticated: true,
      user: "tech@example.com",
      name: "Tech User"
    });

    await agent.get("/api/settings").expect(200);

    await agent.get("/api/auth/login").expect(200);
    await agent
      .get("/api/auth/callback")
      .query({ code: "abc123", state: "test-state" })
      .expect(200);

    await agent.get("/api/settings").expect(200);
  });

  it("denies app access when the signed-in user is outside the allow-list", async () => {
    process.env.APP_ACCESS_ALLOWED_USERS = "someone-else@example.com";
    const { createApp } = await import("../../src/server/app.js");
    const app = createApp(db);
    const agent = request.agent(app);

    await agent.get("/api/auth/access-login").expect(200);
    await agent
      .get("/api/auth/callback")
      .query({ code: "abc123", state: "test-state" })
      .expect(403);

    const status = await agent.get("/api/auth/access-status").expect(200);
    expect(status.body.authenticated).toBe(false);
    await agent.get("/api/settings").expect(401);
  });

  it("requires the desktop session token for first-run Graph bootstrap when the token is configured", async () => {
    delete process.env.AZURE_TENANT_ID;
    delete process.env.AZURE_CLIENT_ID;
    delete process.env.AZURE_CLIENT_SECRET;
    process.env.RUNWAY_DESKTOP_TOKEN = "desktop-token-value-with-at-least-32-chars";
    const dir = mkdtempSync(path.join(tmpdir(), "runway-env-"));
    tempDirs.push(dir);
    process.env.PILOTCHECK_ENV_PATH = path.join(dir, ".env");

    const { createApp } = await import("../../src/server/app.js");
    const app = createApp(db);
    const payload = {
      tenantId: "11111111-1111-1111-1111-111111111111",
      clientId: "22222222-2222-2222-2222-222222222222",
      clientSecret: "new-client-secret-value-with-enough-chars-to-pass-validation"
    };

    await request(app).post("/api/settings/graph").send(payload).expect(403);
    await request(app)
      .post("/api/settings/graph")
      .set("X-Runway-Desktop-Token", "desktop-token-value-with-at-least-32-chars")
      .send(payload)
      .expect(202);
  });
});
