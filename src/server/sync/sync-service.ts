import type Database from "better-sqlite3";

import { logger } from "../logger.js";
import { createSyncLog, completeSyncLog } from "../db/queries/sync.js";
import { computeAllDeviceStates } from "../engine/compute-all-device-states.js";
import { config } from "../config.js";
import { seedMockData } from "../db/seed.js";
import { getAppSettingValues } from "../settings/app-settings.js";
import { persistSnapshot } from "./persist.js";
import { GraphClient } from "./graph-client.js";
import { syncAutopilotDevices } from "./autopilot-sync.js";
import { syncIntuneDevices } from "./intune-sync.js";
import { syncEntraDevices } from "./entra-sync.js";
import { syncGroups } from "./group-sync.js";
import { syncProfiles } from "./profile-sync.js";
import { syncCompliancePolicies, type ComplianceSyncResult } from "./compliance-sync.js";
import { syncConfigProfiles, type ConfigProfileSyncResult } from "./config-profile-sync.js";
import { syncAppAssignments, type AppSyncResult } from "./app-sync.js";
import { syncConditionalAccessPolicies, type ConditionalAccessSyncResult } from "./conditional-access-sync.js";
import type { AutopilotRow, IntuneRow, EntraRow, GroupRow, GroupMembershipRow, ProfileRow, ProfileAssignmentRow } from "../db/types.js";

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
  syncType: "full" | "manual" = "full",
  delegatedToken: string
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
      const appSettings = getAppSettingValues(db);
      // Mock mode: seed fake data only when the DB is empty *and*
      // SEED_MODE permits it. We never overwrite an operator's data on
      // subsequent "syncs", and we never seed when the operator has
      // explicitly opted out (SEED_MODE=none).
      const existing = (
        db.prepare("SELECT COUNT(*) as count FROM device_state").get() as { count: number }
      ).count;
      const seeded = existing === 0 && appSettings.seedMode === "mock";
      if (seeded) {
        await seedMockData(db);
      }
      const count = (
        db.prepare("SELECT COUNT(*) as count FROM device_state").get() as { count: number }
      ).count;
      const errors: string[] = [];
      if (!seeded && existing > 0) {
        errors.push("Mock mode: skipped reseed because device_state is not empty.");
      } else if (!seeded && appSettings.seedMode !== "mock") {
        errors.push("Graph not configured and SEED_MODE is not 'mock'; nothing to do.");
      }
      completeSyncLog(db, log.id, { devicesSynced: count, errors });
      return;
    }

    const client = new GraphClient(delegatedToken);
    const syncWarnings: string[] = [];

    // --- Phase 1: primary device + group + profile data ---
    // Each step is independently wrapped so a failure in one
    // does not stop the others. Failed steps produce empty
    // results and log a warning.

    logger.info("[sync] → Autopilot devices");
    let autopilotRows: AutopilotRow[] | undefined;
    try {
      autopilotRows = await syncAutopilotDevices(client);
    } catch (error) {
      const msg = "Autopilot device sync failed.";
      logger.warn({ err: error }, msg);
      syncWarnings.push(msg);
    }

    logger.info("[sync] → Intune managed devices");
    let intuneRows: IntuneRow[] | undefined;
    try {
      intuneRows = await syncIntuneDevices(client);
    } catch (error) {
      const msg = "Intune device sync failed.";
      logger.warn({ err: error }, msg);
      syncWarnings.push(msg);
    }

    logger.info("[sync] → Entra devices");
    let entraRows: EntraRow[] | undefined;
    try {
      entraRows = await syncEntraDevices(client);
    } catch (error) {
      const msg = "Entra device sync failed.";
      logger.warn({ err: error }, msg);
      syncWarnings.push(msg);
    }

    logger.info("[sync] → Groups");
    let groupSync: { groups: GroupRow[]; memberships: GroupMembershipRow[] } | undefined;
    try {
      groupSync = await syncGroups(client);
    } catch (error) {
      const msg = "Group sync failed.";
      logger.warn({ err: error }, msg);
      syncWarnings.push(msg);
    }

    logger.info("[sync] → Autopilot deployment profiles");
    let profileSync: { profiles: ProfileRow[]; assignments: ProfileAssignmentRow[] } | undefined;
    try {
      profileSync = await syncProfiles(client);
    } catch (error) {
      const msg = "Autopilot profile sync failed.";
      logger.warn({ err: error }, msg);
      syncWarnings.push(msg);
    }

    logger.info("[sync] → Conditional access policies");
    let conditionalAccessSync: ConditionalAccessSyncResult | null = null;
    try {
      conditionalAccessSync = await syncConditionalAccessPolicies(client);
    } catch (error) {
      const msg = "Conditional access sync failed; preserved previous policy snapshot.";
      logger.warn({ err: error }, msg);
    }

    // --- Phase 2: compliance / config / app syncs need Intune device IDs ---
    const intuneIds =
      intuneRows?.map((r) => r.id) ??
      (db.prepare("SELECT id FROM intune_devices").all() as Array<{ id: string }>).map((row) => row.id);

    logger.info("[sync] → Compliance policies");
    let complianceSync: ComplianceSyncResult | undefined;
    try {
      complianceSync = await syncCompliancePolicies(client, intuneIds);
    } catch (error) {
      const msg = "Compliance policy sync failed.";
      logger.warn({ err: error }, msg);
    }

    logger.info("[sync] → Configuration profiles");
    let configProfileSync: ConfigProfileSyncResult | undefined;
    try {
      configProfileSync = await syncConfigProfiles(client, intuneIds);
    } catch (error) {
      const msg = "Configuration profile sync failed.";
      logger.warn({ err: error }, msg);
    }

    logger.info("[sync] → App assignments");
    let appSync: AppSyncResult | undefined;
    try {
      appSync = await syncAppAssignments(client, intuneIds);
    } catch (error) {
      const msg = "App assignment sync failed.";
      logger.warn({ err: error }, msg);
    }

    // --- Persist whatever succeeded ---
    persistSnapshot(db, {
      autopilotRows,
      intuneRows,
      entraRows,
      groupRows: groupSync?.groups,
      membershipRows: groupSync?.memberships,
      profileRows: profileSync?.profiles,
      profileAssignmentRows: profileSync?.assignments,
      compliancePolicies: complianceSync?.policies,
      deviceComplianceStates: complianceSync?.deviceStates,
      conditionalAccessPolicies: conditionalAccessSync?.policies,
      configProfiles: configProfileSync?.profiles,
      deviceConfigStates: configProfileSync?.deviceStates,
      mobileApps: appSync?.apps,
      deviceAppInstallStates: appSync?.deviceStates,
      graphAssignments:
        appSync || configProfileSync || complianceSync
          ? [
              ...(appSync?.graphAssignments ?? []),
              ...(configProfileSync?.graphAssignments ?? []),
              ...(complianceSync?.graphAssignments ?? [])
            ]
          : undefined
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
  // Background sync cannot run without a delegated user token.
  // All Graph calls require delegated access — client-credentials
  // fallback has been removed. Sync must be triggered from a
  // user session (POST /api/sync) where the session's access token
  // is available.
  logger.info(
    "Background sync disabled: delegated token required for all Graph calls. " +
      "Trigger sync from the UI after signing in."
  );
}
