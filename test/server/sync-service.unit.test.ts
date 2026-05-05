import Database from "better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Force Graph-configured mode so fullSync takes the real-sync path, not the
// mock-seed path. We swap in a deterministic config before the service loads.
vi.mock("../../src/server/config.js", () => ({
  config: {
    AZURE_TENANT_ID: "tenant",
    AZURE_CLIENT_ID: "client",
    AZURE_CLIENT_SECRET: "secret",
    AZURE_REDIRECT_URI: "http://localhost/cb",
    HOST: "127.0.0.1",
    SESSION_SECRET: "x",
    PORT: 3001,
    CLIENT_PORT: 5173,
    DATABASE_PATH: ":memory:",
    SYNC_INTERVAL_MINUTES: 15,
    PROFILE_ASSIGNED_NOT_ENROLLED_HOURS: 2,
    PROVISIONING_STALLED_HOURS: 8,
    SEED_MODE: "mock",
    isGraphConfigured: true,
    isAppAccessRequired: true,
    APP_ACCESS_MODE: "entra",
    APP_ACCESS_ALLOWED_USERS: "",
    RUNWAY_DESKTOP_TOKEN: undefined,
    appAccessAllowedUsers: [],
    isDevOrTest: true,
    graphMissing: []
  }
}));

// Stub the Graph client so no auth / network happens.
vi.mock("../../src/server/sync/graph-client.js", () => ({
  GraphClient: class {}
}));

// Per-module sync stubs — default happy-path; individual tests override.
const autopilotMock = vi.fn();
const intuneMock = vi.fn();
const entraMock = vi.fn();
const groupMock = vi.fn();
const profileMock = vi.fn();
const complianceMock = vi.fn();
const configProfileMock = vi.fn();
const appMock = vi.fn();
const caMock = vi.fn();

vi.mock("../../src/server/sync/autopilot-sync.js", () => ({
  syncAutopilotDevices: autopilotMock
}));
vi.mock("../../src/server/sync/intune-sync.js", () => ({
  syncIntuneDevices: intuneMock
}));
vi.mock("../../src/server/sync/entra-sync.js", () => ({
  syncEntraDevices: entraMock
}));
vi.mock("../../src/server/sync/group-sync.js", () => ({
  syncGroups: groupMock
}));
vi.mock("../../src/server/sync/profile-sync.js", () => ({
  syncProfiles: profileMock
}));
vi.mock("../../src/server/sync/compliance-sync.js", () => ({
  syncCompliancePolicies: complianceMock
}));
vi.mock("../../src/server/sync/config-profile-sync.js", () => ({
  syncConfigProfiles: configProfileMock
}));
vi.mock("../../src/server/sync/app-sync.js", () => ({
  syncAppAssignments: appMock
}));
vi.mock("../../src/server/sync/conditional-access-sync.js", () => ({
  syncConditionalAccessPolicies: caMock
}));

// Persist + compute are exercised with real DB; keep them real so the sync
// log / device_state tables update as they would in production.
const { fullSync, getSyncState } = await import("../../src/server/sync/sync-service.js");
const { runMigrations } = await import("../../src/server/db/migrate.js");
const { getSyncStatus, listSyncLogs } = await import("../../src/server/db/queries/sync.js");

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  runMigrations(db);

  // Default: every sync returns an empty but valid payload.
  autopilotMock.mockReset().mockResolvedValue([]);
  intuneMock.mockReset().mockResolvedValue([]);
  entraMock.mockReset().mockResolvedValue([]);
  groupMock.mockReset().mockResolvedValue({ groups: [], memberships: [] });
  profileMock.mockReset().mockResolvedValue({ profiles: [], assignments: [] });
  complianceMock.mockReset().mockResolvedValue({
    policies: [],
    deviceStates: [],
    graphAssignments: []
  });
  configProfileMock.mockReset().mockResolvedValue({
    profiles: [],
    deviceStates: [],
    graphAssignments: []
  });
  appMock.mockReset().mockResolvedValue({
    apps: [],
    deviceStates: [],
    graphAssignments: []
  });
  caMock.mockReset().mockResolvedValue({ policies: [] });

  // Reset the module-level sync state between tests (it leaks otherwise).
  const state = getSyncState();
  state.inProgress = false;
  state.currentSyncType = null;
  state.startedAt = null;
  state.lastError = null;
});

