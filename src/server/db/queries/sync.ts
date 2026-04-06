import type Database from "better-sqlite3";

import type { SyncLogEntry, SyncStatusResponse } from "../../../shared/types.js";
import { config } from "../../config.js";

export function createSyncLog(db: Database.Database, syncType: "full" | "manual") {
  const startedAt = new Date().toISOString();
  const result = db
    .prepare("INSERT INTO sync_log (sync_type, started_at, errors) VALUES (?, ?, '[]')")
    .run(syncType, startedAt);
  return {
    id: Number(result.lastInsertRowid),
    startedAt
  };
}

export function completeSyncLog(
  db: Database.Database,
  id: number,
  payload: { devicesSynced: number; errors?: string[] }
) {
  db.prepare(
    "UPDATE sync_log SET completed_at = ?, devices_synced = ?, errors = ? WHERE id = ?"
  ).run(
    new Date().toISOString(),
    payload.devicesSynced,
    JSON.stringify(payload.errors ?? []),
    id
  );
}

export function listSyncLogs(db: Database.Database, limit = 20): SyncLogEntry[] {
  return (
    db
      .prepare("SELECT * FROM sync_log ORDER BY id DESC LIMIT ?")
      .all(limit) as Array<{
      id: number;
      sync_type: "full" | "incremental" | "manual";
      started_at: string;
      completed_at: string | null;
      devices_synced: number;
      errors: string;
    }>
  ).map((row) => ({
    id: row.id,
    syncType: row.sync_type,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    devicesSynced: row.devices_synced,
    errors: JSON.parse(row.errors)
  }));
}

export function getSyncStatus(
  db: Database.Database,
  syncState: {
    inProgress: boolean;
    currentSyncType: "full" | "manual" | null;
    startedAt: string | null;
    lastError: string | null;
  }
): SyncStatusResponse {
  const logs = listSyncLogs(db);
  const latestComplete = logs.find((entry) => entry.completedAt);
  return {
    inProgress: syncState.inProgress,
    currentSyncType: syncState.currentSyncType,
    startedAt: syncState.startedAt,
    lastCompletedAt: latestComplete?.completedAt ?? null,
    lastSyncType: latestComplete?.syncType ?? null,
    lastError: syncState.lastError,
    logs,
    graphConfigured: config.isGraphConfigured
  };
}
