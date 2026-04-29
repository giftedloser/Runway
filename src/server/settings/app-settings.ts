import type Database from "better-sqlite3";

import { logger } from "../logger.js";

export type AppSettingValueType = "string" | "number" | "boolean" | "json";
export type AppSettingSource = "db" | "env" | "default";
export type AppSettingPrimitive = string | number | boolean;

const envWarningKeys = new Set<string>();

interface AppSettingDefinition {
  key: string;
  section: "sync-data" | "rules-thresholds" | "developer";
  label: string;
  description: string;
  valueType: Exclude<AppSettingValueType, "json">;
  defaultValue: AppSettingPrimitive;
  envVar?: string;
  allowedValues?: readonly AppSettingPrimitive[];
  min?: number;
  max?: number;
  integer?: boolean;
}

export const APP_SETTING_DEFINITIONS = [
  {
    key: "sync.intervalMinutes",
    section: "sync-data",
    label: "Sync interval",
    description: "How often Runway pulls fresh device and assignment data from Microsoft Graph.",
    valueType: "number",
    defaultValue: 15,
    envVar: "SYNC_INTERVAL_MINUTES",
    allowedValues: [5, 15, 30, 60]
  },
  {
    key: "sync.onLaunch",
    section: "sync-data",
    label: "Sync on app launch",
    description: "Triggers a sync shortly after Runway starts when Graph is configured.",
    valueType: "boolean",
    defaultValue: true
  },
  {
    key: "sync.manualOnly",
    section: "sync-data",
    label: "Manual sync only",
    description: "Disables scheduled background sync while keeping manual sync available.",
    valueType: "boolean",
    defaultValue: false
  },
  {
    key: "sync.paused",
    section: "sync-data",
    label: "Pause sync",
    description: "Emergency stop for launch and scheduled background sync until re-enabled.",
    valueType: "boolean",
    defaultValue: false
  },
  {
    key: "rules.profileAssignedNotEnrolledHours",
    section: "rules-thresholds",
    label: "Profile assigned but not enrolled",
    description: "Hours after profile assignment before an unenrolled Autopilot device is flagged.",
    valueType: "number",
    defaultValue: 2,
    envVar: "PROFILE_ASSIGNED_NOT_ENROLLED_HOURS",
    min: 0,
    max: 168
  },
  {
    key: "rules.provisioningStalledHours",
    section: "rules-thresholds",
    label: "Provisioning stalled",
    description: "Hours since last Intune check-in before an incomplete or unhealthy device is flagged.",
    valueType: "number",
    defaultValue: 8,
    envVar: "PROVISIONING_STALLED_HOURS",
    min: 0,
    max: 168
  },
  {
    key: "retention.deviceHistoryDays",
    section: "sync-data",
    label: "Device history retention",
    description: "Days of device health history to keep before retention sweeps prune older rows.",
    valueType: "number",
    defaultValue: 90,
    envVar: "HISTORY_RETENTION_DAYS",
    min: 0,
    max: 3650,
    integer: true
  },
  {
    key: "retention.actionLogDays",
    section: "sync-data",
    label: "Action log retention",
    description: "Days of remote action audit entries to retain.",
    valueType: "number",
    defaultValue: 180,
    envVar: "ACTION_LOG_RETENTION_DAYS",
    min: 0,
    max: 3650,
    integer: true
  },
  {
    key: "retention.syncLogDays",
    section: "sync-data",
    label: "Sync log retention",
    description: "Days of sync run history to retain.",
    valueType: "number",
    defaultValue: 30,
    envVar: "SYNC_LOG_RETENTION_DAYS",
    min: 0,
    max: 3650,
    integer: true
  },
  {
    key: "retention.sweepIntervalHours",
    section: "sync-data",
    label: "Retention sweep interval",
    description: "Hours between background retention sweeps.",
    valueType: "number",
    defaultValue: 24,
    envVar: "RETENTION_INTERVAL_HOURS",
    min: 0.5,
    max: 168
  },
  {
    key: "developer.seedMode",
    section: "developer",
    label: "Seed mode",
    description: "Controls whether mock data is seeded when Graph is not configured.",
    valueType: "string",
    defaultValue: "mock",
    envVar: "SEED_MODE",
    allowedValues: ["mock", "none"]
  }
] as const satisfies readonly AppSettingDefinition[];

