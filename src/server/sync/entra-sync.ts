import type { EntraRow } from "../db/types.js";
import { GraphClient } from "./graph-client.js";

export async function syncEntraDevices(client: GraphClient): Promise<EntraRow[]> {
  const rows = await client.getAllPages<any>(
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
