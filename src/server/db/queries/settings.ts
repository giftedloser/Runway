import type Database from "better-sqlite3";

import type {
  FeatureFlagMap,
  SettingsResponse,
  TagConfigRecord
} from "../../../shared/types.js";
import { config } from "../../config.js";
import { asArray } from "../../engine/normalize.js";

/**
 * Known feature-flag keys. Declaring them centrally means every read/write
 * goes through the same allowlist instead of accepting arbitrary strings
 * from the client. Add new booleans here rather than letting the UI
 * invent flag names.
 */
export const FEATURE_FLAG_KEYS = ["sccm_detection"] as const;
export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];

const DEFAULT_FEATURE_FLAGS: Readonly<Record<FeatureFlagKey, boolean>> = {
  sccm_detection: false
};

export function isFeatureFlagKey(key: string): key is FeatureFlagKey {
  return (FEATURE_FLAG_KEYS as readonly string[]).includes(key);
}

export function listFeatureFlags(db: Database.Database): FeatureFlagMap {
  const rows = db
    .prepare("SELECT key, enabled FROM feature_flags")
    .all() as Array<{ key: string; enabled: number }>;
  const out: FeatureFlagMap = { ...DEFAULT_FEATURE_FLAGS };
  for (const row of rows) {
    if (isFeatureFlagKey(row.key)) {
      out[row.key] = Boolean(row.enabled);
    }
  }
  return out;
}

export function setFeatureFlag(
  db: Database.Database,
  key: FeatureFlagKey,
  enabled: boolean
) {
  db.prepare(
    `INSERT INTO feature_flags (key, enabled, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       enabled = excluded.enabled,
       updated_at = excluded.updated_at`
  ).run(key, enabled ? 1 : 0, new Date().toISOString());
}

export function listTagConfig(db: Database.Database): TagConfigRecord[] {
  return (
    db.prepare("SELECT * FROM tag_config ORDER BY property_label ASC").all() as Array<{
      group_tag: string;
      expected_profile_names: string;
      expected_group_names: string;
      property_label: string;
    }>
  ).map((row) => ({
    groupTag: row.group_tag,
    expectedProfileNames: asArray(row.expected_profile_names),
    expectedGroupNames: asArray(row.expected_group_names),
    propertyLabel: row.property_label
  }));
}

export function getSettings(db: Database.Database): SettingsResponse {
  return {
    graph: {
      configured: config.isGraphConfigured,
      missing: config.graphMissing
    },
    tagConfig: listTagConfig(db),
    featureFlags: listFeatureFlags(db)
  };
}

export function upsertTagConfig(db: Database.Database, record: TagConfigRecord) {
  db.prepare(
    `
    INSERT INTO tag_config (group_tag, expected_profile_names, expected_group_names, property_label)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(group_tag) DO UPDATE SET
      expected_profile_names = excluded.expected_profile_names,
      expected_group_names = excluded.expected_group_names,
      property_label = excluded.property_label
  `
  ).run(
    record.groupTag,
    JSON.stringify(record.expectedProfileNames),
    JSON.stringify(record.expectedGroupNames),
    record.propertyLabel
  );
}

export function deleteTagConfig(db: Database.Database, groupTag: string) {
  db.prepare("DELETE FROM tag_config WHERE group_tag = ?").run(groupTag);
}
