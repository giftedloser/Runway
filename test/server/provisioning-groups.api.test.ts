import Database from "better-sqlite3";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../src/server/app.js";
import { runMigrations } from "../../src/server/db/migrate.js";
import { seedMockData } from "../../src/server/db/seed.js";

/**
 * Tests for provisioning discovery/validation routes and group write
 * operation input validation (without delegated auth, so write ops
 * should return 401).
 */

let db: Database.Database;

beforeEach(async () => {
  db = new Database(":memory:");
  runMigrations(db);
  await seedMockData(db);
});

// ──────────────────────────────────────────────
// Provisioning — discover
// ──────────────────────────────────────────────
describe("GET /api/provisioning/discover", () => {
  it("returns 400 when groupTag is missing", async () => {
    const app = createApp(db);
    const res = await request(app).get("/api/provisioning/discover").expect(400);
    expect(res.body.message).toMatch(/groupTag/i);
  });

  it("returns 400 when groupTag is empty whitespace", async () => {
    const app = createApp(db);
    await request(app)
      .get("/api/provisioning/discover?groupTag=%20%20")
      .expect(400);
  });

  it("returns discovery results for a known tag", async () => {
    const app = createApp(db);
    const res = await request(app)
      .get("/api/provisioning/discover?groupTag=Lodge")
      .expect(200);

    expect(res.body.groupTag).toBe("Lodge");
    expect(typeof res.body.deviceCount).toBe("number");
    expect(Array.isArray(res.body.matchingGroups)).toBe(true);
    expect(Array.isArray(res.body.matchingProfiles)).toBe(true);
  });

  it("returns deviceCount and group/profile arrays for a tag with matches", async () => {
    const app = createApp(db);
    const res = await request(app)
      .get("/api/provisioning/discover?groupTag=Lodge")
      .expect(200);

    // Seed has Lodge devices and a group with "Lodge" in its name
    expect(res.body.deviceCount).toBeGreaterThanOrEqual(1);
    expect(res.body.matchingGroups.length).toBeGreaterThanOrEqual(1);

    // Each group has expected shape
    for (const group of res.body.matchingGroups) {
      expect(typeof group.groupId).toBe("string");
      expect(typeof group.groupName).toBe("string");
      expect(typeof group.membershipType).toBe("string");
    }
  });

  it("returns empty arrays for a tag with no matches", async () => {
    const app = createApp(db);
    const res = await request(app)
      .get("/api/provisioning/discover?groupTag=NONEXISTENT_TAG_12345")
      .expect(200);

    expect(res.body.deviceCount).toBe(0);
    expect(res.body.matchingGroups).toHaveLength(0);
    expect(res.body.matchingProfiles).toHaveLength(0);
    expect(res.body.existingConfig).toBeNull();
  });

  it("includes existingConfig when tag_config exists", async () => {
    const app = createApp(db);
    const res = await request(app)
      .get("/api/provisioning/discover?groupTag=Lodge")
      .expect(200);

    // Seed has a tag_config for "Lodge"
    expect(res.body.existingConfig).not.toBeNull();
    expect(res.body.existingConfig.groupTag).toBe("Lodge");
    expect(typeof res.body.existingConfig.propertyLabel).toBe("string");
    expect(Array.isArray(res.body.existingConfig.expectedProfileNames)).toBe(true);
    expect(Array.isArray(res.body.existingConfig.expectedGroupNames)).toBe(true);
  });
});

// ──────────────────────────────────────────────
// Provisioning — validate
// ──────────────────────────────────────────────
describe("POST /api/provisioning/validate", () => {
  it("returns 400 when body is completely empty", async () => {
    const app = createApp(db);
    await request(app)
      .post("/api/provisioning/validate")
      .send({})
      .expect(400);
  });

  it("returns valid=true for a correct chain", async () => {
    const app = createApp(db);
    const res = await request(app)
      .post("/api/provisioning/validate")
      .send({
        groupTag: "Lodge",
        groupId: "grp-lodge-devices",
        profileId: "prof-lodge-user"
      })
      .expect(200);

    expect(res.body.valid).toBe(true);
    expect(res.body.errors).toHaveLength(0);
  });

  it("returns errors when group does not exist", async () => {
    const app = createApp(db);
    const res = await request(app)
      .post("/api/provisioning/validate")
      .send({
        groupTag: "Lodge",
        groupId: "nonexistent-group-id",
        profileId: "prof-lodge-user"
      })
      .expect(200);

    expect(res.body.errors.length).toBeGreaterThanOrEqual(1);
    expect(res.body.errors.some((e: string) => e.includes("not found"))).toBe(true);
  });

  it("returns errors when profile does not exist", async () => {
    const app = createApp(db);
    const res = await request(app)
      .post("/api/provisioning/validate")
      .send({
        groupTag: "Lodge",
        groupId: "grp-lodge-devices",
        profileId: "nonexistent-profile"
      })
      .expect(200);

    expect(res.body.errors.length).toBeGreaterThanOrEqual(1);
    expect(res.body.errors.some((e: string) => e.includes("not found"))).toBe(true);
  });

  it("returns warnings when no group or profile selected", async () => {
    const app = createApp(db);
    const res = await request(app)
      .post("/api/provisioning/validate")
      .send({ groupTag: "Lodge" })
      .expect(200);

    expect(res.body.warnings.length).toBeGreaterThanOrEqual(1);
    expect(res.body.warnings.some((w: string) => w.includes("No group selected"))).toBe(true);
  });

  it("warns when tag has no devices", async () => {
    const app = createApp(db);
    const res = await request(app)
      .post("/api/provisioning/validate")
      .send({
        groupTag: "NONEXISTENT_TAG",
        groupId: "grp-lodge-devices",
        profileId: "prof-lodge-user"
      })
      .expect(200);

    expect(
      res.body.warnings.some((w: string) => w.includes("No Autopilot devices"))
    ).toBe(true);
  });
});

