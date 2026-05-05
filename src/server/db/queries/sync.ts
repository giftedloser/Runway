import type Database from "better-sqlite3";

import type { SyncLogEntry, SyncStatusResponse } from "../../../shared/types.js";
import { config } from "../../config.js";
import { asArray } from "../../engine/normalize.js";

const NON_BLOCKING_SYNC_MESSAGES = new Set([
  "Conditional access sync failed; preserved previous policy snapshot.",
  "Compliance policy sync failed.",
  "Configuration profile sync failed.",
  "App assignment sync failed."
]);

const INTERRUPTED_SYNC_MESSAGE = "Sync was interrupted before completion.";

function visibleSyncErrors(errors: string): string[] {
  return asArray(errors).filter((error) => !NON_BLOCKING_SYNC_MESSAGES.has(error));
}

export function markInterruptedSyncLogs(db: Database.Database, activeLogId: number | null = null) {
  const errors = JSON.stringify([INTERRUPTED_SYNC_MESSAGE]);

  if (activeLogId !== null) {
    db.prepare(
      "UPDATE sync_log SET completed_at = started_at, errors = ? WHERE completed_at IS NULL AND id != ?"
    ).run(errors, activeLogId);
    return;
  }

  db.prepare("UPDATE sync_log SET completed_at = started_at, errors = ? WHERE completed_at IS NULL").run(errors);
}

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
    errors: visibleSyncErrors(row.errors)
  }));
}

export function getSyncStatus(
  db: Database.Database,
  syncState: {
    inProgress: boolean;
    currentSyncType: "full" | "manual" | null;
    startedAt: string | null;
    lastError: string | null;
    currentLogId?: number | null;
  },
  options: { canTriggerManualSync?: boolean } = {}
): SyncStatusResponse {
  markInterruptedSyncLogs(db, syncState.inProgress ? syncState.currentLogId ?? null : null);

  const logs = listSyncLogs(db);
  const latestComplete = logs.find((entry) => entry.completedAt);
  const latestError = latestComplete?.errors[0] ?? null;
  return {
    inProgress: syncState.inProgress,
    currentSyncType: syncState.currentSyncType,
    startedAt: syncState.startedAt,
    lastCompletedAt: latestComplete?.completedAt ?? null,
    lastSyncType: latestComplete?.syncType ?? null,
    lastError: syncState.lastError ?? latestError,
    canTriggerManualSync: options.canTriggerManualSync ?? false,
    logs,
    graphConfigured: config.isGraphConfigured
  };
}
