import type Database from "better-sqlite3";

import type { DeviceListItem, FlagCode, RulePredicate, RuleSeverity } from "../../shared/types.js";
import { hasConfigMgrClient } from "./config-mgr.js";
import { evaluateRules, type RuleContext } from "./evaluate-rules.js";

/**
 * Preview a single predicate against the currently-computed device_state
 * rows without persisting anything. The returned sample is capped to keep
 * the response small; the count is the true total of matches.
 *
 * The preview intentionally uses the same evaluator as the live engine so
 * a "this rule would match N devices" number matches reality once the rule
 * is enabled and the engine reruns.
 */
export interface RulePreviewResult {
  count: number;
  sampleDevices: DeviceListItem[];
  total: number;
}

interface PreviewRow {
  device_key: string;
  serial_number: string | null;
  device_name: string | null;
  property_label: string | null;
  group_tag: string | null;
  assigned_profile_name: string | null;
  autopilot_assigned_user_upn: string | null;
  intune_primary_user_upn: string | null;
  last_checkin_at: string | null;
  trust_type: string | null;
  deployment_mode: string | null;
  compliance_state: string | null;
  profile_assignment_status: string | null;
  has_autopilot_record: number;
  has_intune_record: number;
  has_entra_record: number;
  hybrid_join_configured: number;
  assignment_chain_complete: number;
  assignment_break_point: string | null;
  flag_count: number;
  overall_health: DeviceListItem["health"];
  diagnosis: string | null;
  match_confidence: DeviceListItem["matchConfidence"];
  active_flags: string | null;
  os_version: string | null;
  management_agent: string | null;
}

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function rowToContext(row: PreviewRow): RuleContext {
  return {
    deviceName: row.device_name,
    serialNumber: row.serial_number,
    propertyLabel: row.property_label,
    groupTag: row.group_tag,
    assignedProfileName: row.assigned_profile_name,
    profileAssignmentStatus: row.profile_assignment_status,
    autopilotAssignedUserUpn: row.autopilot_assigned_user_upn,
    intunePrimaryUserUpn: row.intune_primary_user_upn,
    lastCheckinAt: row.last_checkin_at,
    complianceState: row.compliance_state,
    trustType: row.trust_type,
    deploymentMode: row.deployment_mode,
    hasAutopilotRecord: Boolean(row.has_autopilot_record),
    hasIntuneRecord: Boolean(row.has_intune_record),
    hasEntraRecord: Boolean(row.has_entra_record),
    hybridJoinConfigured: Boolean(row.hybrid_join_configured),
    assignmentChainComplete: Boolean(row.assignment_chain_complete),
    assignmentBreakPoint: row.assignment_break_point,
    flagCount: row.flag_count,
    osVersion: row.os_version,
    managementAgent: row.management_agent,
    hasConfigMgrClient: hasConfigMgrClient(row.management_agent)
  };
}

function rowToListItem(row: PreviewRow): DeviceListItem {
  return {
    deviceKey: row.device_key,
    deviceName: row.device_name,
    serialNumber: row.serial_number,
    propertyLabel: row.property_label,
    health: row.overall_health,
    flags: safeJsonParse<FlagCode[]>(row.active_flags, []),
    flagCount: row.flag_count,
    assignedProfileName: row.assigned_profile_name,
    deploymentMode: row.deployment_mode,
    lastCheckinAt: row.last_checkin_at,
    complianceState: row.compliance_state,
    autopilotAssignedUserUpn: row.autopilot_assigned_user_upn,
    intunePrimaryUserUpn: row.intune_primary_user_upn,
    diagnosis: row.diagnosis ?? "",
    matchConfidence: row.match_confidence,
    activeRules: []
  };
}

export function previewRule(
  db: Database.Database,
  predicate: RulePredicate,
  scope: "global" | "property" | "profile" = "global",
  scopeValue: string | null = null,
  severity: RuleSeverity = "warning",
  sampleLimit = 25
): RulePreviewResult {
  const rows = db
    .prepare(
      `SELECT d.device_key, d.serial_number, d.device_name, d.property_label,
              d.group_tag, d.assigned_profile_name, d.autopilot_assigned_user_upn,
              d.intune_primary_user_upn, d.last_checkin_at, d.trust_type,
              d.deployment_mode, d.compliance_state, d.profile_assignment_status,
              d.has_autopilot_record, d.has_intune_record, d.has_entra_record,
              d.hybrid_join_configured, d.assignment_chain_complete,
              d.assignment_break_point, d.flag_count, d.overall_health,
              d.diagnosis, d.match_confidence, d.active_flags,
              i.os_version AS os_version,
              i.management_agent AS management_agent
         FROM device_state d
         LEFT JOIN intune_devices i ON i.id = d.intune_id`
    )
    .all() as PreviewRow[];

  // Fake a single-rule list so we can route through the shared evaluator.
  const fakeRule = {
    id: "__preview__",
    name: "__preview__",
    description: "",
    severity,
    scope,
    scopeValue,
    enabled: true,
    predicate,
    createdAt: "",
    updatedAt: ""
  };

  const matches: PreviewRow[] = [];
  for (const row of rows) {
    const context = rowToContext(row);
    const violations = evaluateRules([fakeRule], context);
    if (violations.length > 0) {
      matches.push(row);
    }
  }

  return {
    count: matches.length,
    total: rows.length,
    sampleDevices: matches.slice(0, sampleLimit).map(rowToListItem)
  };
}
