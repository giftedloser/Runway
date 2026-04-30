import type Database from "better-sqlite3";

import type { AssignmentPath, FlagCode, TagConfigRecord } from "../../shared/types.js";
import { loadStateEngineInput, replaceDeviceStates } from "../db/queries/devices.js";
import { listRules } from "../db/queries/rules.js";
import { getAppSettingValues } from "../settings/app-settings.js";
import type { GroupRow, ProfileRow } from "../db/types.js";
import { computeOverallHealth } from "./compute-health.js";
import { hasConfigMgrClient } from "./config-mgr.js";
import { correlateDevices } from "./correlate.js";
import { buildFlagExplanations, generateDiagnosis } from "./diagnostics.js";
import { evaluateRules, type RuleContext } from "./evaluate-rules.js";
import { asArray, normalizeString } from "./normalize.js";

const diagnosisOrder: FlagCode[] = [
  "no_profile_assigned",
  "profile_assignment_failed",
  "hybrid_join_risk",
  "profile_assigned_not_enrolled",
  "provisioning_stalled",
  "not_in_target_group",
  "deployment_mode_mismatch",
  "user_mismatch",
  "tag_mismatch",
  "identity_conflict",
  "orphaned_autopilot",
  "no_autopilot_record",
  "missing_ztdid",
  "compliance_drift"
];

function isOlderThan(isoString: string | null | undefined, hours: number) {
  if (!isoString) {
    return false;
  }

  const date = new Date(isoString);
  return Date.now() - date.getTime() > hours * 60 * 60 * 1000;
}

function firstOf<T>(values: T[]) {
  return values[0] ?? null;
}