export type AppSettingKey = (typeof APP_SETTING_DEFINITIONS)[number]["key"];

export interface EffectiveAppSetting {
  key: AppSettingKey;
  section: AppSettingDefinition["section"];
  label: string;
  description: string;
  value: AppSettingPrimitive;
  defaultValue: AppSettingPrimitive;
  valueType: Exclude<AppSettingValueType, "json">;
  source: AppSettingSource;
  envVar: string | null;
  updatedAt: string | null;
  restartRequired: boolean;
}

export interface AppSettingValues {
  syncIntervalMinutes: number;
  syncOnLaunch: boolean;
  syncManualOnly: boolean;
  syncPaused: boolean;
  profileAssignedNotEnrolledHours: number;
  provisioningStalledHours: number;
  deviceHistoryRetentionDays: number;
  actionLogRetentionDays: number;
  syncLogRetentionDays: number;
  retentionSweepIntervalHours: number;
  seedMode: "mock" | "none";
}

interface AppSettingsRow {
  key: string;
  value: string;
  value_type: string;
  updated_at: string;
}

const definitionsByKey: Map<string, AppSettingDefinition> = new Map(
  APP_SETTING_DEFINITIONS.map((definition) => [definition.key, definition])
);

export function isAppSettingKey(key: string): key is AppSettingKey {
  return definitionsByKey.has(key);
}

function getDefinition(key: AppSettingKey): AppSettingDefinition {
  const definition = definitionsByKey.get(key);
  if (!definition) {
    throw new Error(`Unknown app setting "${key}".`);
  }
  return definition;
}

function parseValue(
  definition: AppSettingDefinition,
  rawValue: unknown
): { value: AppSettingPrimitive; error: string | null } {
  let value: AppSettingPrimitive;

  if (definition.valueType === "number") {
    const numeric = typeof rawValue === "number" ? rawValue : Number(rawValue);
    if (!Number.isFinite(numeric)) {
      return { value: definition.defaultValue, error: `${definition.label} must be a number.` };
    }
    value = numeric;
  } else if (definition.valueType === "boolean") {
    if (typeof rawValue === "boolean") {
      value = rawValue;
    } else if (rawValue === "true" || rawValue === "1") {
      value = true;
    } else if (rawValue === "false" || rawValue === "0") {
      value = false;
    } else {
      return { value: definition.defaultValue, error: `${definition.label} must be true or false.` };
    }
  } else {
    value = String(rawValue);
  }

  if (definition.integer && typeof value === "number" && !Number.isInteger(value)) {
    return { value, error: `${definition.label} must be a whole number.` };
  }
  if (typeof value === "number" && definition.min !== undefined && value < definition.min) {
    return { value, error: `${definition.label} must be at least ${definition.min}.` };
  }
  if (typeof value === "number" && definition.max !== undefined && value > definition.max) {
    return { value, error: `${definition.label} must be at most ${definition.max}.` };
  }
  if (
    definition.allowedValues &&
    !definition.allowedValues.some((allowedValue) => allowedValue === value)
  ) {
    return {
      value,
      error: `${definition.label} must be one of: ${definition.allowedValues.join(", ")}.`
    };
  }

  return { value, error: null };
}

function parseStoredValue(definition: AppSettingDefinition, row: AppSettingsRow) {
  if (row.value_type !== definition.valueType) {
    logger.warn(
      { key: definition.key, valueType: row.value_type, expectedValueType: definition.valueType },
      "Ignoring app setting with mismatched value_type"
    );
    return null;
  }
  const parsed = parseValue(definition, row.value);
  if (parsed.error) {
    logger.warn({ key: definition.key, error: parsed.error }, "Ignoring invalid app setting row");
    return null;
  }
  return parsed.value;
}

function getEnvValue(definition: AppSettingDefinition) {
  if (!definition.envVar) return null;
  const rawValue = process.env[definition.envVar];
  if (rawValue === undefined || rawValue === "") return null;
  if (!envWarningKeys.has(definition.envVar)) {
    envWarningKeys.add(definition.envVar);
    logger.warn(
      { envVar: definition.envVar, settingKey: definition.key },
      "Legacy environment override is set for an app setting; Settings UI values take precedence."
    );
  }
  const parsed = parseValue(definition, rawValue);
  if (parsed.error) {
    logger.warn(
      { envVar: definition.envVar, settingKey: definition.key, error: parsed.error },
      "Ignoring invalid environment override for app setting"
    );
    return null;
  }
  return parsed.value;
}

