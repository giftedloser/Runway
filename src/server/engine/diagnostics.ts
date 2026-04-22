import type { AssignmentPath, FlagCode, FlagExplanation, MatchConfidence } from "../../shared/types.js";
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
  /** Correlation quality — used to inject caveats on cross-system flags. */
  matchConfidence: MatchConfidence;
  identityConflict: boolean;
}

/**
 * Flags that compare data across Autopilot, Intune, and/or Entra — their
 * diagnostic value is reduced when the records in the bundle may not
 * actually belong to the same physical device.
 */
const CROSS_SYSTEM_FLAGS: Set<FlagCode> = new Set([
  "no_autopilot_record",
  "user_mismatch",
  "hybrid_join_risk",
  "orphaned_autopilot",
  "missing_ztdid",
  "deployment_mode_mismatch",
  "profile_assigned_not_enrolled",
  "provisioning_stalled",
  "not_in_target_group",
  "tag_mismatch"
]);

function buildCaveat(context: DiagnosticContext, code: FlagCode): string | null {
  if (!CROSS_SYSTEM_FLAGS.has(code)) return null;
  if (context.identityConflict) {
    return "Identity conflict detected on this device. The records this flag compares may not belong to the same physical device — verify the correlation before acting on this diagnostic.";
  }
  if (context.matchConfidence === "low") {
    return "This device's records were correlated by display name only (low confidence). The flag may be a false positive if the records do not actually represent the same physical device.";
  }
  return null;
}

const flagCopy: Record<
  FlagCode,
  (context: DiagnosticContext) => Omit<FlagExplanation, "code" | "severity" | "caveat">
