import Database from "better-sqlite3";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../src/server/app.js";
import { runMigrations } from "../../src/server/db/migrate.js";

describe("settings access tiers", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
  });

  it("lets an unauthenticated local user read and write public-local display settings", async () => {
    const app = createApp(db);

    const settings = await request(app).get("/api/settings").expect(200);
    expect(
      settings.body.appSettings.find((setting: { key: string }) => setting.key === "display.theme")
    ).toMatchObject({
      accessTier: "public-local",
      value: "system"
    });

    const updated = await request(app)
      .put("/api/settings/display.theme")
      .send({ value: "oled" })
      .expect(200);

    expect(updated.body).toMatchObject({
      key: "display.theme",
      accessTier: "public-local",
      value: "oled",
      source: "db"
    });
  });

  it("blocks unauthenticated writes to admin-operational settings", async () => {
    const app = createApp(db);

    await request(app)
      .put("/api/settings/sync.intervalMinutes")
      .send({ value: 30 })
      .expect(401)
      .expect((response) => {
        expect(response.body.message).toBe("Admin sign-in required for this setting.");
      });
  });

  it("keeps secret-security settings protected", async () => {
    const app = createApp(db);

    await request(app)
      .put("/api/settings/security.sessionTimeoutMinutes")
      .send({ value: 0 })
      .expect(401)
      .expect((response) => {
        expect(response.body.message).toBe("Security setting changes require admin sign-in.");
      });
  });
});
