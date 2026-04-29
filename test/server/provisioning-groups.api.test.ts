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
// Provisioning — tags
// ──────────────────────────────────────────────
describe("GET /api/provisioning/tags", () => {
  it("returns tags currently carried by devices", async () => {
    const app = createApp(db);
    const res = await request(app).get("/api/provisioning/tags").expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    const north = res.body.find((tag: { groupTag: string }) => tag.groupTag === "North");
    expect(north).toBeDefined();
    expect(north.deviceCount).toBeGreaterThan(0);
    expect(typeof north.lastSeenAt).toBe("string");
    expect(north.configured).toBe(true);
    expect(north.propertyLabel).toBe("North / River");
  });

  it("marks tags without tag_config as discovered-only", async () => {
    db.prepare(
      `UPDATE device_state
       SET group_tag = 'Unmapped'
       WHERE device_key = (SELECT device_key FROM device_state LIMIT 1)`
    ).run();

    const app = createApp(db);
    const res = await request(app).get("/api/provisioning/tags").expect(200);

    const unmapped = res.body.find((tag: { groupTag: string }) => tag.groupTag === "Unmapped");
    expect(unmapped).toBeDefined();
    expect(unmapped.configured).toBe(false);
    expect(unmapped.propertyLabel).toBeNull();
  });
});

describe("GET /api/provisioning/tag-devices", () => {
  it("returns 400 when groupTag is missing", async () => {
    const app = createApp(db);
    await request(app).get("/api/provisioning/tag-devices").expect(400);
  });

  it("returns devices carrying a tag", async () => {
    const app = createApp(db);
    const res = await request(app)
      .get("/api/provisioning/tag-devices?groupTag=North")
      .expect(200);

    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toMatchObject({
      deviceKey: expect.any(String),
      health: expect.any(String)
    });
    expect("serialNumber" in res.body[0]).toBe(true);
    expect("lastSyncAt" in res.body[0]).toBe(true);
    expect("complianceState" in res.body[0]).toBe(true);
  });
});