function stringifyValue(value: AppSettingPrimitive) {
  return typeof value === "string" ? value : String(value);
}

function readAppSettingRows(db: Database.Database) {
  return new Map(
    (
      db.prepare("SELECT key, value, value_type, updated_at FROM app_settings").all() as AppSettingsRow[]
    ).map((row) => [row.key, row])
  );
}

function resolveSetting(
  definition: AppSettingDefinition,
  row: AppSettingsRow | undefined
): EffectiveAppSetting {
  if (row) {
    const dbValue = parseStoredValue(definition, row);
    if (dbValue !== null) {
      return {
        key: definition.key as AppSettingKey,
        section: definition.section,
        label: definition.label,
        description: definition.description,
        value: dbValue,
        defaultValue: definition.defaultValue,
        valueType: definition.valueType,
        source: "db",
        envVar: definition.envVar ?? null,
        updatedAt: row.updated_at,
        restartRequired: false
      };
    }
  }

  const envValue = getEnvValue(definition);
  return {
    key: definition.key as AppSettingKey,
    section: definition.section,
    label: definition.label,
    description: definition.description,
    value: envValue ?? definition.defaultValue,
    defaultValue: definition.defaultValue,
    valueType: definition.valueType,
    source: envValue === null ? "default" : "env",
    envVar: definition.envVar ?? null,
    updatedAt: null,
    restartRequired: false
  };
}

export function listEffectiveAppSettings(db: Database.Database): EffectiveAppSetting[] {
  const rows = readAppSettingRows(db);
  return APP_SETTING_DEFINITIONS.map((definition) =>
    resolveSetting(definition, rows.get(definition.key))
  );
}

export function getEffectiveAppSetting(
  db: Database.Database,
  key: AppSettingKey
): EffectiveAppSetting {
  const rows = readAppSettingRows(db);
  return resolveSetting(getDefinition(key), rows.get(key));
}

export function getAppSettingValues(db: Database.Database): AppSettingValues {
  const settings = new Map(listEffectiveAppSettings(db).map((setting) => [setting.key, setting.value]));
  return {
    syncIntervalMinutes: settings.get("sync.intervalMinutes") as number,
    syncOnLaunch: settings.get("sync.onLaunch") as boolean,
    syncManualOnly: settings.get("sync.manualOnly") as boolean,
    syncPaused: settings.get("sync.paused") as boolean,
    profileAssignedNotEnrolledHours: settings.get("rules.profileAssignedNotEnrolledHours") as number,
    provisioningStalledHours: settings.get("rules.provisioningStalledHours") as number,
    deviceHistoryRetentionDays: settings.get("retention.deviceHistoryDays") as number,
    actionLogRetentionDays: settings.get("retention.actionLogDays") as number,
    syncLogRetentionDays: settings.get("retention.syncLogDays") as number,
    retentionSweepIntervalHours: settings.get("retention.sweepIntervalHours") as number,
    seedMode: settings.get("developer.seedMode") as "mock" | "none"
  };
}

export function setAppSetting(
  db: Database.Database,
  key: AppSettingKey,
  rawValue: unknown
): EffectiveAppSetting {
  const definition = getDefinition(key);
  const parsed = parseValue(definition, rawValue);
  if (parsed.error) {
    throw new Error(parsed.error);
  }

  const envValue = getEnvValue(definition);
  const shouldDelete =
    parsed.value === definition.defaultValue &&
    (envValue === null || envValue === definition.defaultValue);

  if (shouldDelete) {
    db.prepare("DELETE FROM app_settings WHERE key = ?").run(key);
  } else {
    db.prepare(
      `INSERT INTO app_settings (key, value, value_type, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         value_type = excluded.value_type,
         updated_at = excluded.updated_at`
    ).run(key, stringifyValue(parsed.value), definition.valueType, new Date().toISOString());
  }

  return getEffectiveAppSetting(db, key);
}

export function resetAppSettings(db: Database.Database) {
  db.prepare("DELETE FROM app_settings").run();
}
