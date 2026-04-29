import type {
  ConfigProfileRow,
  DeviceConfigStateRow,
  GraphAssignmentRow
} from "../db/types.js";
import {
  normalizeGraphAssignments,
  type GraphAssignmentWithTarget
} from "./graph-assignment-normalize.js";
import { GraphClient } from "./graph-client.js";

interface GraphConfigProfileResponse {
  id: string;
  displayName?: string;
  description?: string;
  "@odata.type"?: string;
  assignments?: GraphAssignmentWithTarget[];
}

interface GraphDeviceConfigStateResponse {
  id?: string;
  displayName?: string;
  state?: string;
  lastReportedDateTime?: string;
  settingStates?: { instanceDisplayName?: string }[];
}

export interface ConfigProfileSyncResult {
  profiles: ConfigProfileRow[];
  deviceStates: DeviceConfigStateRow[];
  graphAssignments: GraphAssignmentRow[];
}

export async function syncConfigProfiles(
  client: GraphClient,
  intuneDeviceIds: string[]
): Promise<ConfigProfileSyncResult> {
  const now = new Date().toISOString();

  const rawProfiles = await client.getAllPages<GraphConfigProfileResponse>(
    "/deviceManagement/deviceConfigurations?$select=id,displayName,description&$expand=assignments"
  );

  const profiles: ConfigProfileRow[] = rawProfiles.map((p) => ({
    id: p.id,
    display_name: p.displayName ?? "Unknown Profile",
    description: p.description ?? null,
    platform: p["@odata.type"]?.replace("#microsoft.graph.", "") ?? null,
    profile_type: p["@odata.type"]?.replace("#microsoft.graph.", "").replace("Configuration", "") ?? null,
    last_synced_at: now,
    raw_json: JSON.stringify(p)
  }));

  const graphAssignments = rawProfiles.flatMap((profile) =>
    normalizeGraphAssignments({
      payloadKind: "config",
      payloadId: profile.id,
      payloadName: profile.displayName ?? "Unknown Profile",
      assignments: profile.assignments ?? [],
      syncedAt: now
    })
  );

  // Fetch per-device config profile states in batches
  const deviceStates: DeviceConfigStateRow[] = [];
  const BATCH_SIZE = 20;

  for (let i = 0; i < intuneDeviceIds.length; i += BATCH_SIZE) {
    const batch = intuneDeviceIds.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (deviceId) => {
        try {
          const states = await client.getAllPages<GraphDeviceConfigStateResponse>(
            `/deviceManagement/managedDevices/${deviceId}/deviceConfigurationStates`
          );
          return states.map((s: GraphDeviceConfigStateResponse) => ({
            id: s.id ?? `${deviceId}-${s.displayName}`,
            device_id: deviceId,
            profile_id: s.settingStates?.[0]?.instanceDisplayName ?? s.id ?? "unknown",
            profile_name: s.displayName ?? null,
            state: s.state ?? "unknown",
            last_reported_at: s.lastReportedDateTime ?? null,
            last_synced_at: now
          }));
        } catch {
          return [];
        }
      })
    );
    deviceStates.push(...results.flat());
  }

  return { profiles, deviceStates, graphAssignments };
}
