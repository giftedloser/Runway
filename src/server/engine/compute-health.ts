import type { FlagCode, HealthLevel } from "../../shared/types.js";

const severityMap: Record<FlagCode, Exclude<HealthLevel, "healthy" | "unknown">> = {
  no_profile_assigned: "critical",
  profile_assignment_failed: "critical",
  hybrid_join_risk: "critical",
  profile_assigned_not_enrolled: "critical",
  provisioning_stalled: "critical",
  not_in_target_group: "warning",
  user_mismatch: "warning",
  deployment_mode_mismatch: "warning",
  identity_conflict: "warning",
  tag_mismatch: "warning",
  no_autopilot_record: "info",
  orphaned_autopilot: "info",
  missing_ztdid: "info",
  compliance_drift: "info"
};

const severityOrder: HealthLevel[] = ["critical", "warning", "info", "healthy", "unknown"];

export function getFlagSeverity(flag: FlagCode) {
  return severityMap[flag];
}

export function computeOverallHealth(flags: FlagCode[]): HealthLevel {
  if (flags.length === 0) {
    return "healthy";
  }

  for (const severity of severityOrder) {
    if (flags.some((flag) => severityMap[flag] === severity)) {
      return severity;
    }
  }

  return "unknown";
}
