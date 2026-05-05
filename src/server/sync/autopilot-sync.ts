import type { AutopilotRow } from "../db/types.js";
import type { SnapshotPayload } from "./types.js";
import { logger } from "../logger.js";
import { GraphClient } from "./graph-client.js";

interface GraphAutopilotDevice {
  id: string;
  serialNumber?: string | null;
  model?: string | null;
  manufacturer?: string | null;
  groupTag?: string | null;
  userPrincipalName?: string | null;
  azureActiveDirectoryDeviceId?: string | null;
  deploymentProfileAssignmentStatus?: string | null; // derived: 'assigned' if deploymentProfile exists, else null
  deploymentProfile?: {
    id?: string | null;
    displayName?: string | null;
  } | null;
}

export async function syncAutopilotDevices(client: GraphClient): Promise<SnapshotPayload["autopilotRows"]> {
  let rows: GraphAutopilotDevice[];
  try {
    rows = await client.getAllPages<GraphAutopilotDevice>(
      "/deviceManagement/windowsAutopilotDeviceIdentities?$select=id,serialNumber,model,manufacturer,groupTag,userPrincipalName,azureActiveDirectoryDeviceId&$expand=deploymentProfile($select=id,displayName)",
      "beta"
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("400") || message.includes("Bad Request")) {
      logger.warn(
        { err: error },
        "[sync] Autopilot expanded query failed; retrying without deploymentProfile expansion."
      );
      rows = await client.getAllPages<GraphAutopilotDevice>(
        "/deviceManagement/windowsAutopilotDeviceIdentities?$select=id,serialNumber,model,manufacturer,groupTag,userPrincipalName,azureActiveDirectoryDeviceId",
        "beta"
      );
    } else {
      if (message.includes("500")) {
        logger.warn({ err: error }, "[sync] Autopilot endpoint returned 500; returning empty result (tenant may have no Autopilot data).");
        return [];
      }
      throw error;
    }
  }
  const now = new Date().toISOString();

  return rows.map(
    (row): AutopilotRow => ({
      id: row.id,
      serial_number: row.serialNumber ?? null,
      model: row.model ?? null,
      manufacturer: row.manufacturer ?? null,
      group_tag: row.groupTag ?? null,
      assigned_user_upn: row.userPrincipalName ?? null,
      deployment_profile_id: row.deploymentProfile?.id ?? null,
      deployment_profile_name: row.deploymentProfile?.displayName ?? null,
      profile_assignment_status: row.deploymentProfile ? "assigned" : null,
      deployment_mode: null,
      entra_device_id: row.azureActiveDirectoryDeviceId ?? null,
      first_seen_at: now,
      first_profile_assigned_at: row.deploymentProfile?.id ? now : null,
      last_synced_at: now,
      raw_json: JSON.stringify(row)
    })
  );
}