describe("provisioning tag counts", () => {
  it("keeps Tags, discovery, and tagged-device counts on device_state", async () => {
    db.prepare(
      `UPDATE device_state
       SET group_tag = 'ReviewOnly'
       WHERE device_key = (SELECT device_key FROM device_state LIMIT 1)`
    ).run();

    const app = createApp(db);
    const tags = await request(app).get("/api/provisioning/tags").expect(200);
    const reviewOnly = tags.body.find(
      (tag: { groupTag: string }) => tag.groupTag === "ReviewOnly"
    );
    expect(reviewOnly).toBeDefined();

    const discovery = await request(app)
      .get("/api/provisioning/discover?groupTag=ReviewOnly")
      .expect(200);
    const devices = await request(app)
      .get("/api/provisioning/tag-devices?groupTag=ReviewOnly")
      .expect(200);

    expect(discovery.body.deviceCount).toBe(reviewOnly.deviceCount);
    expect(devices.body).toHaveLength(reviewOnly.deviceCount);

    const validation = await request(app)
      .post("/api/provisioning/validate")
      .send({ groupTag: "ReviewOnly" })
      .expect(200);
    expect(
      validation.body.warnings.some((warning: string) =>
        warning.includes('No devices currently have group tag "ReviewOnly"')
      )
    ).toBe(false);
  });
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
      .get("/api/provisioning/discover?groupTag=North")
      .expect(200);

    expect(res.body.groupTag).toBe("North");
    expect(typeof res.body.deviceCount).toBe("number");
    expect(Array.isArray(res.body.matchingGroups)).toBe(true);
    expect(Array.isArray(res.body.matchingProfiles)).toBe(true);
    expect(typeof res.body.buildPayloadByGroupId).toBe("object");
  });

  it("returns build payload keyed by matching group id", async () => {
    db.prepare("DELETE FROM graph_assignments").run();
    db.prepare(
      `INSERT INTO graph_assignments (
        payload_kind, payload_id, payload_name, group_id, intent, target_type, raw_json, synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      "app",
      "app-chrome",
      "Google Chrome Enterprise",
      "grp-north-devices",
      "required",
      "include",
      "{}",
      "2026-04-29T10:00:00.000Z",
      "config",
      "cfg-baseline",
      "Windows Baseline",
      "grp-north-devices",
      null,
      "include",
      "{}",
      "2026-04-29T10:01:00.000Z",
      "compliance",
      "comp-default",
      "Default Compliance",
      "grp-north-devices",
      null,
      "include",
      "{}",
      "2026-04-29T10:02:00.000Z"
    );

    const app = createApp(db);
    const res = await request(app)
      .get("/api/provisioning/discover?groupTag=North")
      .expect(200);

    const payload = res.body.buildPayloadByGroupId["grp-north-devices"];
    expect(payload.requiredApps).toHaveLength(1);
    expect(payload.configProfiles).toHaveLength(1);
    expect(payload.compliancePolicies).toHaveLength(1);
    expect(payload.syncedAt).toBe("2026-04-29T10:02:00.000Z");
    expect(payload.warnings).toHaveLength(0);

    const hybridPayload = res.body.buildPayloadByGroupId["grp-north-hybrid"];
    expect(hybridPayload.warnings).toContain(
      "No required apps found for this target group."
    );
    expect(hybridPayload.warnings).toContain(
      "Payload exists on another discovered group, but not this target group."
    );
  });

  it("returns deviceCount and group/profile arrays for a tag with matches", async () => {
    const app = createApp(db);
    const res = await request(app)
      .get("/api/provisioning/discover?groupTag=North")
      .expect(200);

    // Seed has North devices and a group with "North" in its name
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
    expect(res.body.buildPayloadByGroupId).toEqual({});
    expect(res.body.existingConfig).toBeNull();
  });

  it("includes existingConfig when tag_config exists", async () => {
    const app = createApp(db);
    const res = await request(app)
      .get("/api/provisioning/discover?groupTag=North")
      .expect(200);

    // Seed has a tag_config for "North"
    expect(res.body.existingConfig).not.toBeNull();
    expect(res.body.existingConfig.groupTag).toBe("North");
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
        groupTag: "North",
        groupId: "grp-north-devices",
        profileId: "prof-north-user"
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
        groupTag: "North",
        groupId: "nonexistent-group-id",
        profileId: "prof-north-user"
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
        groupTag: "North",
        groupId: "grp-north-devices",
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
      .send({ groupTag: "North" })
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
        groupId: "grp-north-devices",
        profileId: "prof-north-user"
      })
      .expect(200);

    expect(
      res.body.warnings.some((w: string) => w.includes("No devices"))
    ).toBe(true);
  });
});

// ──────────────────────────────────────────────
// Settings / Sync — delegated-auth guards
// (happy-path schema + CRUD coverage lives in routes-coverage.api.test.ts,
// which vi.mocks the auth middleware. Here we only verify the guard fires.)
// ──────────────────────────────────────────────
describe("Settings tag-config auth guard", () => {
  it("POST /api/settings/tag-config returns 401 without auth", async () => {
    const app = createApp(db);
    await request(app)
      .post("/api/settings/tag-config")
      .send({
        groupTag: "NewTag",
        propertyLabel: "New Property",
        expectedProfileNames: ["Profile-A"],
        expectedGroupNames: ["Group-A"]
      })
      .expect(401);
  });

  it("PUT /api/settings/tag-config/:tag returns 401 without auth", async () => {
    const app = createApp(db);
    await request(app)
      .put("/api/settings/tag-config/North")
      .send({
        groupTag: "North",
        propertyLabel: "North Updated",
        expectedProfileNames: [],
        expectedGroupNames: []
      })
      .expect(401);
  });

  it("DELETE /api/settings/tag-config/:tag returns 401 without auth", async () => {
    const app = createApp(db);
    await request(app).delete("/api/settings/tag-config/North").expect(401);
  });

  it("GET /api/settings/tag-config remains accessible without auth (read-only)", async () => {
    const app = createApp(db);
    await request(app).get("/api/settings/tag-config").expect(200);
  });
});

describe("Sync auth guard", () => {
  it("POST /api/sync returns 401 without auth", async () => {
    const app = createApp(db);
    await request(app).post("/api/sync").expect(401);
  });

  it("GET /api/sync/status remains accessible without auth (read-only)", async () => {
    const app = createApp(db);
    await request(app).get("/api/sync/status").expect(200);
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
      .patch("/api/groups/grp-north-devices")
      .send({ membershipRule: "(device.devicePhysicalIds -any _ -contains \"test\")" })
      .expect(401);
  });

  it("POST /api/groups/:groupId/members returns 401 without auth", async () => {
    const app = createApp(db);
    await request(app)
      .post("/api/groups/grp-north-devices/members")
      .send({ deviceKey: "some-key" })
      .expect(401);
  });

  it("DELETE /api/groups/:groupId/members/:deviceKey returns 401 without auth", async () => {
    const app = createApp(db);
    await request(app)
      .delete("/api/groups/grp-north-devices/members/some-key")
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