export function computeAllDeviceStates(db: Database.Database) {
  const input = loadStateEngineInput(db);
  const rules = listRules(db);
  const appSettings = getAppSettingValues(db);
  const correlations = correlateDevices(input);
  const previousByKey = new Map(input.previousStates.map((row) => [row.device_key, row]));
  const previousBySerial = new Map(
    input.previousStates
      .filter((row) => row.serial_number)
      .map((row) => [row.serial_number as string, row])
  );

  const tagConfigByTag = new Map<string, TagConfigRecord>(
    input.tagConfigRows.map((row) => [
      row.group_tag,
      {
        groupTag: row.group_tag,
        expectedProfileNames: asArray(row.expected_profile_names),
        expectedGroupNames: asArray(row.expected_group_names),
        propertyLabel: row.property_label
      }
    ])
  );

  const groupById = new Map(input.groupRows.map((row) => [row.id, row]));
  const groupByName = new Map(input.groupRows.map((row) => [row.display_name, row]));
  const profileById = new Map(input.profileRows.map((row) => [row.id, row]));
  const profileByName = new Map(input.profileRows.map((row) => [row.display_name, row]));

  const membershipsByDevice = new Map<string, string[]>();
  for (const row of input.membershipRows) {
    const current = membershipsByDevice.get(row.member_device_id) ?? [];
    current.push(row.group_id);
    membershipsByDevice.set(row.member_device_id, current);
  }

  const assignmentsByGroup = new Map<string, string[]>();
  for (const row of input.profileAssignmentRows) {
    const current = assignmentsByGroup.get(row.group_id) ?? [];
    current.push(row.profile_id);
    assignmentsByGroup.set(row.group_id, current);
  }

  const computedRows = correlations.map((bundle) => {
    const resolvedEntraId =
      bundle.entraRecord?.id ??
      normalizeString(bundle.autopilotRecord?.entra_device_id) ??
      normalizeString(bundle.intuneRecord?.entra_device_id);
    const groupIds = resolvedEntraId ? membershipsByDevice.get(resolvedEntraId) ?? [] : [];
    const memberGroups = groupIds
      .map((groupId) => groupById.get(groupId))
      .filter(Boolean) as GroupRow[];
    const candidateProfiles = [...new Set(groupIds.flatMap((groupId) => assignmentsByGroup.get(groupId) ?? []))]
      .map((profileId) => profileById.get(profileId))
      .filter(Boolean) as ProfileRow[];

    const groupTag = bundle.autopilotRecord?.group_tag ?? null;
    const tagConfig = groupTag ? tagConfigByTag.get(groupTag) ?? null : null;
    const expectedGroupRows = (tagConfig?.expectedGroupNames ?? [])
      .map((name) => groupByName.get(name))
      .filter(Boolean) as GroupRow[];
    const actualGroupNameSet = new Set(memberGroups.map((group) => group.display_name));
    const expectedProfileSet = new Set(tagConfig?.expectedProfileNames ?? []);

    const actualProfile =
      (bundle.autopilotRecord?.deployment_profile_id
        ? profileById.get(bundle.autopilotRecord.deployment_profile_id)
        : null) ??
      (bundle.autopilotRecord?.deployment_profile_name
        ? profileByName.get(bundle.autopilotRecord.deployment_profile_name)
        : null) ??
      firstOf(candidateProfiles);

    const assignedViaGroup = actualProfile
      ? firstOf(
          groupIds.filter((groupId) =>
            (assignmentsByGroup.get(groupId) ?? []).includes(actualProfile.id)
          )
        )
      : null;

    const effectiveMode =
      actualProfile?.deployment_mode ??
      bundle.autopilotRecord?.deployment_mode ??
      null;
    // Hybrid join detection: prefer the structured profile flag, then
    // deployment mode enums ("hybridAzureADJoined", "hybridAADJoined"),
    // and only as a last resort fall back to a word-boundary match on
    // the display name so that a profile called "HybridTest" or
    // "Win11-NotHybrid-v2" does not produce false positives.
    const deploymentModeLower = (
      actualProfile?.deployment_mode ??
      bundle.autopilotRecord?.deployment_mode ??
      ""
    ).toLowerCase();
    const deploymentModeSaysHybrid =
      deploymentModeLower.includes("hybrid") && deploymentModeLower.includes("aad");
    const profileNameSaysHybrid = /\bhybrid\b/i.test(actualProfile?.display_name ?? "");
    const hybridJoinConfigured =
      Boolean(actualProfile?.hybrid_join_config) ||
      deploymentModeSaysHybrid ||
      profileNameSaysHybrid;

    const targetingGroups: AssignmentPath["targetingGroups"] = [];
    const seenGroupIds = new Set<string>();
    for (const group of [...expectedGroupRows, ...memberGroups]) {
      if (seenGroupIds.has(group.id)) {
        continue;
      }
      seenGroupIds.add(group.id);
      targetingGroups.push({
        groupId: group.id,
        groupName: group.display_name,
        membershipType: group.membership_type === "DynamicMembership" ? "dynamic" : "assigned",
        isProfileSource: (assignmentsByGroup.get(group.id) ?? []).length > 0,
        membershipState: groupIds.includes(group.id) ? "member" : "missing"
      });
    }

    const hasAutopilotRecord = Number(Boolean(bundle.autopilotRecord));
    const hasIntuneRecord = Number(Boolean(bundle.intuneRecord));
    const hasEntraRecord = Number(Boolean(bundle.entraRecord));
    const hasProfileAssigned = Number(
      Boolean(
        actualProfile ||
          bundle.autopilotRecord?.deployment_profile_id ||
          bundle.autopilotRecord?.deployment_profile_name
      )
    );

    const isInCorrectGroup =
      tagConfig?.expectedGroupNames.length
        ? Number(tagConfig.expectedGroupNames.some((name) => actualGroupNameSet.has(name)))
        : 1;

    const breakPoint: AssignmentPath["breakPoint"] =
      !bundle.autopilotRecord
        ? "no_record"
        : targetingGroups.length === 0 || targetingGroups.every((group) => group.membershipState === "missing")
          ? "no_group"
          : !hasProfileAssigned
            ? "no_profile"
            : !effectiveMode
              ? "no_mode"
              : null;

    const assignmentPath: AssignmentPath = {
      autopilotRecord: bundle.autopilotRecord
        ? {
            id: bundle.autopilotRecord.id,
            serial: bundle.autopilotRecord.serial_number,
            groupTag,
            assignedUser: bundle.autopilotRecord.assigned_user_upn
          }
        : null,
      targetingGroups,
      assignedProfile: actualProfile
        ? {
            profileId: actualProfile.id,
            profileName: actualProfile.display_name,
            deploymentMode: actualProfile.deployment_mode,
            assignedViaGroup: assignedViaGroup ? groupById.get(assignedViaGroup)?.display_name ?? assignedViaGroup : null
          }
        : null,
      effectiveMode,
      chainComplete: breakPoint === null,
      breakPoint
    };

    const previous =
      previousByKey.get(bundle.deviceKey) ??
      (bundle.serialNumber ? previousBySerial.get(bundle.serialNumber) : undefined);
    const userAssignmentMatch =
      bundle.autopilotRecord?.assigned_user_upn && bundle.intuneRecord?.primary_user_upn
        ? Number(
            bundle.autopilotRecord.assigned_user_upn.toLowerCase() ===
              bundle.intuneRecord.primary_user_upn.toLowerCase()
          )
        : null;

    const normalizedTrust = normalizeString(bundle.entraRecord?.trust_type);
    const ztdIds = asArray(bundle.entraRecord?.device_physical_ids);
    const missingZtdid = Number(
      Boolean(bundle.entraRecord) && !ztdIds.some((entry) => entry.includes("ZTDID"))
    );
    const conflictingModes = new Set(
      candidateProfiles.map((profile) => normalizeString(profile.deployment_mode)).filter(Boolean)
    );
    const tagMismatch = Number(
      Boolean(tagConfig) &&
        ((actualProfile && expectedProfileSet.size > 0 && !expectedProfileSet.has(actualProfile.display_name)) ||
          (tagConfig?.expectedGroupNames.length && !tagConfig.expectedGroupNames.some((name) => actualGroupNameSet.has(name))))
    );

    const flags = {
      no_autopilot_record: Boolean(bundle.intuneRecord && !bundle.autopilotRecord),
      no_profile_assigned: Boolean(bundle.autopilotRecord && !hasProfileAssigned),
      profile_assignment_failed: Boolean(
        hasProfileAssigned &&
          bundle.autopilotRecord?.profile_assignment_status &&
          bundle.autopilotRecord.profile_assignment_status.toLowerCase() !== "assigned"
      ),
      profile_assigned_not_enrolled: Boolean(
        hasProfileAssigned &&
          !bundle.intuneRecord &&
          isOlderThan(
            bundle.autopilotRecord?.first_profile_assigned_at ??
              bundle.autopilotRecord?.first_seen_at,
            appSettings.profileAssignedNotEnrolledHours
          )
      ),
      not_in_target_group: Boolean(
        bundle.autopilotRecord && tagConfig?.expectedGroupNames.length && !isInCorrectGroup
      ),
      deployment_mode_mismatch: Boolean(
        conflictingModes.size > 1 ||
          (normalizeString(effectiveMode) === "SELFDEPLOYING" &&
            bundle.autopilotRecord?.assigned_user_upn)
      ),
      hybrid_join_risk: Boolean(
        hybridJoinConfigured && normalizedTrust !== "SERVERAD"
      ),
      user_mismatch: userAssignmentMatch === 0,
      provisioning_stalled: Boolean(
        bundle.intuneRecord &&
          isOlderThan(bundle.intuneRecord.last_sync_datetime, appSettings.provisioningStalledHours) &&
          (!assignmentPath.chainComplete ||
            ["unknown", "noncompliant"].includes(
              (bundle.intuneRecord.compliance_state ?? "unknown").toLowerCase()
            ))
      ),
      compliance_drift: Boolean(
        previous?.compliance_state?.toLowerCase() === "compliant" &&
          bundle.intuneRecord?.compliance_state?.toLowerCase() === "noncompliant"
      ),
      orphaned_autopilot: Boolean(bundle.autopilotRecord && !bundle.intuneRecord),
      missing_ztdid: Boolean(missingZtdid),
      identity_conflict: bundle.identityConflict,
      tag_mismatch: Boolean(tagMismatch)
    } satisfies Record<FlagCode, boolean>;

    const activeFlags = diagnosisOrder.filter((flag) => flags[flag]);
    const baseHealth = computeOverallHealth(activeFlags);
    const computedAt = new Date().toISOString();
    const context = {
      deviceName: bundle.intuneRecord?.device_name ?? bundle.entraRecord?.display_name ?? null,
      serialNumber: bundle.serialNumber,
      trustType: bundle.entraRecord?.trust_type ?? null,
      groupTag,
      assignedProfileName:
        actualProfile?.display_name ?? bundle.autopilotRecord?.deployment_profile_name ?? null,
      profileAssignmentStatus: bundle.autopilotRecord?.profile_assignment_status ?? null,
      autopilotAssignedUserUpn: bundle.autopilotRecord?.assigned_user_upn ?? null,
      intunePrimaryUserUpn: bundle.intuneRecord?.primary_user_upn ?? null,
      assignmentPath,
      lastCheckinAt: bundle.intuneRecord?.last_sync_datetime ?? null,
      complianceState: bundle.intuneRecord?.compliance_state ?? null,
      matchConfidence: bundle.matchConfidence,
      identityConflict: bundle.identityConflict
    };
    const diagnostics = buildFlagExplanations(activeFlags, context);
    const diagnosis = generateDiagnosis(activeFlags, context);

    // Custom rule evaluation runs after the built-in flag pass so the
    // rule context can include derived state like assignment chain
    // completeness and the resolved property label.
    const ruleContext: RuleContext = {
      deviceName: context.deviceName,
      serialNumber: context.serialNumber,
      propertyLabel: tagConfig?.propertyLabel ?? groupTag ?? null,
      groupTag,
      assignedProfileName: context.assignedProfileName,
      profileAssignmentStatus: context.profileAssignmentStatus,
      autopilotAssignedUserUpn: context.autopilotAssignedUserUpn,
      intunePrimaryUserUpn: context.intunePrimaryUserUpn,
      lastCheckinAt: context.lastCheckinAt,
      complianceState: context.complianceState,
      trustType: context.trustType,
      deploymentMode: effectiveMode,
      hasAutopilotRecord: Boolean(hasAutopilotRecord),
      hasIntuneRecord: Boolean(hasIntuneRecord),
      hasEntraRecord: Boolean(hasEntraRecord),
      hybridJoinConfigured,
      assignmentChainComplete: assignmentPath.chainComplete,
      assignmentBreakPoint: assignmentPath.breakPoint,
      flagCount: activeFlags.length,
      osVersion: bundle.intuneRecord?.os_version ?? null,
      managementAgent: bundle.intuneRecord?.management_agent ?? null,
      hasConfigMgrClient: hasConfigMgrClient(bundle.intuneRecord?.management_agent)
    };
    const ruleViolations = evaluateRules(rules, ruleContext);
    const ruleSeverities = new Set(ruleViolations.map((v) => v.severity));
    const ruleHealth = ruleSeverities.has("critical")
      ? "critical"
      : ruleSeverities.has("warning")
        ? "warning"
        : ruleSeverities.has("info")
          ? "info"
          : "healthy";
    // Take the worst of (built-in flags) and (custom rule violations).
    const healthRank = { healthy: 0, info: 1, warning: 2, critical: 3, unknown: 0 } as const;
    const overallHealth =
      healthRank[ruleHealth] > healthRank[baseHealth] ? ruleHealth : baseHealth;

    return {
      device_key: bundle.deviceKey,
      serial_number: bundle.serialNumber,
      autopilot_id: bundle.autopilotRecord?.id ?? null,
      intune_id: bundle.intuneRecord?.id ?? null,
      entra_id: bundle.entraRecord?.id ?? normalizeString(bundle.autopilotRecord?.entra_device_id) ?? normalizeString(bundle.intuneRecord?.entra_device_id) ?? null,
      device_name: context.deviceName,
      property_label: tagConfig?.propertyLabel ?? groupTag ?? null,
      group_tag: groupTag,
      assigned_profile_name: context.assignedProfileName,
      autopilot_assigned_user_upn: context.autopilotAssignedUserUpn,
      intune_primary_user_upn: context.intunePrimaryUserUpn,
      last_checkin_at: context.lastCheckinAt,
      trust_type: context.trustType,
      has_autopilot_record: hasAutopilotRecord,
      has_intune_record: hasIntuneRecord,
      has_entra_record: hasEntraRecord,
      has_profile_assigned: hasProfileAssigned,
      profile_assignment_status: context.profileAssignmentStatus,
      is_in_correct_group: isInCorrectGroup,
      deployment_mode: effectiveMode,
      deployment_mode_mismatch: Number(flags.deployment_mode_mismatch),
      hybrid_join_configured: Number(hybridJoinConfigured),
      hybrid_join_risk: Number(flags.hybrid_join_risk),
      user_assignment_match: userAssignmentMatch,
      compliance_state: context.complianceState,
      provisioning_stalled: Number(flags.provisioning_stalled),
      tag_mismatch: Number(flags.tag_mismatch),
      assignment_path: JSON.stringify({
        ...assignmentPath,
        diagnostics
      }),
      assignment_chain_complete: Number(assignmentPath.chainComplete),
      assignment_break_point: assignmentPath.breakPoint,
      active_flags: JSON.stringify(activeFlags),
      flag_count: activeFlags.length,
      overall_health: overallHealth,
      diagnosis,
      match_confidence: bundle.matchConfidence,
      matched_on: bundle.matchedOn,
      identity_conflict: Number(bundle.identityConflict),
      active_rule_ids: JSON.stringify(ruleViolations.map((v) => v.ruleId)),
      computed_at: computedAt
    };
  });

  replaceDeviceStates(db, computedRows);
  return computedRows.length;
}
