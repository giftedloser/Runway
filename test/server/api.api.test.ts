import Database from "better-sqlite3";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Bypass delegated-auth so the settings-write assertion can still run.
// The dedicated 401-guard assertions live in provisioning-groups.api.test.ts.
vi.mock("../../src/server/auth/auth-middleware.js", () => ({
  requireDelegatedAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  hasValidDelegatedSession: () => true,
  getDelegatedToken: () => "test-token",
  getDelegatedUser: () => "test-user"
}));

import { createApp } from "../../src/server/app.js";
import { runMigrations } from "../../src/server/db/migrate.js";
import { seedMockData } from "../../src/server/db/seed.js";

describe("Runway API", () => {
  let db: Database.Database;

  beforeEach(async () => {
    db = new Database(":memory:");
    runMigrations(db);
    await seedMockData(db);
  });

  it("serves dashboard aggregates", async () => {
    const app = createApp(db);
    const response = await request(app).get("/api/dashboard").expect(200);

    const total = (Object.values(response.body.counts) as number[]).reduce(
      (sum, value) => sum + value,
      0
    );
    expect(total).toBeGreaterThan(0);
    expect(response.body.failurePatterns.length).toBeGreaterThan(0);
  });

  it("lists devices and returns detail", async () => {
    const app = createApp(db);
    const listResponse = await request(app).get("/api/devices").expect(200);

    expect(listResponse.body.items.length).toBeGreaterThan(0);

    const detailResponse = await request(app)
      .get(`/api/devices/${listResponse.body.items[0].deviceKey}`)
      .expect(200);

    expect(detailResponse.body.assignmentPath).toBeDefined();
    expect(detailResponse.body.diagnostics).toBeDefined();
  });

  it("updates tag config through the settings API", async () => {
    const app = createApp(db);

    await request(app)
      .post("/api/settings/tag-config")
      .send({
        groupTag: "LAB",
        propertyLabel: "Lab",
        expectedProfileNames: ["AP-Lab-UserDriven"],
        expectedGroupNames: ["AP-Lab-Devices"]
      })
      .expect(201);

    const response = await request(app).get("/api/settings").expect(200);
    expect(response.body.tagConfig.some((row: { groupTag: string }) => row.groupTag === "LAB")).toBe(true);
  });

  it("updates the SCCM detection feature flag through the settings API", async () => {
    const app = createApp(db);

    const updated = await request(app)
      .put("/api/settings/feature-flags/sccm_detection")
      .send({ enabled: true })
      .expect(200);

    expect(updated.body.sccm_detection).toBe(true);
    const settings = await request(app).get("/api/settings").expect(200);
    expect(settings.body.featureFlags.sccm_detection).toBe(true);
  });

  it("updates app settings through the settings API", async () => {
    const app = createApp(db);

    const updated = await request(app)
      .put("/api/settings/sync.intervalMinutes")
      .send({ value: 30 })
      .expect(200);

    expect(updated.body).toMatchObject({
      key: "sync.intervalMinutes",
      value: 30,
      source: "db"
    });

    const settings = await request(app).get("/api/settings").expect(200);
    const syncInterval = settings.body.appSettings.find(
      (setting: { key: string }) => setting.key === "sync.intervalMinutes"
    );
    expect(syncInterval).toMatchObject({
      value: 30,
      source: "db"
    });
  });

  it("validates and resets app settings through the settings API", async () => {
    const app = createApp(db);

    await request(app)
      .put("/api/settings/sync.intervalMinutes")
      .send({ value: 10 })
      .expect(400)
      .expect((response) => {
        expect(response.body.message).toContain("Sync interval must be one of");
      });

    await request(app)
      .put("/api/settings/retention.deviceHistoryDays")
      .send({ value: 120 })
      .expect(200);

    await request(app)
      .post("/api/settings/reset")
      .send({ confirmationToken: "RESET_APP_SETTINGS" })
      .expect(200);

    const settings = await request(app).get("/api/settings").expect(200);
    const historyRetention = settings.body.appSettings.find(
      (setting: { key: string }) => setting.key === "retention.deviceHistoryDays"
    );
    expect(historyRetention.value).toBe(90);
    expect(historyRetention.source).not.toBe("db");
  });

  it.each([
    "AZURE_CLIENT_SECRET",
    "SESSION_SECRET",
    "AZURE_CLIENT_CERT_PATH",
    "AZURE_CLIENT_CERT_THUMBPRINT",
    "APP_ACCESS_ALLOWED_USERS"
  ])("rejects secret-tier key %s through the app settings API", async (key) => {
    const app = createApp(db);

    await request(app)
      .put(`/api/settings/${key}`)
      .send({ value: "should-not-store" })
      .expect(400)
      .expect((response) => {
        expect(response.body.message).toBe(`Unknown app setting "${key}".`);
      });
  });
});
