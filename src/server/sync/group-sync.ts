import type { GroupMembershipRow, GroupRow } from "../db/types.js";
import { logger } from "../logger.js";
import { GraphClient } from "./graph-client.js";

interface GraphGroup {
  id: string;
  displayName: string;
  membershipRule?: string | null;
  membershipRuleProcessingState?: string | null;
  groupTypes?: string[] | null;
}

interface GraphGroupMember {
  id: string;
  deviceId?: string | null;
}

export function syncGroups(client: GraphClient): Promise<{
  groups: GroupRow[];
  memberships: GroupMembershipRow[];
}>;
export async function syncGroups(
  client: GraphClient,
  options: { targetGroupIds?: Iterable<string> } = {}
): Promise<{
  groups: GroupRow[];
  memberships: GroupMembershipRow[];
}> {
  const rows = await client.getAllPages<GraphGroup>(
    "/groups?$select=id,displayName,membershipRule,membershipRuleProcessingState,groupTypes"
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
  const targetGroupIds = new Set(options.targetGroupIds ?? []);
  const groupsToExpand = groups.filter((group) => shouldExpandMembership(group, targetGroupIds));

  logger.info(
    { groupCount: groups.length, membershipGroupCount: groupsToExpand.length },
    "[sync] Group sync will expand device memberships for relevant groups."
  );

  for (const group of groupsToExpand) {
    try {
      const members = await client.getAllPages<GraphGroupMember>(
        `/groups/${group.id}/members/microsoft.graph.device?$select=id,deviceId`
      );
      for (const member of members) {
        memberships.push({
          group_id: group.id,
          member_device_id: member.id,
          last_synced_at: now
        });
      }
    } catch (error) {
      logger.warn({ err: error, groupId: group.id, groupName: group.display_name }, "Group membership sync failed.");
    }
  }

  return { groups, memberships };
}

function shouldExpandMembership(group: GroupRow, targetGroupIds: Set<string>) {
  if (targetGroupIds.has(group.id)) return true;

  const name = group.display_name.toLowerCase();
  if (name.includes("autopilot") || name.startsWith("ap-")) return true;

  const rule = group.membership_rule?.toLowerCase() ?? "";
  return rule.includes("device.") || rule.includes("devicephysicalids");
}
