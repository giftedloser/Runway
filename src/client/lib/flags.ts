import type { FlagCode, HealthLevel } from "./types.js";

interface FlagInfo {
  label: string;
  description: string;
  severity: Exclude<HealthLevel, "healthy" | "unknown">;
}

/**
 * Human-readable metadata for every diagnostic flag the state engine
 * can emit. Keeping this client-side means the UI can show useful
 * tooltips and copy without round-tripping to the server.
 */
export const FLAG_INFO: Record<FlagCode, FlagInfo> = {
  no_autopilot_record: {
    label: "No Autopilot record",
    description:
      "Device is managed but has no matching Autopilot registration. This is a coverage gap unless the device is expected to use Autopilot.",
    severity: "info"
  },
  no_profile_assigned: {
    label: "No profile assigned",
    description:
      "Device is enrolled but no Autopilot profile has been assigned. OOBE will not customize or join correctly.",
    severity: "critical"
  },
  profile_assignment_failed: {
    label: "Profile assignment failed",
    description:
      "Intune reports that profile assignment failed for this device. Check assignment status in MEM admin center.",
    severity: "critical"
  },
  profile_assigned_not_enrolled: {
    label: "Assigned, not enrolled",
    description:
      "A profile has been assigned but the device has not completed Intune enrollment yet. Often a transient state.",
    severity: "critical"
  },
  not_in_target_group: {
    label: "Not in target group",
    description:
      "Device is not a member of the Entra group that targets its expected profile. Dynamic-membership rule may not match.",
    severity: "warning"
  },
  deployment_mode_mismatch: {
    label: "Deployment mode mismatch",
    description:
      "Effective deployment mode does not match what the profile specifies. Result: wrong OOBE experience.",
    severity: "warning"
  },
  hybrid_join_risk: {
    label: "Hybrid join risk",
    description:
      "Profile expects Hybrid Azure AD Join but trust type or join state does not line up. Provisioning will usually stall.",
    severity: "critical"
  },
  user_mismatch: {
    label: "User mismatch",
    description:
      "Assigned Autopilot user does not match the Intune primary user. Often the result of a re-used or retired device.",
    severity: "warning"
  },
  provisioning_stalled: {
    label: "Provisioning stalled",
    description:
      "Device started provisioning but has not completed within the configured SLA window. Often requires manual triage.",
    severity: "critical"
  },
  compliance_drift: {
    label: "Compliance drift",
    description:
      "Device has dropped out of compliance since its last healthy state. Expect reduced Conditional Access posture.",
    severity: "warning"
  },
  orphaned_autopilot: {
    label: "Orphaned Autopilot",
    description:
      "Autopilot record exists but the corresponding Intune enrollment is missing. This may be staged, retired, or waiting for enrollment.",
    severity: "info"
  },
  missing_ztdid: {
    label: "Missing ZTDID",
    description:
      "Device lacks the ZTDID attribute that ties it back to Autopilot. Treat as informational unless Autopilot is expected.",
    severity: "info"
  },
  identity_conflict: {
    label: "Verify identity",
    description:
      "Two or more systems reference this device with conflicting identifiers. Verify identity before trusting other diagnostics.",
    severity: "critical"
  },
  tag_mismatch: {
    label: "Tag mismatch",
    description:
      "Group tag does not match the configured tag mapping for this property. Targeting will not resolve to the expected profile.",
    severity: "warning"
  }
};

/**
 * Humanize a flag code without needing a full `FLAG_INFO` lookup.
 * Falls back to a prettified version of the raw code if unknown.
 */
export function humanizeFlag(flag: string): string {
  const info = (FLAG_INFO as Record<string, FlagInfo | undefined>)[flag];
  if (info) return info.label;
  return flag.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function describeFlag(flag: string): string | null {
  const info = (FLAG_INFO as Record<string, FlagInfo | undefined>)[flag];
  return info?.description ?? null;
}
