import type { ProfileAssignmentRow, ProfileRow } from "../db/types.js";
import { GraphClient } from "./graph-client.js";

export async function syncProfiles(client: GraphClient): Promise<{
  profiles: ProfileRow[];
  assignments: ProfileAssignmentRow[];
}> {
  const rows = await client.getAllPages<any>(
    "/deviceManagement/windowsAutopilotDeploymentProfiles?$expand=assignments",
    "beta"
  );
  const now = new Date().toISOString();

  const profiles = rows.map(
    (row): ProfileRow => ({
      id: row.id,
      display_name: row.displayName,
      deployment_mode: row.deploymentMode ?? null,
      out_of_box_experience: JSON.stringify(row.outOfBoxExperienceSettings ?? {}),
      hybrid_join_config: JSON.stringify(row.hybridAzureADJoinSkipConnectivityCheck ?? {}),
      assigned_group_ids: JSON.stringify(
        (row.assignments ?? []).map((assignment: any) => assignment.target?.groupId).filter(Boolean)
      ),
      last_synced_at: now,
      raw_json: JSON.stringify(row)
    })
  );

  const assignments = rows.flatMap((row) =>
    (row.assignments ?? [])
      .map((assignment: any) => assignment.target?.groupId)
      .filter(Boolean)
      .map(
        (groupId: string): ProfileAssignmentRow => ({
          profile_id: row.id,
          group_id: groupId,
          last_synced_at: now
        })
      )
  );

  return { profiles, assignments };
}
