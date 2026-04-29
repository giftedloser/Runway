import type { GraphAssignmentRow } from "../db/types.js";

export interface GraphAssignmentTarget {
  "@odata.type"?: string;
  groupId?: string;
}

export interface GraphAssignmentWithTarget {
  intent?: string | null;
  target?: GraphAssignmentTarget | null;
}

export function normalizeGraphAssignments({
  payloadKind,
  payloadId,
  payloadName,
  assignments,
  syncedAt
}: {
  payloadKind: GraphAssignmentRow["payload_kind"];
  payloadId: string;
  payloadName: string;
  assignments: GraphAssignmentWithTarget[];
  syncedAt: string;
}): GraphAssignmentRow[] {
  return assignments.flatMap((assignment) => {
    const groupId = assignment.target?.groupId;
    if (!groupId) return [];

    const targetType = assignment.target?.["@odata.type"]?.toLowerCase().includes("exclusion")
      ? "exclude"
      : "include";

    return {
      payload_kind: payloadKind,
      payload_id: payloadId,
      payload_name: payloadName,
      group_id: groupId,
      intent: assignment.intent ?? null,
      target_type: targetType,
      raw_json: JSON.stringify(assignment),
      synced_at: syncedAt
    };
  });
}
