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
import { syncCompliancePolicies } from "./compliance-sync.js";
import { syncConfigProfiles } from "./config-profile-sync.js";
import { syncAppAssignments } from "./app-sync.js";
import { syncConditionalAccessPolicies } from "./conditional-access-sync.js";

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
      // Mock mode: seed fake data only when the DB is empty *and*
      // SEED_MODE permits it. We never overwrite an operator's data on
      // subsequent "syncs", and we never seed when the operator has
      // explicitly opted out (SEED_MODE=none).
      const existing = (
        db.prepare("SELECT COUNT(*) as count FROM device_state").get() as { count: number }
      ).count;
      const seeded = existing === 0 && config.SEED_MODE === "mock";
      if (seeded) {
        await seedMockData(db);
      }
      const count = (
        db.prepare("SELECT COUNT(*) as count FROM device_state").get() as { count: number }
      ).count;
      const errors: string[] = [];
      if (!seeded && existing > 0) {
        errors.push("Mock mode: skipped reseed because device_state is not empty.");
      } else if (!seeded && config.SEED_MODE !== "mock") {
        errors.push("Graph not configured and SEED_MODE is not 'mock'; nothing to do.");
      }
      completeSyncLog(db, log.id, { devicesSynced: count, errors });
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

    const syncWarnings: string[] = [];
    const conditionalAccessSync = await syncConditionalAccessPolicies(client).catch((error) => {
      const message = "Conditional access sync failed; preserved previous policy snapshot.";
      logger.warn(
        { err: error },
        message
      );
      syncWarnings.push(message);
      return null;
    });

    // Compliance + config profile syncs need Intune device IDs, so they run after the initial fetch
    const intuneIds = intuneRows.map((r) => r.id);
    const [complianceSync, configProfileSync, appSync] = await Promise.all([
      syncCompliancePolicies(client, intuneIds),
      syncConfigProfiles(client, intuneIds),
      syncAppAssignments(client, intuneIds)
    ]);

    persistSnapshot(db, {
      autopilotRows,
      intuneRows,
      entraRows,
      groupRows: groupSync.groups,
      membershipRows: groupSync.memberships,
      profileRows: profileSync.profiles,
      profileAssignmentRows: profileSync.assignments,
      compliancePolicies: complianceSync.policies,
      deviceComplianceStates: complianceSync.deviceStates,
      conditionalAccessPolicies: conditionalAccessSync?.policies,
      configProfiles: configProfileSync.profiles,
      deviceConfigStates: configProfileSync.deviceStates,
      mobileApps: appSync.apps,
      deviceAppInstallStates: appSync.deviceStates,
      graphAssignments: [
        ...appSync.graphAssignments,
        ...configProfileSync.graphAssignments,
        ...complianceSync.graphAssignments
      ]
    });

    const devicesSynced = computeAllDeviceStates(db);
    completeSyncLog(db, log.id, { devicesSynced, errors: syncWarnings });
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
