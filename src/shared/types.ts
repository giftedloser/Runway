export type DeviceKey = string;

export type MatchConfidence = "high" | "medium" | "low";

export type HealthLevel = "critical" | "warning" | "info" | "healthy" | "unknown";

export type FlagCode =
  | "no_autopilot_record"
  | "no_profile_assigned"
  | "profile_assignment_failed"
  | "profile_assigned_not_enrolled"
  | "not_in_target_group"
  | "deployment_mode_mismatch"
  | "hybrid_join_risk"
  | "user_mismatch"
  | "provisioning_stalled"
  | "compliance_drift"
  | "orphaned_autopilot"
  | "missing_ztdid"
  | "identity_conflict"
  | "tag_mismatch";

export interface AssignmentGroupNode {
  groupId: string;
  groupName: string;
  membershipType: "dynamic" | "assigned";
  isProfileSource: boolean;
  membershipState: "member" | "missing";
}

export interface AssignmentPath {
  autopilotRecord: {
    id: string;
    serial: string | null;
    groupTag: string | null;
    assignedUser: string | null;
  } | null;
  targetingGroups: AssignmentGroupNode[];
  assignedProfile: {
    profileId: string;
    profileName: string;
    deploymentMode: string | null;
    assignedViaGroup: string | null;
  } | null;
  effectiveMode: string | null;
  chainComplete: boolean;
  breakPoint: "no_record" | "no_group" | "no_profile" | "no_mode" | null;
}

export interface FlagExplanation {
  code: FlagCode;
  severity: Exclude<HealthLevel, "healthy" | "unknown">;
  title: string;
  summary: string;
  whyItMatters: string;
  checks: string[];
  rawData: string[];
}

export interface DeviceListItem {
  deviceKey: DeviceKey;
  deviceName: string | null;
  serialNumber: string | null;
  propertyLabel: string | null;
  health: HealthLevel;
  flags: FlagCode[];
  flagCount: number;
  assignedProfileName: string | null;
  deploymentMode: string | null;
  lastCheckinAt: string | null;
  complianceState: string | null;
  autopilotAssignedUserUpn: string | null;
  intunePrimaryUserUpn: string | null;
  diagnosis: string;
  matchConfidence: MatchConfidence;
}

export interface DeviceDetailResponse {
  summary: DeviceListItem;
  identity: {
    autopilotId: string | null;
    intuneId: string | null;
    entraId: string | null;
    trustType: string | null;
    matchConfidence: MatchConfidence;
    matchedOn: "serial" | "entra_device_id" | "device_id" | "device_name";
    identityConflict: boolean;
  };
  assignmentPath: AssignmentPath;
  diagnostics: FlagExplanation[];
  sourceRefs: {
    autopilotRawJson: string | null;
    intuneRawJson: string | null;
    entraRawJson: string | null;
  };
}

export interface DashboardResponse {
  lastSync: string | null;
  counts: Record<HealthLevel, number>;
  failurePatterns: Array<{
    flag: FlagCode;
    count: number;
    severity: Exclude<HealthLevel, "healthy" | "unknown">;
  }>;
  driftCount: number;
}

export interface ProfileAuditSummary {
  profileId: string;
  profileName: string;
  deploymentMode: string | null;
  hybridJoinConfigured: boolean;
  oobeSummary: string[];
  targetingGroups: Array<{
    groupId: string;
    groupName: string;
    membershipType: "dynamic" | "assigned";
    memberCount: number;
    membershipRule: string | null;
  }>;
  counts: Record<HealthLevel, number>;
  assignedDevices: number;
  missingAssignmentCount: number;
  tagMismatchCount: number;
}

export interface ProfileAuditDetail extends ProfileAuditSummary {
  deviceBreakdown: DeviceListItem[];
}

export interface SyncLogEntry {
  id: number;
  syncType: "full" | "incremental" | "manual";
  startedAt: string;
  completedAt: string | null;
  devicesSynced: number;
  errors: string[];
}

export interface SyncStatusResponse {
  inProgress: boolean;
  currentSyncType: "full" | "manual" | null;
  startedAt: string | null;
  lastCompletedAt: string | null;
  lastSyncType: "full" | "incremental" | "manual" | null;
  lastError: string | null;
  logs: SyncLogEntry[];
  graphConfigured: boolean;
}

export interface TagConfigRecord {
  groupTag: string;
  expectedProfileNames: string[];
  expectedGroupNames: string[];
  propertyLabel: string;
}

export interface GraphReadiness {
  configured: boolean;
  missing: string[];
}

export interface SettingsResponse {
  graph: GraphReadiness;
  tagConfig: TagConfigRecord[];
}