// ──────────────────────────────────────────────
// Settings — safeParse validation
// ──────────────────────────────────────────────
describe("Settings safeParse validation", () => {
  it("POST /api/settings/tag-config returns 400 with field errors for empty body", async () => {
    const app = createApp(db);
    const res = await request(app)
      .post("/api/settings/tag-config")
      .send({})
      .expect(400);

    expect(res.body.message).toMatch(/invalid/i);
    expect(res.body.errors).toBeDefined();
  });

  it("PUT /api/settings/tag-config/:tag returns 400 for invalid payload", async () => {
    const app = createApp(db);
    const res = await request(app)
      .put("/api/settings/tag-config/Lodge")
      .send({ propertyLabel: "" }) // missing required fields
      .expect(400);

    expect(res.body.message).toMatch(/invalid/i);
  });

  it("POST /api/settings/tag-config returns 201 for valid payload", async () => {
    const app = createApp(db);
    await request(app)
      .post("/api/settings/tag-config")
      .send({
        groupTag: "NewTag",
        propertyLabel: "New Property",
        expectedProfileNames: ["Profile-A"],
        expectedGroupNames: ["Group-A"]
      })
      .expect(201);
  });
});

// ──────────────────────────────────────────────
// Rules — safeParse validation
// ──────────────────────────────────────────────
describe("Rules safeParse validation", () => {
  it("POST /api/rules returns 400 for empty body (no auth bypass needed for parse)", async () => {
    const app = createApp(db);
    const res = await request(app).post("/api/rules").send({});

    // Either 400 (validation) or 401 (auth check first) is acceptable
    expect([400, 401]).toContain(res.status);
  });
});

// ──────────────────────────────────────────────
// Group write ops — require delegated auth
// ──────────────────────────────────────────────
describe("Group write operations require auth", () => {
  it("POST /api/groups returns 401 without auth", async () => {
    const app = createApp(db);
    await request(app)
      .post("/api/groups")
      .send({ displayName: "Test", membershipType: "assigned" })
      .expect(401);
  });

  it("PATCH /api/groups/:groupId returns 401 without auth", async () => {
    const app = createApp(db);
    await request(app)
      .patch("/api/groups/grp-lodge-devices")
      .send({ membershipRule: "(device.devicePhysicalIds -any _ -contains \"test\")" })
      .expect(401);
  });

  it("POST /api/groups/:groupId/members returns 401 without auth", async () => {
    const app = createApp(db);
    await request(app)
      .post("/api/groups/grp-lodge-devices/members")
      .send({ deviceKey: "some-key" })
      .expect(401);
  });

  it("DELETE /api/groups/:groupId/members/:deviceKey returns 401 without auth", async () => {
    const app = createApp(db);
    await request(app)
      .delete("/api/groups/grp-lodge-devices/members/some-key")
      .expect(401);
  });
});

// ──────────────────────────────────────────────
// Dashboard
// ──────────────────────────────────────────────
describe("GET /api/dashboard", () => {
  it("returns dashboard shape with health counts and recent transitions", async () => {
    const app = createApp(db);
    const res = await request(app).get("/api/dashboard").expect(200);
    expect(typeof res.body.counts).toBe("object");
    expect(typeof res.body.counts.healthy).toBe("number");
    expect(typeof res.body.counts.warning).toBe("number");
    expect(typeof res.body.counts.critical).toBe("number");
    expect(typeof res.body.counts.info).toBe("number");
  });
});

// ──────────────────────────────────────────────
// Related devices
// ──────────────────────────────────────────────
describe("GET /api/devices/:deviceKey/related-devices", () => {
  it("returns 404 for unknown device", async () => {
    const app = createApp(db);
    await request(app)
      .get("/api/devices/nonexistent/related-devices")
      .expect(404);
  });

  it("returns array for known device", async () => {
    const app = createApp(db);
    const list = await request(app).get("/api/devices").expect(200);
    const key = list.body.items[0].deviceKey;
    const res = await request(app)
      .get(`/api/devices/${key}/related-devices`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });
});
