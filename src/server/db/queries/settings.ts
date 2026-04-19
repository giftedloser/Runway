import type Database from "better-sqlite3";

import type { SettingsResponse, TagConfigRecord } from "../../../shared/types.js";
import { config } from "../../config.js";
import { asArray } from "../../engine/normalize.js";

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
    tagConfig: listTagConfig(db)
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
