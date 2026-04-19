import type Database from "better-sqlite3";

import type { HealthLevel, ProfileAuditDetail, ProfileAuditSummary } from "../../../shared/types.js";
import { safeJsonParse } from "../../engine/normalize.js";
import type { GroupRow, ProfileAssignmentRow, ProfileRow } from "../types.js";
import { listDeviceStates } from "./devices.js";

type DeviceStateProfileRow = {
  device_key: string;
  assigned_profile_name: string | null;
  overall_health: HealthLevel;
  tag_mismatch: number;
};

const emptyCounts = (): Record<HealthLevel, number> => ({
  critical: 0,
  warning: 0,
  info: 0,
  healthy: 0,
  unknown: 0
});

export function listProfiles(db: Database.Database): ProfileAuditSummary[] {
  const profiles = db.prepare("SELECT * FROM autopilot_profiles").all() as ProfileRow[];
  const groups = db.prepare("SELECT * FROM groups").all() as GroupRow[];
  const assignments = db
    .prepare("SELECT * FROM autopilot_profile_assignments")
    .all() as ProfileAssignmentRow[];
  const deviceRows = db.prepare("SELECT * FROM device_state").all() as Array<
    DeviceStateProfileRow & { active_flags: string }
  >;
  const membershipCounts = db
    .prepare("SELECT group_id, COUNT(*) as count FROM group_memberships GROUP BY group_id")
    .all() as Array<{ group_id: string; count: number }>;

  const groupMap = new Map(groups.map((group) => [group.id, group]));
  const membershipCountMap = new Map(membershipCounts.map((row) => [row.group_id, row.count]));

  return profiles.map((profile) => {
    const relatedAssignments = assignments.filter((assignment) => assignment.profile_id === profile.id);
    const counts = emptyCounts();
    const deviceBreakdown = deviceRows.filter(
      (row) => row.assigned_profile_name === profile.display_name
    );
    for (const row of deviceBreakdown) {
      counts[row.overall_health] += 1;
    }

    const targetingGroups = relatedAssignments.map((assignment) => {
      const group = groupMap.get(assignment.group_id);
      return {
        groupId: assignment.group_id,
        groupName: group?.display_name ?? assignment.group_id,
        membershipType: (group?.membership_type === "DynamicMembership" ? "dynamic" : "assigned") as
          | "dynamic"
          | "assigned",
        memberCount: membershipCountMap.get(assignment.group_id) ?? 0,
        membershipRule: group?.membership_rule ?? null
      };
    });

    const missingAssignmentCount = db
      .prepare(
        `
        SELECT COUNT(*) as count
        FROM device_state
        WHERE assigned_profile_name IS NULL
          AND active_flags LIKE '%"not_in_target_group"%'
          AND group_tag IS NOT NULL
      `
      )
      .get() as { count: number };

    const tagMismatchCount = deviceRows.filter(
      (row) => row.assigned_profile_name === profile.display_name && row.tag_mismatch === 1
    ).length;

    return {
      profileId: profile.id,
      profileName: profile.display_name,
      deploymentMode: profile.deployment_mode,
      hybridJoinConfigured: Boolean(profile.hybrid_join_config),
      oobeSummary: Object.keys(safeJsonParse<Record<string, unknown>>(profile.out_of_box_experience, {})),
      targetingGroups,
      counts,
      assignedDevices: deviceBreakdown.length,
      missingAssignmentCount: missingAssignmentCount.count,
      tagMismatchCount
    };
  });
}

export function getProfileDetail(
  db: Database.Database,
  profileId: string
): ProfileAuditDetail | null {
  const summary = listProfiles(db).find((profile) => profile.profileId === profileId);
  if (!summary) {
    return null;
  }

  const deviceBreakdown = listDeviceStates(db, {
    profile: summary.profileName,
    page: 1,
    pageSize: 500
  }).items;

  return {
    ...summary,
    deviceBreakdown
  };
}