describe("fullSync — partial failure handling", () => {
  it("logs a warning when Intune sync fails and continues with remaining steps", async () => {
    intuneMock.mockRejectedValue(new Error("Intune Graph 503"));

    await fullSync(db, "manual", "mock-token");

    const logs = listSyncLogs(db);
    expect(logs.length).toBe(1);
    expect(logs[0]!.errors).toContain("Intune device sync failed.");
    expect(logs[0]!.devicesSynced).toBe(0);
    expect(logs[0]!.completedAt).not.toBeNull();

    // Core steps ran despite the Intune failure.
    expect(autopilotMock).toHaveBeenCalled();
    expect(intuneMock).toHaveBeenCalled();
    expect(entraMock).toHaveBeenCalled();
    expect(groupMock).toHaveBeenCalled();
    expect(profileMock).toHaveBeenCalled();
    expect(caMock).not.toHaveBeenCalled();
    expect(complianceMock).not.toHaveBeenCalled();
    expect(configProfileMock).not.toHaveBeenCalled();
    expect(appMock).not.toHaveBeenCalled();

    // No lastError because the sync completed (with warnings).
    expect(getSyncState().lastError).toBeNull();
  });

  it("preserves previously synced source rows when a later step fails", async () => {
    autopilotMock.mockResolvedValueOnce([
      {
        id: "ap-1",
        serial_number: "SN-1",
        model: null,
        manufacturer: null,
        group_tag: "North",
        assigned_user_upn: null,
        deployment_profile_id: "prof-1",
        deployment_profile_name: "North-UD",
        profile_assignment_status: "assigned",
        deployment_mode: null,
        entra_device_id: "aad-1",
        first_seen_at: "2026-04-01T00:00:00.000Z",
        first_profile_assigned_at: "2026-04-01T00:00:00.000Z",
        last_synced_at: "2026-04-01T00:00:00.000Z",
        raw_json: "{}"
      }
    ]);

    await fullSync(db, "manual", "mock-token");

    autopilotMock.mockRejectedValueOnce(new Error("Autopilot 500"));
    await fullSync(db, "manual", "mock-token");

    const autopilotRows = db
      .prepare("SELECT id, group_tag, deployment_profile_name FROM autopilot_devices")
      .all() as Array<{
      id: string;
      group_tag: string | null;
      deployment_profile_name: string | null;
    }>;
    expect(autopilotRows).toEqual([
      {
        id: "ap-1",
        group_tag: "North",
        deployment_profile_name: "North-UD"
      }
    ]);

    const logs = listSyncLogs(db);
    expect(logs.some((log) => log.errors.includes("Autopilot device sync failed."))).toBe(true);
  });

  it("resets inProgress state after completing even when steps fail", async () => {
    entraMock.mockRejectedValue(new Error("Entra failed"));

    await fullSync(db, "manual", "mock-token");

    const state = getSyncState();
    expect(state.inProgress).toBe(false);
    expect(state.currentSyncType).toBeNull();
    expect(state.startedAt).toBeNull();
    // lastError is not set for per-step failures — only for fatal errors.
    expect(state.lastError).toBeNull();
  });

  it("continues the full sync when conditional-access fails (best-effort)", async () => {
    db.prepare(
      `INSERT INTO conditional_access_policies (
        id, display_name, state, conditions_json, grant_controls_json, session_controls_json, last_synced_at, raw_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      "ca-existing",
      "Require MFA",
      "enabled",
      "{}",
      "{}",
      "{}",
      "2026-04-01T00:00:00.000Z",
      "{}"
    );
    caMock.mockRejectedValue(new Error("CA 403"));

    await fullSync(db, "full", "mock-token");

    const logs = listSyncLogs(db);
    expect(logs.length).toBe(1);
    expect(logs[0]!.errors).toEqual([]);
    expect(logs[0]!.completedAt).not.toBeNull();
    expect(getSyncState().lastError).toBeNull();
    const remaining = db
      .prepare("SELECT id FROM conditional_access_policies")
      .all() as Array<{ id: string }>;
    expect(remaining).toEqual([{ id: "ca-existing" }]);
  });

  it("treats compliance sync failure as best-effort enrichment and continues", async () => {
    complianceMock.mockRejectedValue(new Error("Compliance 500"));

    await fullSync(db, "full", "mock-token");

    const logs = listSyncLogs(db);
    expect(logs[0]!.errors).toEqual([]);

    // All steps ran despite the compliance failure.
    expect(autopilotMock).toHaveBeenCalled();
    expect(intuneMock).toHaveBeenCalled();
    expect(entraMock).toHaveBeenCalled();
    expect(groupMock).toHaveBeenCalled();
    expect(profileMock).toHaveBeenCalled();
    expect(caMock).toHaveBeenCalled();
    expect(complianceMock).toHaveBeenCalled();
    expect(configProfileMock).toHaveBeenCalled();
    expect(appMock).toHaveBeenCalled();
  });

  it("treats config and app assignment failures as best-effort enrichment during full sync", async () => {
    configProfileMock.mockRejectedValue(new Error("Config 403"));
    appMock.mockRejectedValue(new Error("Apps 403"));

    await fullSync(db, "full", "mock-token");

    const logs = listSyncLogs(db);
    expect(logs[0]!.errors).toEqual([]);
    expect(logs[0]!.completedAt).not.toBeNull();
    expect(getSyncState().lastError).toBeNull();
  });

  it("clears displayed lastError after a later successful sync", async () => {
    intuneMock.mockRejectedValueOnce(new Error("Intune Graph 503"));

    await fullSync(db, "manual", "mock-token");
    expect(getSyncStatus(db, getSyncState()).lastError).toBe("Intune device sync failed.");

    await fullSync(db, "manual", "mock-token");
    expect(getSyncStatus(db, getSyncState()).lastError).toBeNull();
  });

  it("refuses to start a second sync while one is already in progress", async () => {
    // Make one sync hang so we can test the lock behavior.
    let releaseFirst!: () => void;
    entraMock.mockReturnValue(
      new Promise((resolve) => {
        releaseFirst = () => resolve([]);
      })
    );

    const firstRun = fullSync(db, "full", "mock-token");
    await expect(fullSync(db, "manual", "mock-token")).rejects.toThrow(/already in progress/);

    releaseFirst();
    await firstRun;
  });

  it("replaces graph assignment rows so removed Intune assignments do not linger", async () => {
    appMock
      .mockResolvedValueOnce({
        apps: [],
        deviceStates: [],
        graphAssignments: [
          {
            payload_kind: "app",
            payload_id: "app-chrome",
            payload_name: "Google Chrome Enterprise",
            group_id: "group-kiosk",
            intent: "required",
            target_type: "include",
            raw_json: "{}",
            synced_at: "2026-04-29T10:00:00.000Z"
          },
          {
            payload_kind: "app",
            payload_id: "app-reader",
            payload_name: "Adobe Acrobat Reader",
            group_id: "group-kiosk",
            intent: "required",
            target_type: "include",
            raw_json: "{}",
            synced_at: "2026-04-29T10:00:00.000Z"
          }
        ]
      })
      .mockResolvedValueOnce({
        apps: [],
        deviceStates: [],
        graphAssignments: [
          {
            payload_kind: "app",
            payload_id: "app-chrome",
            payload_name: "Google Chrome Enterprise",
            group_id: "group-kiosk",
            intent: "required",
            target_type: "include",
            raw_json: "{}",
            synced_at: "2026-04-29T10:15:00.000Z"
          }
        ]
      });

    await fullSync(db, "full", "mock-token");
    await fullSync(db, "full", "mock-token");

    const rows = db
      .prepare(
        `SELECT payload_kind, payload_id, group_id
         FROM graph_assignments
         ORDER BY payload_id`
      )
      .all() as Array<{
      payload_kind: string;
      payload_id: string;
      group_id: string;
    }>;

    expect(rows).toEqual([
      {
        payload_kind: "app",
        payload_id: "app-chrome",
        group_id: "group-kiosk"
      }
    ]);
  });

  it("skips optional enrichment during manual sync so core inventory completes quickly", async () => {
    await fullSync(db, "manual", "mock-token");

    expect(autopilotMock).toHaveBeenCalled();
    expect(intuneMock).toHaveBeenCalled();
    expect(entraMock).toHaveBeenCalled();
    expect(profileMock).toHaveBeenCalled();
    expect(groupMock).toHaveBeenCalled();
    expect(caMock).not.toHaveBeenCalled();
    expect(complianceMock).not.toHaveBeenCalled();
    expect(configProfileMock).not.toHaveBeenCalled();
    expect(appMock).not.toHaveBeenCalled();
  });
});
