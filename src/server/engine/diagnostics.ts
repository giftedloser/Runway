import type { AssignmentPath, FlagCode, FlagExplanation } from "../../shared/types.js";
import { getFlagSeverity } from "./compute-health.js";

interface DiagnosticContext {
  deviceName: string | null;
  serialNumber: string | null;
  trustType: string | null;
  groupTag: string | null;
  assignedProfileName: string | null;
  profileAssignmentStatus: string | null;
  autopilotAssignedUserUpn: string | null;
  intunePrimaryUserUpn: string | null;
  assignmentPath: AssignmentPath;
  lastCheckinAt: string | null;
  complianceState: string | null;
}

const flagCopy: Record<
  FlagCode,
  (context: DiagnosticContext) => Omit<FlagExplanation, "code" | "severity">
> = {
  no_autopilot_record: (context) => ({
    title: "No Autopilot Record",
    summary: "Device is managed in Intune but has no Autopilot registration record.",
    whyItMatters: "This usually means the device enrolled outside the intended provisioning pipeline.",
    checks: ["Confirm the hardware hash was imported.", "Check whether the device was manually enrolled."],
    rawData: [`device=${context.deviceName ?? "unknown"}`, `serial=${context.serialNumber ?? "unknown"}`]
  }),
  no_profile_assigned: (context) => ({
    title: "No Profile Assigned",
    summary: "Autopilot identity exists, but no deployment profile is assigned.",
    whyItMatters: "Provisioning cannot continue without a deployment profile.",
    checks: ["Check profile group targeting.", "Verify the device is in the expected Autopilot groups."],
    rawData: [`groupTag=${context.groupTag ?? "none"}`, `breakPoint=${context.assignmentPath.breakPoint ?? "none"}`]
  }),
  profile_assignment_failed: (context) => ({
    title: "Profile Assignment Failed",
    summary: `Profile assignment status is ${context.profileAssignmentStatus ?? "unknown"} instead of assigned.`,
    whyItMatters: "The device is targeted, but profile evaluation did not complete successfully.",
    checks: ["Check profile assignment status in Graph.", "Inspect dynamic group processing state."],
    rawData: [`profile=${context.assignedProfileName ?? "none"}`, `status=${context.profileAssignmentStatus ?? "unknown"}`]
  }),
  profile_assigned_not_enrolled: (context) => ({
    title: "Profile Assigned, Not Enrolled",
    summary: "A deployment profile is assigned but no Intune enrollment record exists past the threshold.",
    whyItMatters: "The device is likely stuck at OOBE, offline, or otherwise failing to finish enrollment.",
    checks: ["Verify the device is powered on.", "Check network access during OOBE.", "Force another provisioning attempt."],
    rawData: [`profile=${context.assignedProfileName ?? "none"}`, `lastCheckin=${context.lastCheckinAt ?? "none"}`]
  }),
  not_in_target_group: (context) => ({
    title: "Not In Target Group",
    summary: "The device is missing from one or more groups that should drive profile assignment.",
    whyItMatters: "Without the right group membership, the profile chain breaks before deployment mode is resolved.",
    checks: ["Verify the expected group exists.", "Validate group membership rules and tag mappings."],
    rawData: [`groupTag=${context.groupTag ?? "none"}`, `breakPoint=${context.assignmentPath.breakPoint ?? "none"}`]
  }),
  deployment_mode_mismatch: (context) => ({
    title: "Deployment Mode Mismatch",
    summary: "Deployment mode signals disagree across the effective profile and assignment context.",
    whyItMatters: "Conflicting user-driven and self-deploying intent can break Autopilot behavior.",
    checks: ["Check whether multiple profiles target the device.", "Confirm whether this device should be self-deploying."],
    rawData: [`profile=${context.assignedProfileName ?? "none"}`, `effectiveMode=${context.assignmentPath.effectiveMode ?? "none"}`]
  }),
  hybrid_join_risk: (context) => ({
    title: "Hybrid Join Risk",
    summary: `Profile expects hybrid join but Entra trust type is ${context.trustType ?? "missing"}.`,
    whyItMatters: "Hybrid join problems usually stall provisioning until AD and connector prerequisites are fixed.",
    checks: ["Confirm Intune Connector for AD health.", "Check on-prem network and domain controller reachability.", "Verify target OU configuration."],
    rawData: [`trustType=${context.trustType ?? "missing"}`, `profile=${context.assignedProfileName ?? "none"}`]
  }),
  user_mismatch: (context) => ({
    title: "User Assignment Mismatch",
    summary: "Autopilot assigned user and Intune primary user do not match.",
    whyItMatters: "Mismatched user ownership often explains app and policy targeting drift.",
    checks: ["Confirm the intended primary user.", "Check whether reassignment happened after enrollment."],
    rawData: [
      `autopilotUser=${context.autopilotAssignedUserUpn ?? "none"}`,
      `intuneUser=${context.intunePrimaryUserUpn ?? "none"}`
    ]
  }),
  provisioning_stalled: (context) => ({
    title: "Provisioning Stalled",
    summary: "The device is enrolled but has not checked in within the configured stale window.",
    whyItMatters: "Stale check-ins combined with incomplete provisioning usually indicate the device is stuck or offline.",
    checks: ["Trigger a sync after the device comes online.", "Inspect local Autopilot and ESP state."],
    rawData: [`lastCheckin=${context.lastCheckinAt ?? "none"}`, `compliance=${context.complianceState ?? "unknown"}`]
  }),
  compliance_drift: (context) => ({
    title: "Compliance Drift",
    summary: "The device was previously compliant and is now reporting noncompliance.",
    whyItMatters: "This can change targeting or block access even if Autopilot originally succeeded.",
    checks: ["Open the device compliance report in Intune.", "Review recent policy changes."],
    rawData: [`compliance=${context.complianceState ?? "unknown"}`]
  }),
  orphaned_autopilot: (context) => ({
    title: "Orphaned Autopilot Record",
    summary: "Autopilot registration exists without a matching Intune device record.",
    whyItMatters: "This often indicates a staged device that never enrolled or a stale Autopilot object after reimaging.",
    checks: ["Check whether the device has ever completed enrollment.", "Confirm the Autopilot object is still valid."],
    rawData: [`serial=${context.serialNumber ?? "unknown"}`, `profile=${context.assignedProfileName ?? "none"}`]
  }),
  missing_ztdid: (context) => ({
    title: "Missing ZTDId",
    summary: "The Entra device physical IDs do not contain a ZTDId marker.",
    whyItMatters: "That usually indicates the device is missing an Autopilot identity marker.",
    checks: ["Confirm the device was imported into Autopilot.", "Inspect the Entra device physical IDs in Graph."],
    rawData: [`entraTrustType=${context.trustType ?? "unknown"}`]
  }),
  identity_conflict: (context) => ({
    title: "Identity Conflict",
    summary: "Cross-system identifiers disagree, which points to duplicate or stale device records.",
    whyItMatters: "Identity conflicts make profile and user diagnostics unreliable until the stale object is removed.",
    checks: ["Compare Entra object IDs across systems.", "Check for stale Intune or Autopilot records after reimage."],
    rawData: [`serial=${context.serialNumber ?? "unknown"}`, `device=${context.deviceName ?? "unknown"}`]
  }),
  tag_mismatch: (context) => ({
    title: "Tag Mismatch",
    summary: "The Autopilot group tag does not line up with the actual profile or group targeting.",
    whyItMatters: "This is an early warning that the device is being steered to the wrong property or deployment flow.",
    checks: ["Verify the imported group tag.", "Compare tag config against profile and group names."],
    rawData: [`groupTag=${context.groupTag ?? "none"}`, `profile=${context.assignedProfileName ?? "none"}`]
  })
};

export function buildFlagExplanations(flags: FlagCode[], context: DiagnosticContext): FlagExplanation[] {
  return flags.map((code) => ({
    code,
    severity: getFlagSeverity(code),
    ...flagCopy[code](context)
  }));
}

export function generateDiagnosis(flags: FlagCode[], context: DiagnosticContext) {
  const first = flags[0];

  if (!first) {
    return "Device is healthy. Profile applied, enrollment completed, and no active provisioning flags are present.";
  }

  return buildFlagExplanations([first], context)[0].summary;
}