> = {
  no_autopilot_record: (context) => ({
    title: "No Autopilot Record",
    summary: "Device is managed in Intune but has no Autopilot registration record.",
    whyItMatters: "This usually means the device enrolled outside the intended provisioning pipeline. Without an Autopilot record the device cannot receive a deployment profile or follow the intended provisioning flow.",
    checks: [
      "Confirm the hardware hash was imported — export the hash from the device (Get-WindowsAutopilotInfo) and check the Autopilot devices list in Intune.",
      "Check whether the device was manually enrolled via Company Portal or bulk enrollment token instead of OOBE.",
      "If the device was recently reimaged, the old Autopilot object may have been deleted — re-import the hardware hash.",
      "Verify the OEM or reseller registered the device if it was pre-provisioned."
    ],
    rawData: [`device=${context.deviceName ?? "unknown"}`, `serial=${context.serialNumber ?? "unknown"}`]
  }),
  no_profile_assigned: (context) => ({
    title: "No Profile Assigned",
    summary: "Autopilot identity exists, but no deployment profile is assigned.",
    whyItMatters: "Provisioning cannot continue without a deployment profile. The device will either skip Autopilot entirely or show a generic OOBE experience.",
    checks: [
      "Verify the device is a member of a group that is targeted by an Autopilot deployment profile.",
      "If using dynamic groups, check the membership rule evaluates correctly for this device's properties (serial, group tag, etc.).",
      "Confirm the deployment profile exists and is assigned to at least one group in Intune → Devices → Enrollment → Deployment profiles.",
      "Allow up to 30 minutes for dynamic group evaluation and profile assignment to propagate after device import."
    ],
    rawData: [`groupTag=${context.groupTag ?? "none"}`, `breakPoint=${context.assignmentPath.breakPoint ?? "none"}`]
  }),
  profile_assignment_failed: (context) => ({
    title: "Profile Assignment Failed",
    summary: `Profile assignment status is "${context.profileAssignmentStatus ?? "unknown"}" instead of "assigned".`,
    whyItMatters: "The device is targeted, but profile evaluation did not complete successfully. Common causes include group processing delays, conflicting profiles, or Graph API transient errors.",
    checks: [
      "Check the profile assignment status in Graph — a status of 'pendingAssignment' may resolve on its own within 30 minutes.",
      "If status is 'assignmentFailed', look for conflicting deployment profiles targeting the same device through different groups.",
      "Verify the dynamic group membership rule is valid — malformed rules silently fail to evaluate.",
      "Try reassigning the profile by removing and re-adding the group assignment in Intune.",
      "Check the Intune service health dashboard for any ongoing incidents affecting profile assignment."
    ],
    rawData: [`profile=${context.assignedProfileName ?? "none"}`, `status=${context.profileAssignmentStatus ?? "unknown"}`]
  }),
  profile_assigned_not_enrolled: (context) => ({
    title: "Profile Assigned, Not Enrolled",
    summary: "A deployment profile is assigned but no Intune enrollment record exists past the threshold.",
    whyItMatters: "The device is likely stuck at OOBE, offline, or otherwise failing to finish enrollment. This is one of the most common Autopilot failure points.",
    checks: [
      "Verify the device is powered on and connected to a network with internet access (no captive portal).",
      "Check for TPM attestation failures — the device may be stuck at the 'Preparing your device' screen. TPM 2.0 is required for Autopilot.",
      "If the device reaches OOBE but spins indefinitely, it may be failing the Autopilot profile download. Ensure *.manage.microsoft.com and login.microsoftonline.com are reachable.",
      "For user-driven mode: verify the user can sign in — expired passwords or MFA issues block enrollment.",
      "For self-deploying mode: confirm the device has TPM 2.0 attestation capability (not all VMs support this).",
      "Try a fresh OOBE reset: Shift+F10 → 'sysprep /oobe /reboot' or a full device wipe."
    ],
    rawData: [`profile=${context.assignedProfileName ?? "none"}`, `lastCheckin=${context.lastCheckinAt ?? "none"}`]
  }),
  not_in_target_group: (context) => ({
    title: "Not In Target Group",
    summary: "The device is missing from one or more groups that should drive profile assignment.",
    whyItMatters: "Without the right group membership, the profile chain breaks before deployment mode is resolved. This is the most common root cause when a device has an Autopilot record but no profile.",
    checks: [
      "Check the expected group's membership rule — for dynamic groups, the device must match the rule criteria (e.g., orderid/group tag).",
      "Verify the Autopilot group tag matches the dynamic membership rule expression exactly (case-sensitive in some rule syntaxes).",
      "For assigned groups, manually add the device if it was missed during provisioning setup.",
      "Dynamic group evaluation can take up to 30 minutes — check the group's processing state in Entra ID → Groups."
    ],
    rawData: [`groupTag=${context.groupTag ?? "none"}`, `breakPoint=${context.assignmentPath.breakPoint ?? "none"}`]
  }),
  deployment_mode_mismatch: (context) => ({
    title: "Deployment Mode Mismatch",
    summary: "Deployment mode signals disagree across the effective profile and assignment context.",
    whyItMatters: "Conflicting user-driven and self-deploying intent can break Autopilot behavior. A device receiving both modes may stall at OOBE or enroll with the wrong experience.",
    checks: [
      "Check whether multiple deployment profiles target the device through different groups — profile priority conflicts cause unpredictable mode selection.",
      "Confirm the intended deployment mode for this device's use case (user-driven for personal devices, self-deploying for shared/kiosk).",
      "If the device should be self-deploying, ensure it is not also a member of a group targeted by a user-driven profile.",
      "Review the Autopilot deployment profile's OOBE settings — a mismatch between 'user account type' and deployment mode indicates a configuration error."
    ],
    rawData: [`profile=${context.assignedProfileName ?? "none"}`, `effectiveMode=${context.assignmentPath.effectiveMode ?? "none"}`]
  }),
  hybrid_join_risk: (context) => ({
    title: "Hybrid Join Risk",
    summary: `Profile expects hybrid join but Entra trust type is "${context.trustType ?? "missing"}".`,
    whyItMatters: "Hybrid Azure AD join problems are among the hardest Autopilot failures to diagnose. The device must reach an on-prem domain controller, and the Intune Connector for AD must be healthy.",
    checks: [
      "Confirm the Intune Connector for Active Directory is online and healthy in the Intune portal → Tenant admin → Connectors.",
      "Check that the device can reach an on-premises domain controller (VPN or direct line-of-sight required during OOBE).",
      "Verify the target Organizational Unit (OU) in the deployment profile is valid and the connector service account has write permissions.",
      "Review the ODJ (Offline Domain Join) blob — errors here indicate the connector failed to pre-create the computer object.",
      "If the device is remote, consider switching to cloud-native Azure AD join instead of hybrid."
    ],
    rawData: [`trustType=${context.trustType ?? "missing"}`, `profile=${context.assignedProfileName ?? "none"}`]
  }),
  user_mismatch: (context) => ({
    title: "User Assignment Mismatch",
    summary: "Autopilot assigned user and Intune primary user do not match.",
    whyItMatters: "Mismatched user ownership causes app and policy targeting to follow the wrong user — the device may receive the wrong set of apps or compliance policies.",
    checks: [
      "Confirm the intended primary user — the Autopilot assigned user is set at import time, while the Intune primary user is typically set at enrollment.",
      "If the device was reassigned to a different user, update the Autopilot assigned user to match or clear it.",
      "Check if user affinity changed after the original enrollment — Company Portal sign-in can silently change the primary user.",
      "For shared devices, the primary user should usually be cleared in Intune to prevent user-specific policy targeting."
    ],
    rawData: [
      `autopilotUser=${context.autopilotAssignedUserUpn ?? "none"}`,
      `intuneUser=${context.intunePrimaryUserUpn ?? "none"}`
    ]
  }),
  provisioning_stalled: (context) => ({
    title: "Provisioning Stalled",
    summary: "The device is enrolled but has not checked in within the configured stale window.",
    whyItMatters: "Stale check-ins combined with incomplete provisioning usually indicate the device is stuck at ESP, offline, or encountering a blocking policy/app install.",
    checks: [
      "Trigger a remote sync from Intune to prompt the device to check in.",
      "If the device is physically accessible, check the Enrollment Status Page (ESP) screen for a specific error code or stuck step.",
      "ESP timeout is typically 60 minutes — if the device passed this, it may have exited ESP with errors. Check event logs under Microsoft-Windows-DeviceManagement-Enterprise-Diagnostics-Provider.",
      "Look for blocking app installs — a single required app stuck in 'downloading' state will hold ESP indefinitely.",
      "Verify the device has reliable internet connectivity — intermittent drops during ESP cause retries and eventual timeout."
    ],
    rawData: [`lastCheckin=${context.lastCheckinAt ?? "none"}`, `compliance=${context.complianceState ?? "unknown"}`]
  }),
  compliance_drift: (context) => ({
    title: "Compliance Drift",
    summary: "The device was previously compliant and is now reporting noncompliance.",
    whyItMatters: "Noncompliance can trigger Conditional Access blocks, preventing the user from accessing corporate resources — even if Autopilot provisioning originally succeeded.",
    checks: [
      "Open the device compliance report in Intune → Devices → select device → Device compliance to see which specific policy failed.",
      "Review recent compliance policy changes — a newly deployed policy may have moved previously-compliant devices into noncompliance.",
      "Check if the device missed a check-in and its compliance grace period expired.",
      "For BitLocker or encryption policies, verify the TPM is healthy and encryption completed successfully."
    ],
    rawData: [`compliance=${context.complianceState ?? "unknown"}`]
  }),
  orphaned_autopilot: (context) => ({
    title: "Orphaned Autopilot Record",
    summary: "Autopilot registration exists without a matching Intune device record.",
    whyItMatters: "This often indicates a staged device that never enrolled, or a stale Autopilot object remaining after a wipe/reimage where the Intune record was cleaned up but the Autopilot record was not.",
    checks: [
      "Check whether the device has ever completed enrollment — if never enrolled, the hardware hash may be imported but the device was never powered on at OOBE.",
      "If the device was reimaged or wiped, the old Intune record may have been deleted but the Autopilot record persists — delete and re-import the hash if needed.",
      "For pre-provisioned (white glove) devices, the Autopilot record exists before enrollment — this is expected until the user completes OOBE.",
      "Verify the serial number on the Autopilot record matches the actual device — OEM registration errors can create mismatched records."
    ],
    rawData: [`serial=${context.serialNumber ?? "unknown"}`, `profile=${context.assignedProfileName ?? "none"}`]
  }),
  missing_ztdid: (context) => ({
    title: "Missing ZTDId",
    summary: "The Entra device physical IDs do not contain a ZTDId marker.",
    whyItMatters: "The ZTDId (Zero-Touch Device ID) links the Entra device object back to the Autopilot identity. Without it, the device may not be recognized as an Autopilot device by policies that depend on this attribute.",
    checks: [
      "Confirm the device was imported into Autopilot — the ZTDId is stamped on the Entra object during Autopilot registration.",
      "If the device was manually enrolled (not via Autopilot OOBE), the ZTDId will not be set. Import the hardware hash and reset the device to trigger Autopilot.",
      "Inspect the Entra device's physicalIds array in Graph Explorer — look for an entry prefixed with '[ZTDID]:'.",
      "A missing ZTDId on a device that should be Autopilot-managed suggests the Autopilot record and Entra object may not be linked correctly."
    ],
    rawData: [`entraTrustType=${context.trustType ?? "unknown"}`]
  }),
  identity_conflict: (context) => ({
    title: "Identity Conflict",
    summary: "Cross-system identifiers disagree, which points to duplicate or stale device records.",
    whyItMatters: "Identity conflicts make all cross-system diagnostics unreliable. Profile, user, and compliance flags may be false positives if the correlated records belong to different physical devices.",
    checks: [
      "Compare the Entra device object IDs reported by Autopilot, Intune, and Entra — they should all reference the same object.",
      "Check for stale records after a device reimage — the old Intune/Entra record may still exist alongside the new one.",
      "If duplicate Autopilot records exist for the same serial number, delete the stale one in Intune → Devices → Enrollment → Autopilot devices.",
      "After resolving the conflict, trigger a Runway sync to re-correlate the device."
    ],
    rawData: [`serial=${context.serialNumber ?? "unknown"}`, `device=${context.deviceName ?? "unknown"}`]
  }),
  tag_mismatch: (context) => ({
    title: "Tag Mismatch",
    summary: "The Autopilot group tag does not line up with the actual profile or group targeting.",
    whyItMatters: "Group tags drive dynamic group membership which drives profile assignment. A wrong tag sends the device down the wrong provisioning path — it may receive the wrong deployment profile, apps, and policies.",
    checks: [
      "Verify the group tag set on the Autopilot device in Intune → Devices → Enrollment → Autopilot devices.",
      "Compare the tag against the Runway tag configuration — ensure the tag maps to the correct property, profile, and group.",
      "If the tag was set by the OEM or reseller, confirm it matches your naming convention exactly (tags are case-sensitive in dynamic group rules).",
      "To fix: update the group tag on the Autopilot device, wait for dynamic group re-evaluation (~30 min), then verify profile assignment updates."
    ],
    rawData: [`groupTag=${context.groupTag ?? "none"}`, `profile=${context.assignedProfileName ?? "none"}`]
  })
};

export function buildFlagExplanations(flags: FlagCode[], context: DiagnosticContext): FlagExplanation[] {
  return flags.map((code) => ({
    code,
    severity: getFlagSeverity(code),
    ...flagCopy[code](context),
    caveat: buildCaveat(context, code)
  }));
}

export function generateDiagnosis(flags: FlagCode[], context: DiagnosticContext) {
  const first = flags[0];

  if (!first) {
    return "Device is healthy. Profile applied, enrollment completed, and no active provisioning flags are present.";
  }

  return buildFlagExplanations([first], context)[0].summary;
}
