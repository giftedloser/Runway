import type Database from "better-sqlite3";

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

function emptyPayloadGroup(): BuildPayloadGroup {
  return {
    requiredApps: [],
    configProfiles: [],
    compliancePolicies: [],
    warnings: [],
    syncedAt: null
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

export function payloadForGroups(db: Database.Database, groupIds: string[]) {
  const payloadByGroupId: Record<string, BuildPayloadGroup> = Object.fromEntries(
    groupIds.map((groupId) => [groupId, emptyPayloadGroup()])
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
