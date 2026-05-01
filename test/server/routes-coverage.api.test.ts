import Database from "better-sqlite3";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Stub requireDelegatedAuth so settings / sync / rules write paths can be
// exercised end-to-end without wiring up a real delegated session. 401-path
// assertions for these routes live in provisioning-groups.api.test.ts instead.
vi.mock("../../src/server/auth/auth-middleware.js", () => ({
  requireDelegatedAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  hasValidDelegatedSession: () => true,
  getDelegatedToken: () => "test-token",
  getDelegatedUser: () => "test-user"
}));

import { createApp } from "../../src/server/app.js";
import { runMigrations } from "../../src/server/db/migrate.js";
import { seedMockData } from "../../src/server/db/seed.js";

/**
 * Route-coverage tests for endpoints that had zero or minimal test coverage.
 * Each describe block targets a specific router.
 */

let db: Database.Database;

beforeEach(async () => {
  db = new Database(":memory:");
  runMigrations(db);
  await seedMockData(db);
});

// ──────────────────────────────────────────────
// Health
// ──────────────────────────────────────────────
describe("GET /api/health", () => {
  it("returns ok and dbReady", async () => {
    const app = createApp(db);
    const res = await request(app).get("/api/health").expect(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.dbReady).toBe(true);
    expect(typeof res.body.uptimeSeconds).toBe("number");
  });
});

// ──────────────────────────────────────────────
// Profiles
// ──────────────────────────────────────────────
describe("GET /api/profiles", () => {
  it("returns seeded profiles as an array", async () => {
    const app = createApp(db);
    const res = await request(app).get("/api/profiles").expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(4); // seed has 4 profiles
  });

  it("each profile has profileId and profileName", async () => {
    const app = createApp(db);
    const res = await request(app).get("/api/profiles").expect(200);
    for (const profile of res.body) {
      expect(typeof profile.profileId).toBe("string");
      expect(typeof profile.profileName).toBe("string");
      expect(typeof profile.deploymentMode).toBe("string");
      expect(typeof profile.assignedDevices).toBe("number");
    }
  });
});

describe("GET /api/profiles/:profileId", () => {
  it("returns detail for a known profile", async () => {
    const app = createApp(db);
    const res = await request(app).get("/api/profiles/prof-north-user").expect(200);
    expect(res.body.profileName).toBe("AP-North-UserDriven");
    expect(Array.isArray(res.body.targetingGroups)).toBe(true);
    expect(Array.isArray(res.body.deviceBreakdown)).toBe(true);
  });

  it("returns 404 for unknown profile", async () => {
    const app = createApp(db);
    await request(app).get("/api/profiles/nonexistent").expect(404);
  });
});

// ──────────────────────────────────────────────
// Groups
// ──────────────────────────────────────────────
describe("GET /api/groups", () => {
  it("returns seeded groups with member counts", async () => {
    const app = createApp(db);
    const res = await request(app).get("/api/groups").expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(4); // 4 groups in seed

    for (const group of res.body) {
      expect(typeof group.groupId).toBe("string");
      expect(typeof group.groupName).toBe("string");
      expect(typeof group.memberCount).toBe("number");
      expect(Array.isArray(group.assignedProfiles)).toBe(true);
    }
  });
});

describe("GET /api/groups/:groupId", () => {
  it("returns group detail with members array", async () => {
    const app = createApp(db);
    const res = await request(app).get("/api/groups/grp-north-devices").expect(200);
    expect(res.body.groupName).toBe("AP-North-Devices");
    expect(Array.isArray(res.body.members)).toBe(true);
    expect(Array.isArray(res.body.assignedProfiles)).toBe(true);
    expect(res.body.memberCount).toBe(res.body.members.length);
  });

  it("members have expected shape", async () => {
    const app = createApp(db);
    const res = await request(app).get("/api/groups/grp-north-devices").expect(200);
    if (res.body.members.length > 0) {
      const member = res.body.members[0];
      expect(typeof member.deviceKey).toBe("string");
      expect(typeof member.health).toBe("string");
    }
  });

  it("returns 404 for unknown group", async () => {
    const app = createApp(db);
    await request(app).get("/api/groups/nonexistent-group").expect(404);
  });
});

describe("GET /api/groups/:groupId/check/:deviceKey", () => {
  it("returns isMember true for a device in the group", async () => {
    const app = createApp(db);
    // Get a device that is in grp-north-devices
    const groupRes = await request(app).get("/api/groups/grp-north-devices").expect(200);
    if (groupRes.body.members.length === 0) return; // skip if no members

    const deviceKey = groupRes.body.members[0].deviceKey;
    const checkRes = await request(app)
      .get(`/api/groups/grp-north-devices/check/${deviceKey}`)
      .expect(200);

    expect(checkRes.body.isMember).toBe(true);
    expect(typeof checkRes.body.entraId).toBe("string");
  });

  it("returns 404 for unknown device key", async () => {
    const app = createApp(db);
    await request(app)
      .get("/api/groups/grp-north-devices/check/nonexistent-device")
      .expect(404);
  });
});

