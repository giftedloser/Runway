import type Database from "better-sqlite3";

import { config } from "../config.js";
import { logger } from "../logger.js";

export interface FirstRunStatus {
  graphCredentialsPresent: boolean;
  successfulSyncCompleted: boolean;
  deviceRowsPresent: boolean;
  complete: boolean;
}

export function getFirstRunStatus(
  db: Database.Database,
  options: { graphCredentialsPresent?: boolean } = {}
): FirstRunStatus {
  const syncRow = db
    .prepare(
      `SELECT id FROM sync_log
       WHERE completed_at IS NOT NULL
         AND (errors IS NULL OR errors = '[]')
       ORDER BY id DESC
       LIMIT 1`
    )
    .get() as { id: number } | undefined;
  const deviceRow = db
    .prepare("SELECT COUNT(*) AS count FROM device_state")
    .get() as { count: number };

  const status = {
    graphCredentialsPresent: options.graphCredentialsPresent ?? config.isGraphConfigured,
    successfulSyncCompleted: Boolean(syncRow),
    deviceRowsPresent: deviceRow.count > 0,
    complete: false
  };
  status.complete =
    status.graphCredentialsPresent &&
    status.successfulSyncCompleted &&
    status.deviceRowsPresent;

  logger.debug(
    {
      graphCredentialsPresent: status.graphCredentialsPresent,
      successfulSyncCompleted: status.successfulSyncCompleted,
      deviceRowsPresent: status.deviceRowsPresent,
      complete: status.complete
    },
    "[v1.6][setup] First-run status evaluated"
  );

  return status;
}

export function isFirstRunComplete(db: Database.Database): boolean {
  return getFirstRunStatus(db).complete;
}
