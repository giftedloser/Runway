import Database from "better-sqlite3";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../src/server/app.js";
import { runMigrations } from "../../src/server/db/migrate.js";
import { seedMockData } from "../../src/server/db/seed.js";
import type { FlagCode } from "../../src/shared/types.js";

/**
 * Extended API integration tests that pin response shapes and filter
 * behaviour beyond the basic smoke tests in api.api.test.ts.
 */
describe("API — dashboard", () => {
  let db: Database.Database;

  beforeEach(async () => {
    db = new Database(":memory:");
    runMigrations(db);
    await seedMockData(db);
  });

  it("includes correlationQuality in the dashboard response", async () => {
    const app = createApp(db);
    const res = await request(app).get("/api/dashboard").expect(200);
    expect(res.body.correlationQuality).toBeDefined();
    expect(typeof res.body.correlationQuality.nameJoinedCount).toBe("number");
    expect(typeof res.body.correlationQuality.identityConflictCount).toBe("number");
    expect(typeof res.body.correlationQuality.lowConfidenceCount).toBe("number");
  });

  it("includes healthTrend as an array", async () => {
    const app = createApp(db);
    const res = await request(app).get("/api/dashboard").expect(200);
    expect(Array.isArray(res.body.healthTrend)).toBe(true);
  });

  it("includes recentTransitions as an array", async () => {
    const app = createApp(db);
    const res = await request(app).get("/api/dashboard").expect(200);
    expect(Array.isArray(res.body.recentTransitions)).toBe(true);
  });

  it("seeds a comprehensive showcase fleet with healthy devices and every core flag", async () => {
    const app = createApp(db);
    const res = await request(app).get("/api/dashboard").expect(200);

    expect(res.body.counts.healthy).toBeGreaterThan(40);
    expect(res.body.counts.critical).toBeGreaterThan(0);
    expect(res.body.counts.warning).toBeGreaterThan(0);
    expect(res.body.counts.info).toBeGreaterThan(0);

    const flags = new Set(
      (
        db
          .prepare("SELECT active_flags FROM device_state")
          .all() as Array<{ active_flags: string }>
      ).flatMap((row) => JSON.parse(row.active_flags) as FlagCode[])
    );
    const expectedFlags: FlagCode[] = [
      "no_autopilot_record",
      "no_profile_assigned",
      "profile_assignment_failed",
      "profile_assigned_not_enrolled",
      "not_in_target_group",
      "deployment_mode_mismatch",
      "hybrid_join_risk",
      "user_mismatch",
      "provisioning_stalled",
      "compliance_drift",
      "orphaned_autopilot",
      "missing_ztdid",
      "identity_conflict",
      "tag_mismatch"
    ];

    for (const flag of expectedFlags) {
      expect(flags.has(flag)).toBe(true);
    }

    const conditionalAccessCount = db
      .prepare("SELECT COUNT(*) AS count FROM conditional_access_policies")
      .get() as { count: number };
    const sccmFlag = db
      .prepare("SELECT enabled FROM feature_flags WHERE key = 'sccm_detection'")
      .get() as { enabled: number } | undefined;
    expect(conditionalAccessCount.count).toBeGreaterThanOrEqual(4);
    expect(sccmFlag?.enabled).toBe(1);
  });
});

