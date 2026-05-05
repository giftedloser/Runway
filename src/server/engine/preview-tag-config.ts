import type Database from "better-sqlite3";

import type { AssignmentPath, FlagCode, TagConfigPreviewResponse, TagConfigRecord } from "../../shared/types.js";
import { safeJsonParse } from "./normalize.js";

const MAX_SAMPLE_DEVICES = 25;

function expectedGroupMatched(path: AssignmentPath, expectedGroupNames: string[]) {
  if (expectedGroupNames.length === 0) return true;
  const groups = path.targetingGroups ?? [];
  return expectedGroupNames.some((name) =>
    groups.some((group) => group.groupName === name && group.membershipState === "member")
  );
}

function expectedProfileMatched(assignedProfileName: string | null, expectedProfileNames: string[]) {
  if (expectedProfileNames.length === 0) return true;
  return Boolean(assignedProfileName && expectedProfileNames.includes(assignedProfileName));
}

function nextFlagsFor(row: TagPreviewRow, record: TagConfigRecord) {
  const flags = new Set(safeJsonParse<FlagCode[]>(row.active_flags, []));
  const path = safeJsonParse<AssignmentPath>(row.assignment_path, {
    autopilotRecord: null,
    targetingGroups: [],
    assignedProfile: null,
    effectiveMode: null,
    chainComplete: false,
    breakPoint: null
  });
  const hasExpectedGroups = record.expectedGroupNames.length > 0;
  const nextInTargetGroup = expectedGroupMatched(path, record.expectedGroupNames);
  const nextProfileMatches = expectedProfileMatched(
    row.deployment_profile_name ?? row.assigned_profile_name,
    record.expectedProfileNames
  );
  const nextTagMismatch = !nextProfileMatches || !nextInTargetGroup;

  if (row.has_autopilot_record && hasExpectedGroups && !nextInTargetGroup) {
    flags.add("not_in_target_group");
  } else {
    flags.delete("not_in_target_group");
  }

  if (nextTagMismatch) {
    flags.add("tag_mismatch");
  } else {
    flags.delete("tag_mismatch");
  }

  return [...flags];
}

type TagPreviewRow = {
  device_key: string;
  device_name: string | null;
  serial_number: string | null;
  property_label: string | null;
  deployment_profile_name: string | null;
  assigned_profile_name: string | null;
  active_flags: string;
  assignment_path: string;
  has_autopilot_record: number;
};

export function previewTagConfig(
  db: Database.Database,
  record: TagConfigRecord
): TagConfigPreviewResponse {
  const rows = db
    .prepare(
      `SELECT device_key, device_name, serial_number, property_label, deployment_profile_name, assigned_profile_name,
              active_flags, assignment_path, has_autopilot_record
         FROM device_state
        WHERE group_tag = ?
        ORDER BY COALESCE(device_name, serial_number, device_key) ASC`
    )
    .all(record.groupTag) as TagPreviewRow[];

  let propertyLabelChanges = 0;
  let addedTagMismatch = 0;
  let clearedTagMismatch = 0;
  let addedNotInTargetGroup = 0;
  let clearedNotInTargetGroup = 0;
  const sampleDevices: TagConfigPreviewResponse["sampleDevices"] = [];

  for (const row of rows) {
    const beforeFlags = safeJsonParse<FlagCode[]>(row.active_flags, []);
    const afterFlags = nextFlagsFor(row, record);
    const beforeSet = new Set(beforeFlags);
    const afterSet = new Set(afterFlags);
    const flagChanges = [
      ...afterFlags.filter((flag) => !beforeSet.has(flag)).map((flag) => `+${flag}`),
      ...beforeFlags.filter((flag) => !afterSet.has(flag)).map((flag) => `-${flag}`)
    ];
    const propertyLabelChanged = (row.property_label ?? null) !== record.propertyLabel;

    if (propertyLabelChanged) propertyLabelChanges += 1;
    if (!beforeSet.has("tag_mismatch") && afterSet.has("tag_mismatch")) addedTagMismatch += 1;
    if (beforeSet.has("tag_mismatch") && !afterSet.has("tag_mismatch")) clearedTagMismatch += 1;
    if (!beforeSet.has("not_in_target_group") && afterSet.has("not_in_target_group")) {
      addedNotInTargetGroup += 1;
    }
    if (beforeSet.has("not_in_target_group") && !afterSet.has("not_in_target_group")) {
      clearedNotInTargetGroup += 1;
    }

    if ((propertyLabelChanged || flagChanges.length > 0) && sampleDevices.length < MAX_SAMPLE_DEVICES) {
      sampleDevices.push({
        deviceKey: row.device_key,
        deviceName: row.device_name,
        serialNumber: row.serial_number,
        assignedProfileName: row.deployment_profile_name ?? row.assigned_profile_name,
        currentPropertyLabel: row.property_label,
        nextPropertyLabel: record.propertyLabel,
        currentFlags: beforeFlags,
        nextFlags: afterFlags,
        flagChanges
      });
    }
  }

  return {
    record,
    matchedDevices: rows.length,
    impact: {
      propertyLabelChanges,
      addedTagMismatch,
      clearedTagMismatch,
      addedNotInTargetGroup,
      clearedNotInTargetGroup
    },
    sampleDevices
  };
}
