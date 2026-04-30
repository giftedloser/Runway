import type Database from "better-sqlite3";

import { snapshotDatabase } from "../db/snapshot.js";
import { logger } from "../logger.js";
import { getAppSettingValues } from "../settings/app-settings.js";

/**
 * Rolling tables grow forever otherwise: device_state_history records
 * one row per device per sync, action_log records every destructive
 * Graph call, sync_log records each background tick. Without bounded
 * retention the SQLite file balloons on long-running installs and the
 * dashboard's history queries get slower over time.
 *
 * Each retention window is independently disable-able by setting the
 * corresponding *_DAYS config to 0 — useful in audit-bound deployments
 * that ship action logs off-box on their own schedule.
 */

export interface RetentionResult {
  ranAt: string;
  deletedHistoryRows: number;
  deletedActionLogRows: number;
  deletedSyncLogRows: number;
}

function pruneOlderThan(
  db: Database.Database,
  table: string,
  column: string,
  days: number
): number {
  if (days <= 0) return 0;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const stmt = db.prepare(`DELETE FROM ${table} WHERE ${column} IS NOT NULL AND ${column} < ?`);
  const info = stmt.run(cutoff);
  return Number(info.changes ?? 0);
}

export function runRetention(db: Database.Database): RetentionResult {
  // Snapshot before any DELETEs so a buggy retention window cannot
  // silently shred history. Failure to snapshot does not block the
  // sweep — the snapshot helper logs and continues.
  snapshotDatabase(db, "pre-retention");
  const appSettings = getAppSettingValues(db);

  const ranAt = new Date().toISOString();
  const deletedHistoryRows = pruneOlderThan(
    db,
    "device_state_history",
    "computed_at",
    appSettings.deviceHistoryRetentionDays
  );
  const deletedActionLogRows = pruneOlderThan(
    db,
    "action_log",
    "triggered_at",
    appSettings.actionLogRetentionDays
  );
  const deletedSyncLogRows = pruneOlderThan(
    db,
    "sync_log",
    "started_at",
    appSettings.syncLogRetentionDays
  );

  return { ranAt, deletedHistoryRows, deletedActionLogRows, deletedSyncLogRows };
}

let lastResult: RetentionResult | null = null;

export function getLastRetentionResult(): RetentionResult | null {
  return lastResult;
}

export function startRetentionScheduler(db: Database.Database) {
  const sweep = () => {
    try {
      lastResult = runRetention(db);
      logger.info({ retention: lastResult }, "Retention sweep complete");
    } catch (error) {
      logger.error({ err: error }, "Retention sweep failed");
    }
  };

  const scheduleNext = (delayMs: number) => {
    setTimeout(() => {
      sweep();
      const appSettings = getAppSettingValues(db);
      scheduleNext(appSettings.retentionSweepIntervalHours * 60 * 60 * 1000);
    }, delayMs).unref();
  };

  // Initial run after a short delay (5s) so we don't block startup.
  scheduleNext(5_000);
}
