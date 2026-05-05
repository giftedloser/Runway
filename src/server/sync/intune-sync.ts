import type { IntuneRow } from "../db/types.js";
import { GraphClient } from "./graph-client.js";

interface GraphManagedDevice {
  id: string;
  deviceName?: string | null;
  serialNumber?: string | null;
  azureADDeviceId?: string | null;
  complianceState?: string | null;
  osVersion?: string | null;
  deviceEnrollmentType?: string | null;
  managedDeviceOwnerType?: string | null;
  lastSyncDateTime?: string | null;
  userPrincipalName?: string | null;
  enrollmentProfileName?: string | null;
  autopilotEnrolled?: boolean | null;
  managementAgent?: string | null;
}

export async function syncIntuneDevices(client: GraphClient): Promise<IntuneRow[]> {
  const rows = await client.getAllPages<GraphManagedDevice>(
    "/deviceManagement/managedDevices?$filter=operatingSystem eq 'Windows'&$select=id,deviceName,serialNumber,azureADDeviceId,complianceState,osVersion,deviceEnrollmentType,managedDeviceOwnerType,lastSyncDateTime,userPrincipalName,enrollmentProfileName,managementAgent"
  );
  const now = new Date().toISOString();

  return rows.map((row) => ({
    id: row.id,
    device_name: row.deviceName ?? null,
    serial_number: row.serialNumber ?? null,
    entra_device_id: row.azureADDeviceId ?? null,
    os_version: row.osVersion ?? null,
    compliance_state: row.complianceState ?? null,
    enrollment_type: row.deviceEnrollmentType ?? null,
    managed_device_owner_type: row.managedDeviceOwnerType ?? null,
    last_sync_datetime: row.lastSyncDateTime ?? null,
    primary_user_upn: row.userPrincipalName ?? null,
    enrollment_profile_name: row.enrollmentProfileName ?? null,
    autopilot_enrolled: row.autopilotEnrolled ? 1 : 0,
    management_agent: row.managementAgent ?? null,
    last_synced_at: now,
    raw_json: JSON.stringify(row)
  }));
}
