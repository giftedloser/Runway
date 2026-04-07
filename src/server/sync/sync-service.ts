import type Database from "better-sqlite3";

import { logger } from "../logger.js";
import { createSyncLog, completeSyncLog } from "../db/queries/sync.js";
import { computeAllDeviceStates } from "../engine/compute-all-device-states.js";
import { config } from "../config.js";
import { seedMockData } from "../db/seed.js";
import { persistSnapshot } from "./persist.js";
import { GraphClient } from "./graph-client.js";
import { syncAutopilotDevices } from "./autopilot-sync.js";
import { syncIntuneDevices } from "./intune-sync.js";
import { syncEntraDevices } from "./entra-sync.js";
import { syncGroups } from "./group-sync.js";
import { syncProfiles } from "./profile-sync.js";

const state = {
  inProgress: false,
  currentSyncType: null as "full" | "manual" | null,
  startedAt: null as string | null,
  lastError: null as string | null
};

export function getSyncState() {
  return state;
}

export async function fullSync(
  db: Database.Database,
  syncType: "full" | "manual" = "full"
) {
  if (state.inProgress) {
    throw new Error("A sync is already in progress.");
  }

  state.inProgress = true;
  state.currentSyncType = syncType;
  state.startedAt = new Date().toISOString();
  state.lastError = null;

  const log = createSyncLog(db, syncType);

  try {
    if (!config.isGraphConfigured) {
      // Mock mode: seed fake data only when the DB is empty so that
      // subsequent "syncs" don't overwrite any real state the user has
      // been experimenting with, and never wipe an operator's data.
      const existing = (
        db.prepare("SELECT COUNT(*) as count FROM device_state").get() as { count: number }
      ).count;
      if (existing === 0) {
        await seedMockData(db);
      }
      const count = (
        db.prepare("SELECT COUNT(*) as count FROM device_state").get() as { count: number }
      ).count;
      completeSyncLog(db, log.id, {
        devicesSynced: count,
        errors: existing === 0 ? [] : ["Mock mode: skipped reseed because device_state is not empty."]
      });
      return;
    }

    const client = new GraphClient();
    const [autopilotRows, intuneRows, entraRows, groupSync, profileSync] = await Promise.all([
      syncAutopilotDevices(client),
      syncIntuneDevices(client),
      syncEntraDevices(client),
      syncGroups(client),
      syncProfiles(client)
    ]);

    persistSnapshot(db, {
      autopilotRows,
      intuneRows,
      entraRows,
      groupRows: groupSync.groups,
      membershipRows: groupSync.memberships,
      profileRows: profileSync.profiles,
      profileAssignmentRows: profileSync.assignments
    });

    const devicesSynced = computeAllDeviceStates(db);
    completeSyncLog(db, log.id, { devicesSynced });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sync failure";
    state.lastError = message;
    completeSyncLog(db, log.id, { devicesSynced: 0, errors: [message] });
    throw error;
  } finally {
    state.inProgress = false;
    state.currentSyncType = null;
    state.startedAt = null;
  }
}

export function startBackgroundSync(db: Database.Database) {
  if (!config.isGraphConfigured) {
    logger.info("Graph credentials missing; background sync disabled and mock mode enabled.");
    return;
  }

  setInterval(() => {
    fullSync(db, "full").catch((error) => {
      logger.error({ err: error }, "Background sync failed.");
    });
  }, config.SYNC_INTERVAL_MINUTES * 60 * 1000).unref();
}
