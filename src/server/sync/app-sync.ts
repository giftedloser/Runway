import type {
  DeviceAppInstallStateRow,
  GraphAssignmentRow,
  MobileAppRow
} from "../db/types.js";
import {
  normalizeGraphAssignments,
  type GraphAssignmentWithTarget
} from "./graph-assignment-normalize.js";
import { GraphClient } from "./graph-client.js";

interface GraphMobileAppResponse {
  id: string;
  displayName?: string;
  description?: string;
  publisher?: string;
  "@odata.type"?: string;
  assignments?: GraphAssignmentWithTarget[];
}

interface GraphDetectedAppResponse {
  id?: string;
  displayName?: string;
}

export interface AppSyncResult {
  apps: MobileAppRow[];
  deviceStates: DeviceAppInstallStateRow[];
  graphAssignments: GraphAssignmentRow[];
}

export async function syncAppAssignments(
  client: GraphClient,
  intuneDeviceIds: string[]
): Promise<AppSyncResult> {
  const now = new Date().toISOString();

  // Fetch assigned Windows apps
  const rawApps = await client.getAllPages<GraphMobileAppResponse>(
    "/deviceAppManagement/mobileApps?$filter=isAssigned eq true&$select=id,displayName,description,publisher&$expand=assignments"
  );

  const apps: MobileAppRow[] = rawApps.map((a) => ({
    id: a.id,
    display_name: a.displayName ?? "Unknown App",
    description: a.description ?? null,
    app_type: a["@odata.type"]?.replace("#microsoft.graph.", "") ?? null,
    publisher: a.publisher ?? null,
    last_synced_at: now,
    raw_json: JSON.stringify(a)
  }));

  const graphAssignments = rawApps.flatMap((app) =>
    normalizeGraphAssignments({
      payloadKind: "app",
      payloadId: app.id,
      payloadName: app.displayName ?? "Unknown App",
      // MVP: store required app assignments only. If available apps are added
      // later, include intent in the primary key or model assignment IDs.
      assignments: (app.assignments ?? []).filter(
        (assignment) => assignment.intent?.toLowerCase() === "required"
      ),
      syncedAt: now
    })
  );

  // Fetch per-device app install states via managed app statuses
  const deviceStates: DeviceAppInstallStateRow[] = [];
  const BATCH_SIZE = 20;

  for (let i = 0; i < intuneDeviceIds.length; i += BATCH_SIZE) {
    const batch = intuneDeviceIds.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (deviceId) => {
        try {
          const states = await client.getAllPages<GraphDetectedAppResponse>(
            `/deviceManagement/managedDevices/${deviceId}/detectedApps`
          );
          return states.map((s: GraphDetectedAppResponse) => ({
            id: s.id ?? `${deviceId}-${s.displayName}`,
            device_id: deviceId,
            app_id: s.id ?? "unknown",
            app_name: s.displayName ?? null,
            install_state: "installed",
            error_code: null,
            last_synced_at: now
          }));
        } catch {
          return [];
        }
      })
    );
    deviceStates.push(...results.flat());
  }

  return { apps, deviceStates, graphAssignments };
}
