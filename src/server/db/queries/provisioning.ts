import type Database from "better-sqlite3";

export interface TagInventoryItem {
  groupTag: string;
  deviceCount: number;
  lastSeenAt: string | null;
  configured: boolean;
  propertyLabel: string | null;
}

export interface ProvisioningTagDevice {
  deviceKey: string;
  deviceName: string | null;
  serialNumber: string | null;
  lastSyncAt: string | null;
  health: string;
  complianceState: string | null;
}

export interface BuildPayloadItem {
  payloadId: string;
  payloadName: string;
  intent: string | null;
  targetType: "include" | "exclude";
  syncedAt: string;
}

export interface BuildPayloadGroup {
  requiredApps: BuildPayloadItem[];
  configProfiles: BuildPayloadItem[];
  compliancePolicies: BuildPayloadItem[];
  warnings: string[];
  syncedAt: string | null;
  availability: BuildPayloadAvailability;
}

export interface BuildPayloadAvailability {
  state: "available" | "not-synced" | "error";
  message: string | null;
}

interface GraphAssignmentQueryRow {
  payload_kind: "app" | "config" | "compliance";
  payload_id: string;
  payload_name: string;
  group_id: string;
  intent: string | null;
  target_type: "include" | "exclude";
  synced_at: string;
}

function emptyPayloadGroup(availability: BuildPayloadAvailability): BuildPayloadGroup {
  return {
    requiredApps: [],
    configProfiles: [],
    compliancePolicies: [],
    warnings: [],
    syncedAt: null,
    availability
  };
}

function toItem(row: GraphAssignmentQueryRow): BuildPayloadItem {
  return {
    payloadId: row.payload_id,
    payloadName: row.payload_name,
    intent: row.intent,
    targetType: row.target_type,
    syncedAt: row.synced_at
  };
}

function latestTimestamp(current: string | null, next: string) {
  return current && current > next ? current : next;
}

export function listProvisioningTags(db: Database.Database): TagInventoryItem[] {
  const rows = db
    .prepare(
      `WITH discovered_tags AS (
         SELECT
           group_tag,
           COUNT(*) AS device_count,
           MAX(COALESCE(last_checkin_at, computed_at)) AS last_seen_at
         FROM device_state
         WHERE group_tag IS NOT NULL AND TRIM(group_tag) != ''
         GROUP BY group_tag

         UNION ALL

         SELECT
           ap.group_tag,
           COUNT(*) AS device_count,
           MAX(ap.last_synced_at) AS last_seen_at
         FROM autopilot_devices ap
         WHERE ap.group_tag IS NOT NULL
           AND TRIM(ap.group_tag) != ''
           AND NOT EXISTS (
             SELECT 1
             FROM device_state ds
             WHERE ds.group_tag = ap.group_tag
           )
         GROUP BY ap.group_tag
       )
       SELECT
         discovered_tags.group_tag,
         SUM(discovered_tags.device_count) AS device_count,
         MAX(discovered_tags.last_seen_at) AS last_seen_at,
         tc.group_tag AS configured_tag,
         tc.property_label
       FROM discovered_tags
       LEFT JOIN tag_config tc ON tc.group_tag = discovered_tags.group_tag
       GROUP BY discovered_tags.group_tag, tc.group_tag, tc.property_label
       ORDER BY discovered_tags.group_tag COLLATE NOCASE`
    )
    .all() as Array<{
    group_tag: string;
    device_count: number;
    last_seen_at: string | null;
    configured_tag: string | null;
    property_label: string | null;
  }>;

  return rows.map((row) => ({
    groupTag: row.group_tag,
    deviceCount: row.device_count,
    lastSeenAt: row.last_seen_at,
    configured: Boolean(row.configured_tag),
    propertyLabel: row.property_label
  }));
}

