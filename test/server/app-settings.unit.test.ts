import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runMigrations } from "../../src/server/db/migrate.js";
import {
  getEffectiveAppSetting,
  listEffectiveAppSettings,
  resetAppSettings,
  setAppSetting
} from "../../src/server/settings/app-settings.js";

const APP_SETTING_ENV_VARS = [
  "SYNC_INTERVAL_MINUTES",
  "PROFILE_ASSIGNED_NOT_ENROLLED_HOURS",
  "PROVISIONING_STALLED_HOURS",
  "HISTORY_RETENTION_DAYS",
  "ACTION_LOG_RETENTION_DAYS",
  "SYNC_LOG_RETENTION_DAYS",
  "RETENTION_INTERVAL_HOURS",
  "SEED_MODE"
];

describe("app settings service", () => {
  let db: Database.Database;
  let envBackup: NodeJS.ProcessEnv;

  beforeEach(() => {
    envBackup = { ...process.env };
    for (const key of APP_SETTING_ENV_VARS) {
      delete process.env[key];
    }
    db = new Database(":memory:");
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
    process.env = envBackup;
  });

  it("resolves code defaults without storing rows", () => {
    const settings = listEffectiveAppSettings(db);
    const syncInterval = settings.find((setting) => setting.key === "sync.intervalMinutes");

    expect(syncInterval).toMatchObject({
      value: 15,
      defaultValue: 15,
      source: "default"
    });
    expect(settings.find((setting) => setting.key === "sync.onLaunch")).toMatchObject({
      value: true,
      source: "default"
    });
    expect(settings.find((setting) => setting.key === "sync.manualOnly")).toMatchObject({
      value: false,
      source: "default"
    });
    expect(settings.find((setting) => setting.key === "sync.paused")).toMatchObject({
      value: false,
      source: "default"
    });
    expect((db.prepare("SELECT COUNT(*) as count FROM app_settings").get() as { count: number }).count).toBe(0);
  });

  it.each([
    ["SYNC_INTERVAL_MINUTES", "sync.intervalMinutes", "30", 5],
    ["PROFILE_ASSIGNED_NOT_ENROLLED_HOURS", "rules.profileAssignedNotEnrolledHours", "4", 6],
    ["PROVISIONING_STALLED_HOURS", "rules.provisioningStalledHours", "10", 12],
    ["HISTORY_RETENTION_DAYS", "retention.deviceHistoryDays", "120", 60],
    ["ACTION_LOG_RETENTION_DAYS", "retention.actionLogDays", "365", 90],
    ["SYNC_LOG_RETENTION_DAYS", "retention.syncLogDays", "45", 15],
    ["RETENTION_INTERVAL_HOURS", "retention.sweepIntervalHours", "12", 36],
    ["SEED_MODE", "developer.seedMode", "none", "mock"]
  ] as const)("uses %s only when no database value is set", (envVar, settingKey, envValue, dbValue) => {
    process.env[envVar] = envValue;

    const envSetting = getEffectiveAppSetting(db, settingKey);
    expect(envSetting).toMatchObject({
      value: envValue === "none" ? "none" : Number(envValue),
      source: "env"
    });

    const updated = setAppSetting(db, settingKey, dbValue);
    expect(updated).toMatchObject({
      value: dbValue,
      source: "db"
    });
  });

  it("stores a code-default value when needed to override env", () => {
    process.env.SYNC_INTERVAL_MINUTES = "30";

    const updated = setAppSetting(db, "sync.intervalMinutes", 15);
    const count = (db.prepare("SELECT COUNT(*) as count FROM app_settings").get() as { count: number }).count;

    expect(updated).toMatchObject({
      value: 15,
      source: "db"
    });
    expect(count).toBe(1);
  });

  it("deletes rows when reset to defaults is requested", () => {
    setAppSetting(db, "retention.deviceHistoryDays", 120);
    resetAppSettings(db);

    expect(getEffectiveAppSetting(db, "retention.deviceHistoryDays")).toMatchObject({
      value: 90,
      source: "default"
    });
    expect((db.prepare("SELECT COUNT(*) as count FROM app_settings").get() as { count: number }).count).toBe(0);
  });

  it("resets only app_settings rows", () => {
    setAppSetting(db, "retention.deviceHistoryDays", 120);
    db.prepare(
      "INSERT INTO autopilot_devices (id, serial_number, last_synced_at) VALUES (?, ?, ?)"
    ).run("ap-reset-survivor", "SERIAL-RESET", "2026-04-29T12:00:00.000Z");
    db.prepare(
      "INSERT INTO device_state_history (device_key, serial_number, computed_at, overall_health, active_flags) VALUES (?, ?, ?, ?, ?)"
    ).run("device-reset-survivor", "SERIAL-RESET", "2026-04-29T12:00:00.000Z", "healthy", "[]");
    db.prepare(
      "INSERT INTO action_log (device_serial, device_name, action_type, triggered_by, triggered_at, graph_response_status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run("SERIAL-RESET", "RESET-DEVICE", "sync", "admin@example.test", "2026-04-29T12:00:00.000Z", 202, "survive reset");
    db.prepare(
      "INSERT INTO sync_log (sync_type, started_at, completed_at, devices_synced, errors) VALUES (?, ?, ?, ?, ?)"
    ).run("manual", "2026-04-29T12:00:00.000Z", "2026-04-29T12:00:01.000Z", 7, "[]");

    resetAppSettings(db);

    expect((db.prepare("SELECT COUNT(*) as count FROM app_settings").get() as { count: number }).count).toBe(0);
    expect((db.prepare("SELECT COUNT(*) as count FROM autopilot_devices").get() as { count: number }).count).toBe(1);
    expect((db.prepare("SELECT COUNT(*) as count FROM device_state_history").get() as { count: number }).count).toBe(1);
    expect((db.prepare("SELECT COUNT(*) as count FROM action_log").get() as { count: number }).count).toBe(1);
    expect((db.prepare("SELECT COUNT(*) as count FROM sync_log").get() as { count: number }).count).toBe(1);
  });

  it("rejects invalid values before writing", () => {
    expect(() => setAppSetting(db, "sync.intervalMinutes", 10)).toThrow(
      "Sync interval must be one of: 5, 15, 30, 60."
    );
    expect(() => setAppSetting(db, "retention.actionLogDays", -1)).toThrow(
      "Action log retention must be at least 0."
    );
    expect((db.prepare("SELECT COUNT(*) as count FROM app_settings").get() as { count: number }).count).toBe(0);
  });
});