describe("API — device list filtering", () => {
  let db: Database.Database;

  beforeEach(async () => {
    db = new Database(":memory:");
    runMigrations(db);
    await seedMockData(db);
  });

  it("filters by health level", async () => {
    const app = createApp(db);
    const all = await request(app).get("/api/devices").expect(200);
    const healthy = await request(app).get("/api/devices?health=healthy").expect(200);
    const critical = await request(app).get("/api/devices?health=critical").expect(200);

    // At least one of these should be non-empty
    expect(healthy.body.total + critical.body.total).toBeLessThanOrEqual(all.body.total);

    // Every returned item must match the filter
    for (const item of healthy.body.items) {
      expect(item.health).toBe("healthy");
    }
    for (const item of critical.body.items) {
      expect(item.health).toBe("critical");
    }
  });

  it("supports pagination", async () => {
    const app = createApp(db);
    const page1 = await request(app).get("/api/devices?page=1&pageSize=2").expect(200);
    expect(page1.body.items.length).toBeLessThanOrEqual(2);
    expect(page1.body.page).toBe(1);
    expect(page1.body.pageSize).toBe(2);

    if (page1.body.total > 2) {
      const page2 = await request(app).get("/api/devices?page=2&pageSize=2").expect(200);
      expect(page2.body.page).toBe(2);
      // Pages should have different items
      const keys1 = page1.body.items.map((i: { deviceKey: string }) => i.deviceKey);
      const keys2 = page2.body.items.map((i: { deviceKey: string }) => i.deviceKey);
      const overlap = keys1.filter((k: string) => keys2.includes(k));
      expect(overlap).toHaveLength(0);
    }
  });

  it("device list items include activeRules array", async () => {
    const app = createApp(db);
    const res = await request(app).get("/api/devices").expect(200);
    for (const item of res.body.items) {
      expect(Array.isArray(item.activeRules)).toBe(true);
    }
  });
});

describe("API — device detail", () => {
  let db: Database.Database;

  beforeEach(async () => {
    db = new Database(":memory:");
    runMigrations(db);
    await seedMockData(db);
  });

  it("returns sourceRefs with raw JSON fields", async () => {
    const app = createApp(db);
    const list = await request(app).get("/api/devices").expect(200);
    const key = list.body.items[0].deviceKey;
    const detail = await request(app).get(`/api/devices/${key}`).expect(200);

    expect(detail.body.sourceRefs).toBeDefined();
    expect("autopilotRawJson" in detail.body.sourceRefs).toBe(true);
    expect("intuneRawJson" in detail.body.sourceRefs).toBe(true);
    expect("entraRawJson" in detail.body.sourceRefs).toBe(true);
  });

  it("returns identity block with matchConfidence and nameJoined", async () => {
    const app = createApp(db);
    const list = await request(app).get("/api/devices").expect(200);
    const key = list.body.items[0].deviceKey;
    const detail = await request(app).get(`/api/devices/${key}`).expect(200);

    expect(detail.body.identity).toBeDefined();
    expect(["high", "medium", "low"]).toContain(detail.body.identity.matchConfidence);
    expect(typeof detail.body.identity.nameJoined).toBe("boolean");
  });

  it("returns ruleViolations array", async () => {
    const app = createApp(db);
    const list = await request(app).get("/api/devices").expect(200);
    const key = list.body.items[0].deviceKey;
    const detail = await request(app).get(`/api/devices/${key}`).expect(200);

    expect(Array.isArray(detail.body.ruleViolations)).toBe(true);
  });

  it("returns SCCM / ConfigMgr management-agent fields in enrollment", async () => {
    const app = createApp(db);
    const list = await request(app).get("/api/devices").expect(200);
    const key = list.body.items[0].deviceKey;
    const detail = await request(app).get(`/api/devices/${key}`).expect(200);

    expect("managementAgent" in detail.body.enrollment).toBe(true);
    expect("hasConfigMgrClient" in detail.body.enrollment).toBe(true);
    expect(typeof detail.body.enrollment.hasConfigMgrClient).toBe("boolean");
  });

  it("diagnostics include caveat field (nullable)", async () => {
    const app = createApp(db);
    const list = await request(app).get("/api/devices").expect(200);
    const key = list.body.items[0].deviceKey;
    const detail = await request(app).get(`/api/devices/${key}`).expect(200);

    for (const diag of detail.body.diagnostics) {
      expect("caveat" in diag).toBe(true);
    }
  });

  it("returns 404 for unknown device key", async () => {
    const app = createApp(db);
    await request(app).get("/api/devices/nonexistent-key-12345").expect(404);
  });
});
