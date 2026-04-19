import type { AutopilotRow } from "../db/types.js";
import type { SnapshotPayload } from "./types.js";
import { GraphClient } from "./graph-client.js";

interface GraphAutopilotDevice {
  id: string;
  serialNumber?: string | null;
  model?: string | null;
  manufacturer?: string | null;
  groupTag?: string | null;
  userPrincipalName?: string | null;
  azureActiveDirectoryDeviceId?: string | null;
  deploymentProfileAssignmentStatus?: string | null;
  deploymentProfile?: {
    id?: string | null;
    displayName?: string | null;
    deploymentMode?: string | null;
  } | null;
}

export async function syncAutopilotDevices(client: GraphClient): Promise<SnapshotPayload["autopilotRows"]> {
  const rows = await client.getAllPages<GraphAutopilotDevice>(
    "/deviceManagement/windowsAutopilotDeviceIdentities?$select=id,serialNumber,model,manufacturer,groupTag,userPrincipalName,azureActiveDirectoryDeviceId,deploymentProfileAssignmentStatus,deploymentProfile"
  );
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
      profile_assignment_status: row.deploymentProfileAssignmentStatus ?? null,
      deployment_mode: row.deploymentProfile?.deploymentMode ?? null,
      entra_device_id: row.azureActiveDirectoryDeviceId ?? null,
      first_seen_at: now,
      first_profile_assigned_at: row.deploymentProfile?.id ? now : null,
      last_synced_at: now,
      raw_json: JSON.stringify(row)
    })
  );
}