// ──────────────────────────────────────────────
// Settings — full CRUD on tag config
// ──────────────────────────────────────────────
describe("Settings tag-config CRUD", () => {
  it("GET /api/settings returns full settings with tagConfig", async () => {
    const app = createApp(db);
    const res = await request(app).get("/api/settings").expect(200);
    expect(Array.isArray(res.body.tagConfig)).toBe(true);
    expect(res.body.tagConfig.length).toBeGreaterThanOrEqual(3); // North, South, Kiosk
  });

  it("GET /api/settings/tag-config returns tag config array", async () => {
    const app = createApp(db);
    const res = await request(app).get("/api/settings/tag-config").expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("PUT updates an existing tag config", async () => {
    const app = createApp(db);
    await request(app)
      .put("/api/settings/tag-config/North")
      .send({
        groupTag: "North",
        propertyLabel: "North Updated",
        expectedProfileNames: ["AP-North-UserDriven"],
        expectedGroupNames: ["AP-North-Devices"]
      })
      .expect(200);

    const res = await request(app).get("/api/settings/tag-config").expect(200);
    const north = res.body.find((r: { groupTag: string }) => r.groupTag === "North");
    expect(north.propertyLabel).toBe("North Updated");
  });

  it("DELETE removes a tag config and returns 204", async () => {
    const app = createApp(db);
    await request(app).delete("/api/settings/tag-config/Kiosk").expect(204);

    const res = await request(app).get("/api/settings/tag-config").expect(200);
    const kiosk = res.body.find((r: { groupTag: string }) => r.groupTag === "Kiosk");
    expect(kiosk).toBeUndefined();
  });

  it("POST rejects invalid payload (missing groupTag)", async () => {
    const app = createApp(db);
    const res = await request(app)
      .post("/api/settings/tag-config")
      .send({
        propertyLabel: "Missing Tag",
        expectedProfileNames: [],
        expectedGroupNames: []
      });
    // Zod validation should reject — expect 4xx
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("POST /api/settings/tag-config/preview reports impact without persisting", async () => {
    const app = createApp(db);
    const before = await request(app).get("/api/settings/tag-config").expect(200);
    const originalNorth = before.body.find((r: { groupTag: string }) => r.groupTag === "North");

    const res = await request(app)
      .post("/api/settings/tag-config/preview")
      .send({
        groupTag: "North",
        propertyLabel: "Preview Only",
        expectedProfileNames: ["No-Such-Profile"],
        expectedGroupNames: ["No-Such-Group"]
      })
      .expect(200);

    expect(res.body.record.groupTag).toBe("North");
    expect(res.body.matchedDevices).toBeGreaterThan(0);
    expect(typeof res.body.impact.propertyLabelChanges).toBe("number");
    expect(Array.isArray(res.body.sampleDevices)).toBe(true);

    const after = await request(app).get("/api/settings/tag-config").expect(200);
    const unchangedNorth = after.body.find((r: { groupTag: string }) => r.groupTag === "North");
    expect(unchangedNorth).toEqual(originalNorth);
  });
});

// ──────────────────────────────────────────────
// Device history
// ──────────────────────────────────────────────
describe("GET /api/devices/:deviceKey/history", () => {
  it("returns { deviceKey, entries } shape", async () => {
    const app = createApp(db);
    const list = await request(app).get("/api/devices").expect(200);
    const key = list.body.items[0].deviceKey;

    const res = await request(app).get(`/api/devices/${key}/history`).expect(200);
    expect(res.body.deviceKey).toBe(key);
    expect(Array.isArray(res.body.entries)).toBe(true);
  });

  it("drift_seed device has at least one history entry (compliance changed)", async () => {
    const app = createApp(db);
    // The seed runs two snapshots — the drift_seed device flips from
    // compliant→noncompliant, which should produce history entries.
    const list = await request(app).get("/api/devices?search=CZC9000003").expect(200);
    if (list.body.items.length === 0) return;

    const key = list.body.items[0].deviceKey;
    const res = await request(app).get(`/api/devices/${key}/history`).expect(200);
    expect(res.body.entries.length).toBeGreaterThanOrEqual(1);
  });
});

// ──────────────────────────────────────────────
// Sync status (read-only — we don't trigger a real sync in tests)
// ──────────────────────────────────────────────
describe("GET /api/sync/status", () => {
  it("returns sync status shape", async () => {
    const app = createApp(db);
    const res = await request(app).get("/api/sync/status").expect(200);
    expect(typeof res.body.inProgress).toBe("boolean");
    expect(Array.isArray(res.body.logs)).toBe(true);
  });
});
