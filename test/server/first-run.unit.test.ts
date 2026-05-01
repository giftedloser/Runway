import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";

import { runMigrations } from "../../src/server/db/migrate.js";
import { seedMockData } from "../../src/server/db/seed.js";
import { getFirstRunStatus } from "../../src/server/setup/first-run.js";

describe("first-run completeness", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
  });

  it("is incomplete before credentials, successful sync, and device rows exist", () => {
    expect(getFirstRunStatus(db, { graphCredentialsPresent: false })).toMatchObject({
      graphCredentialsPresent: false,
      successfulSyncCompleted: false,
      deviceRowsPresent: false,
      complete: false
    });
  });

  it("requires device rows even after a successful sync", () => {
    db.prepare(
      "INSERT INTO sync_log (sync_type, started_at, completed_at, devices_synced, errors) VALUES (?, ?, ?, ?, ?)"
    ).run("manual", "2026-05-01T10:00:00.000Z", "2026-05-01T10:01:00.000Z", 0, "[]");

    expect(getFirstRunStatus(db, { graphCredentialsPresent: true })).toMatchObject({
      graphCredentialsPresent: true,
      successfulSyncCompleted: true,
      deviceRowsPresent: false,
      complete: false
    });
  });

  it("is complete only when credentials, sync, and device rows are present", async () => {
    await seedMockData(db);

    expect(getFirstRunStatus(db, { graphCredentialsPresent: true })).toMatchObject({
      graphCredentialsPresent: true,
      successfulSyncCompleted: true,
      deviceRowsPresent: true,
      complete: true
    });
  });
});
