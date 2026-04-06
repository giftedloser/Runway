import type { GroupMembershipRow, GroupRow } from "../db/types.js";
import { GraphClient } from "./graph-client.js";

export async function syncGroups(client: GraphClient): Promise<{
  groups: GroupRow[];
  memberships: GroupMembershipRow[];
}> {
  const rows = await client.getAllPages<any>(
    "/groups?$filter=startswith(displayName,'Autopilot') or startswith(displayName,'AP-')&$select=id,displayName,membershipRule,membershipRuleProcessingState,groupTypes"
  );
  const now = new Date().toISOString();
  const groups = rows.map(
    (row): GroupRow => ({
      id: row.id,
      display_name: row.displayName,
      membership_rule: row.membershipRule ?? null,
      membership_rule_processing_state: row.membershipRuleProcessingState ?? null,
      membership_type: row.groupTypes?.includes("DynamicMembership") ? "DynamicMembership" : "Assigned",
      last_synced_at: now,
      raw_json: JSON.stringify(row)
    })
  );

  const memberships: GroupMembershipRow[] = [];

  for (const group of groups) {
    const members = await client.getAllPages<any>(`/groups/${group.id}/members?$select=id,deviceId`);
    for (const member of members) {
      memberships.push({
        group_id: group.id,
        member_device_id: member.id,
        last_synced_at: now
      });
    }
  }

  return { groups, memberships };
}
