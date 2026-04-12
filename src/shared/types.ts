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
    /**
     * True when two or more source records were bundled for this device
     * but the only link between them was a display-name match. Name-only
     * joins are the weakest correlation signal and must never be shown
     * as routine — the UI badges them explicitly and the operator is
     * expected to verify before trusting the bundle.
     */
    nameJoined: boolean;
  };
  assignmentPath: AssignmentPath;
  diagnostics: FlagExplanation[];
  ruleViolations: RuleViolation[];
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
  /** Devices that transitioned into warning/critical in the last 24 hours. */
  newlyUnhealthy24h: number;
  /**
   * Daily snapshot of the health distribution over the last N days, oldest
   * first. Each entry is computed from the most recent device_state_history
   * row per device whose computed_at is on-or-before that day's end.
   */
  healthTrend: HealthTrendPoint[];
  /**
   * Most recent state transitions in the last 24h, newest first. One entry
   * per device — the latest transition that fell into the window.
   */
  recentTransitions: RecentTransition[];
  /**
   * Quick-glance counters so the operator can answer "can I trust this
   * snapshot?" without drilling into individual devices.
   */
  correlationQuality: {
    /** Devices where two or more source records joined only by display name. */
    nameJoinedCount: number;
    /** Devices whose source records carry conflicting strong identifiers. */
    identityConflictCount: number;
    /** Devices rated low confidence (name-only join is the leading cause). */
    lowConfidenceCount: number;
  };
}

export type TransitionDirection = "regression" | "recovery" | "lateral";

export interface RecentTransition {
  deviceKey: DeviceKey;
  deviceName: string | null;
  serialNumber: string | null;
  propertyLabel: string | null;
  fromHealth: HealthLevel | null;
  toHealth: HealthLevel;
  direction: TransitionDirection;
  computedAt: string;
  /** Flags that appeared at this transition relative to the prior state. */
  addedFlags: FlagCode[];
  /** Flags that disappeared at this transition relative to the prior state. */
  removedFlags: FlagCode[];
}

export interface HealthTrendPoint {
  /** ISO date (YYYY-MM-DD). */
  date: string;
  healthy: number;
  info: number;
  warning: number;
  critical: number;
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

// --- Rule Engine v1 ---

export type RuleSeverity = "info" | "warning" | "critical";
export type RuleScope = "global" | "property" | "profile";

/**
 * Tiny predicate DSL. Leaf nodes are `{ field, op, value }`. Compound
 * nodes wrap children with logical operators. Kept intentionally small —
 * the escape hatch for complex logic should be a real plugin, not more DSL.
 */
export type RulePredicate =
  | { type: "leaf"; field: string; op: RuleOp; value: string | number | boolean | null }
  | { type: "and"; children: RulePredicate[] }
  | { type: "or"; children: RulePredicate[] }
  | { type: "not"; child: RulePredicate };

export type RuleOp =
  | "eq"
  | "neq"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "exists"
  | "missing"
  | "older_than_hours"
  | "newer_than_hours"
  | "in"
  | "not_in";

export interface RuleDefinition {
  id: string;
  name: string;
  description: string;
  severity: RuleSeverity;
  scope: RuleScope;
  /** When scope = property | profile, the value to match against. */
  scopeValue: string | null;
  enabled: boolean;
  predicate: RulePredicate;
  createdAt: string;
  updatedAt: string;
}

export interface RuleViolation {
  ruleId: string;
  ruleName: string;
  severity: RuleSeverity;
  description: string;
}

// --- History / Drift Timeline ---

export interface DeviceHistoryEntry {
  computedAt: string;
  health: HealthLevel;
  flags: FlagCode[];
  /** Flags that appeared in this entry but were absent in the previous one. */
  addedFlags: FlagCode[];
  /** Flags that were present in the previous entry but absent here. */
  removedFlags: FlagCode[];
  /** Health level of the previous entry, or null if this is the first one. */
  previousHealth: HealthLevel | null;
}

export interface DeviceHistoryResponse {
  deviceKey: DeviceKey;
  entries: DeviceHistoryEntry[];
}

// --- Auth ---

export interface AuthStatus {
  authenticated: boolean;
  user: string | null;
  name: string | null;
  expiresAt: string | null;
}

// --- Remote Actions ---

export type RemoteActionType =
  | "sync"
  | "reboot"
  | "rename"
  | "autopilot-reset"
  | "retire"
  | "wipe"
  | "rotate-laps";

export interface ActionResult {
  success: boolean;
  status: number;
  message: string;
}

export interface ActionLogEntry {
  id: number;
  deviceSerial: string | null;
  deviceName: string | null;
  intuneId: string | null;
  actionType: string;
  triggeredBy: string;
  triggeredAt: string;
  graphResponseStatus: number | null;
  notes: string | null;
}

// --- LAPS ---

export interface LapsCredential {
  accountName: string;
  password: string;
  backupDateTime: string | null;
  passwordExpirationDateTime: string | null;
}

// --- Groups ---

export interface GroupSummary {
  groupId: string;
  groupName: string;
  membershipRule: string | null;
  membershipType: string;
  memberCount: number;
  assignedProfiles: string[];
}

export interface GroupDetail {
  groupId: string;
  groupName: string;
  membershipRule: string | null;
  membershipType: string;
  memberCount: number;
  assignedProfiles: Array<{
    profileId: string;
    profileName: string;
    deploymentMode: string | null;
  }>;
  members: Array<{
    deviceKey: string;
    deviceName: string | null;
    serialNumber: string | null;
    health: HealthLevel;
    groupTag: string | null;
    assignedProfileName: string | null;
    flagCount: number;
  }>;
}