export function devicesForProvisioningTag(
  db: Database.Database,
  groupTag: string
): ProvisioningTagDevice[] {
  const rows = db
    .prepare(
      `SELECT device_key, device_name, serial_number,
              COALESCE(last_checkin_at, computed_at) AS last_sync_at,
              overall_health, compliance_state
       FROM device_state
       WHERE group_tag = ?
       ORDER BY CASE overall_health
         WHEN 'critical' THEN 0
         WHEN 'warning' THEN 1
         WHEN 'info' THEN 2
         WHEN 'healthy' THEN 3
         ELSE 4
       END ASC,
       COALESCE(device_name, serial_number, device_key) COLLATE NOCASE ASC`
    )
    .all(groupTag) as Array<{
    device_key: string;
    device_name: string | null;
    serial_number: string | null;
    last_sync_at: string | null;
    overall_health: string;
    compliance_state: string | null;
  }>;

  if (rows.length > 0) {
    return rows.map((row) => ({
      deviceKey: row.device_key,
      deviceName: row.device_name,
      serialNumber: row.serial_number,
      lastSyncAt: row.last_sync_at,
      health: row.overall_health,
      complianceState: row.compliance_state
    }));
  }

  const autopilotRows = db
    .prepare(
      `SELECT id, serial_number, last_synced_at
       FROM autopilot_devices
       WHERE group_tag = ?
       ORDER BY COALESCE(serial_number, id) COLLATE NOCASE ASC`
    )
    .all(groupTag) as Array<{
    id: string;
    serial_number: string | null;
    last_synced_at: string | null;
  }>;

  return autopilotRows.map((row) => ({
    deviceKey: `ap:${row.id}`,
    deviceName: null,
    serialNumber: row.serial_number,
    lastSyncAt: row.last_synced_at,
    health: "info",
    complianceState: null
  }));
}

export function countDevicesForProvisioningTag(
  db: Database.Database,
  groupTag: string
) {
  const deviceStateCount = (
    db
      .prepare("SELECT COUNT(*) as count FROM device_state WHERE group_tag = ?")
      .get(groupTag) as { count: number }
  ).count;
  if (deviceStateCount > 0) return deviceStateCount;

  return (
    db
      .prepare("SELECT COUNT(*) as count FROM autopilot_devices WHERE group_tag = ?")
      .get(groupTag) as { count: number }
  ).count;
}

function getPayloadAvailability(db: Database.Database): BuildPayloadAvailability {
  const latestSync = db
    .prepare("SELECT completed_at, errors FROM sync_log WHERE completed_at IS NOT NULL ORDER BY id DESC LIMIT 1")
    .get() as { completed_at: string | null; errors: string | null } | undefined;
  if (!latestSync) {
    return {
      state: "not-synced",
      message: "Assignment data has not been synced yet."
    };
  }

  const graphAssignmentCount = (
    db.prepare("SELECT COUNT(*) AS count FROM graph_assignments").get() as { count: number }
  ).count;
  let errors: string[] = [];
  try {
    errors = latestSync.errors ? (JSON.parse(latestSync.errors) as string[]) : [];
  } catch {
    errors = [];
  }

  if (graphAssignmentCount === 0 && errors.length > 0) {
    return {
      state: "error",
      message: "The last sync reported an error before assignment payload data was available."
    };
  }

  return { state: "available", message: null };
}

export function payloadForGroups(db: Database.Database, groupIds: string[]) {
  const availability = getPayloadAvailability(db);
  const payloadByGroupId: Record<string, BuildPayloadGroup> = Object.fromEntries(
    groupIds.map((groupId) => [groupId, emptyPayloadGroup(availability)])
  );

  if (groupIds.length === 0) return payloadByGroupId;

  const rows = db
    .prepare(
      `SELECT payload_kind, payload_id, payload_name, group_id, intent, target_type, synced_at
       FROM graph_assignments
       WHERE group_id IN (${groupIds.map(() => "?").join(",")})
       ORDER BY payload_kind, payload_name`
    )
    .all(...groupIds) as GraphAssignmentQueryRow[];

  for (const row of rows) {
    const payload = payloadByGroupId[row.group_id];
    if (!payload) continue;

    payload.syncedAt = latestTimestamp(payload.syncedAt, row.synced_at);
    if (row.target_type !== "include") continue;

    if (row.payload_kind === "app") {
      if (row.intent?.toLowerCase() === "required") {
        payload.requiredApps.push(toItem(row));
      }
    } else if (row.payload_kind === "config") {
      payload.configProfiles.push(toItem(row));
    } else {
      payload.compliancePolicies.push(toItem(row));
    }
  }

  const groupsWithPayload = new Set(
    Object.entries(payloadByGroupId)
      .filter(
        ([, payload]) =>
          payload.requiredApps.length > 0 ||
          payload.configProfiles.length > 0 ||
          payload.compliancePolicies.length > 0
      )
      .map(([groupId]) => groupId)
  );
  const payloadExistsForDiscoveredGroups = groupsWithPayload.size > 0;

  for (const [groupId, payload] of Object.entries(payloadByGroupId)) {
    if (payload.requiredApps.length === 0) {
      payload.warnings.push("No required apps found for this target group.");
    }
    if (payloadExistsForDiscoveredGroups && !groupsWithPayload.has(groupId)) {
      payload.warnings.push(
        "Payload exists on another discovered group, but not this target group."
      );
    }
  }

  return payloadByGroupId;
}
