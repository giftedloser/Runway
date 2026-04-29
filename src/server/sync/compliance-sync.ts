import type {
  CompliancePolicyRow,
  DeviceComplianceStateRow,
  GraphAssignmentRow
} from "../db/types.js";
import {
  normalizeGraphAssignments,
  type GraphAssignmentWithTarget
} from "./graph-assignment-normalize.js";
import { GraphClient } from "./graph-client.js";

interface GraphCompliancePolicyResponse {
  id: string;
  displayName?: string;
  description?: string;
  "@odata.type"?: string;
  assignments?: GraphAssignmentWithTarget[];
}

interface GraphDeviceComplianceStateResponse {
  id?: string;
  displayName?: string;
  state?: string;
  lastReportedDateTime?: string;
  settingStates?: { policyId?: string }[];
}

export interface ComplianceSyncResult {
  policies: CompliancePolicyRow[];
  deviceStates: DeviceComplianceStateRow[];
  graphAssignments: GraphAssignmentRow[];
}

export async function syncCompliancePolicies(
  client: GraphClient,
  intuneDeviceIds: string[]
): Promise<ComplianceSyncResult> {
  const now = new Date().toISOString();

  // Fetch all compliance policies
  const rawPolicies = await client.getAllPages<GraphCompliancePolicyResponse>(
    "/deviceManagement/deviceCompliancePolicies?$select=id,displayName,description&$expand=assignments"
  );

  const policies: CompliancePolicyRow[] = rawPolicies.map((p) => ({
    id: p.id,
    display_name: p.displayName ?? "Unknown Policy",
    description: p.description ?? null,
    platform: p["@odata.type"]?.replace("#microsoft.graph.", "") ?? null,
    last_synced_at: now,
    raw_json: JSON.stringify(p)
  }));

  const graphAssignments = rawPolicies.flatMap((policy) =>
    normalizeGraphAssignments({
      payloadKind: "compliance",
      payloadId: policy.id,
      payloadName: policy.displayName ?? "Unknown Policy",
      assignments: policy.assignments ?? [],
      syncedAt: now
    })
  );

  // Fetch per-device compliance policy states in batches
  const deviceStates: DeviceComplianceStateRow[] = [];
  const BATCH_SIZE = 20;

  for (let i = 0; i < intuneDeviceIds.length; i += BATCH_SIZE) {
    const batch = intuneDeviceIds.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (deviceId) => {
        try {
          const states = await client.getAllPages<GraphDeviceComplianceStateResponse>(
            `/deviceManagement/managedDevices/${deviceId}/deviceCompliancePolicyStates`
          );
          return states.map((s: GraphDeviceComplianceStateResponse) => ({
            id: s.id ?? `${deviceId}-${s.displayName}`,
            device_id: deviceId,
            policy_id: s.settingStates?.[0]?.policyId ?? s.id ?? "unknown",
            policy_name: s.displayName ?? null,
            state: s.state ?? "unknown",
            last_reported_at: s.lastReportedDateTime ?? null,
            last_synced_at: now
          }));
        } catch {
          return [];
        }
      })
    );
    deviceStates.push(...results.flat());
  }

  return { policies, deviceStates, graphAssignments };
}
