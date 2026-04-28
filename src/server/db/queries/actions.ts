import type Database from "better-sqlite3";

export interface ActionLogEntry {
  id: number;
  deviceSerial: string | null;
  deviceName: string | null;
  intuneId: string | null;
  actionType: string;
  triggeredBy: string;
  triggeredAt: string;
  graphResponseStatus: number | null;
  notes: string | null;
  bulkRunId: string | null;
}

export function logAction(
  db: Database.Database,
  entry: Omit<ActionLogEntry, "id" | "bulkRunId"> & {
    idempotencyKey?: string | null;
    idempotencyScope?: string | null;
    bulkRunId?: string | null;
  }
) {
  db.prepare(
    `INSERT INTO action_log (device_serial, device_name, intune_id, action_type, triggered_by, triggered_at, graph_response_status, notes, idempotency_key, idempotency_scope, bulk_run_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    entry.deviceSerial,
    entry.deviceName,
    entry.intuneId,
    entry.actionType,
    entry.triggeredBy,
    entry.triggeredAt,
    entry.graphResponseStatus,
    entry.notes,
    entry.idempotencyKey ?? null,
    entry.idempotencyScope ?? null,
    entry.bulkRunId ?? null
  );
}

/**
 * Look up an action_log row by idempotency key. Returns the
 * cached Graph status + notes so a duplicate request can replay the
 * original result instead of re-dispatching to Microsoft Graph. This
 * intentionally mirrors the permanent unique idempotency_key index.
 */
export function findActionByIdempotencyKey(
  db: Database.Database,
  key: string
): {
  actionType: string;
  graphResponseStatus: number | null;
  notes: string | null;
  triggeredAt: string;
  idempotencyScope: string | null;
} | null {
  const row = db
    .prepare(
      `SELECT action_type, graph_response_status, notes, triggered_at, idempotency_scope
       FROM action_log
       WHERE idempotency_key = ?
       ORDER BY id DESC LIMIT 1`
    )
    .get(key) as
    | {
        action_type: string;
        graph_response_status: number | null;
        notes: string | null;
        triggered_at: string;
        idempotency_scope: string | null;
      }
    | undefined;
  if (!row) return null;
  return {
    actionType: row.action_type,
    graphResponseStatus: row.graph_response_status,
    notes: row.notes,
    triggeredAt: row.triggered_at,
    idempotencyScope: row.idempotency_scope
  };
}

export function listActionLogs(
  db: Database.Database,
  limit = 50
): ActionLogEntry[] {
  const rows = db
    .prepare(
      `SELECT id, device_serial, device_name, intune_id, action_type, triggered_by, triggered_at, graph_response_status, notes, bulk_run_id
       FROM action_log ORDER BY triggered_at DESC LIMIT ?`
    )
    .all(limit) as Array<{
    id: number;
    device_serial: string | null;
    device_name: string | null;
    intune_id: string | null;
    action_type: string;
    triggered_by: string;
    triggered_at: string;
    graph_response_status: number | null;
    notes: string | null;
    bulk_run_id: string | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    deviceSerial: row.device_serial,
    deviceName: row.device_name,
    intuneId: row.intune_id,
    actionType: row.action_type,
    triggeredBy: row.triggered_by,
    triggeredAt: row.triggered_at,
    graphResponseStatus: row.graph_response_status,
    notes: row.notes,
    bulkRunId: row.bulk_run_id
  }));
}

export function listDeviceActionLogs(
  db: Database.Database,
  serial: string,
  limit = 20
): ActionLogEntry[] {
  const rows = db
    .prepare(
      `SELECT id, device_serial, device_name, intune_id, action_type, triggered_by, triggered_at, graph_response_status, notes, bulk_run_id
       FROM action_log WHERE device_serial = ? ORDER BY triggered_at DESC LIMIT ?`
    )
    .all(serial, limit) as Array<{
    id: number;
    device_serial: string | null;
    device_name: string | null;
    intune_id: string | null;
    action_type: string;
    triggered_by: string;
    triggered_at: string;
    graph_response_status: number | null;
    notes: string | null;
    bulk_run_id: string | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    deviceSerial: row.device_serial,
    deviceName: row.device_name,
    intuneId: row.intune_id,
    actionType: row.action_type,
    triggeredBy: row.triggered_by,
    triggeredAt: row.triggered_at,
    graphResponseStatus: row.graph_response_status,
    notes: row.notes,
    bulkRunId: row.bulk_run_id
  }));
}
