import type { EntraRow } from "../db/types.js";
import { GraphClient } from "./graph-client.js";

interface GraphEntraDevice {
  id: string;
  deviceId?: string | null;
  displayName?: string | null;
  serialNumber?: string | null;
  trustType?: string | null;
  isManaged?: boolean | null;
  mdmAppId?: string | null;
  registrationDateTime?: string | null;
  physicalIds?: string[] | null;
}

export async function syncEntraDevices(client: GraphClient): Promise<EntraRow[]> {
  const rows = await client.getAllPages<GraphEntraDevice>(
    "/devices?$filter=operatingSystem eq 'Windows'&$select=id,deviceId,displayName,physicalIds,trustType,isManaged,mdmAppId,registrationDateTime"
  );
  const now = new Date().toISOString();

  return rows.map((row) => ({
    id: row.id,
    device_id: row.deviceId ?? null,
    display_name: row.displayName ?? null,
    serial_number: row.serialNumber ?? null,
    trust_type: row.trustType ?? null,
    is_managed: row.isManaged ? 1 : 0,
    mdm_app_id: row.mdmAppId ?? null,
    registration_datetime: row.registrationDateTime ?? null,
    device_physical_ids: JSON.stringify(row.physicalIds ?? []),
    last_synced_at: now,
    raw_json: JSON.stringify(row)
  }));
}
