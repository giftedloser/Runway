import type Database from "better-sqlite3";

import type {
  AssignmentPath,
  DashboardResponse,
  DeviceDetailResponse,
  DeviceHistoryEntry,
  DeviceHistoryResponse,
  DeviceListItem,
  FlagCode,
  HealthLevel,
  HealthTrendPoint,
  RecentTransition,
  TransitionDirection
} from "../../../shared/types.js";
import type {
  AutopilotRow,
  EntraRow,
  GroupMembershipRow,
  GroupRow,
  IntuneRow,
  ProfileAssignmentRow,
  ProfileRow
} from "../types.js";
import { hasConfigMgrClient } from "../../engine/config-mgr.js";

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

interface DeviceStateRow {
  device_key: string;
  serial_number: string | null;
  autopilot_id: string | null;
  intune_id: string | null;
  entra_id: string | null;
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
  active_flags: string;
  flag_count: number;
  overall_health: DeviceListItem["health"];
  diagnosis: string;
  match_confidence: DeviceListItem["matchConfidence"];
  matched_on: DeviceDetailResponse["identity"]["matchedOn"];
  identity_conflict: number;
  assignment_path: string;
  profile_assignment_status: string | null;
  active_rule_ids: string | null;
}

export function loadStateEngineInput(db: Database.Database) {
  return {
    autopilotRows: db.prepare("SELECT * FROM autopilot_devices").all() as AutopilotRow[],
    intuneRows: db.prepare("SELECT * FROM intune_devices").all() as IntuneRow[],
    entraRows: db.prepare("SELECT * FROM entra_devices").all() as EntraRow[],
    groupRows: db.prepare("SELECT * FROM groups").all() as GroupRow[],
    membershipRows: db.prepare("SELECT * FROM group_memberships").all() as GroupMembershipRow[],
    profileRows: db.prepare("SELECT * FROM autopilot_profiles").all() as ProfileRow[],
    profileAssignmentRows: db
      .prepare("SELECT * FROM autopilot_profile_assignments")
      .all() as ProfileAssignmentRow[],
    tagConfigRows: db
      .prepare("SELECT group_tag, expected_profile_names, expected_group_names, property_label FROM tag_config")
      .all() as Array<{
      group_tag: string;
      expected_profile_names: string;
      expected_group_names: string;
      property_label: string;
    }>,
    previousStates: db
      .prepare("SELECT device_key, serial_number, compliance_state FROM device_state")
      .all() as Array<{
      device_key: string;
      serial_number: string | null;
      compliance_state: string | null;
    }>
  };
}

export function replaceDeviceStates(
  db: Database.Database,
  rows: Array<Record<string, unknown> & { device_key: string }>
) {
  const insert = db.prepare(`
    INSERT INTO device_state (
      device_key, serial_number, autopilot_id, intune_id, entra_id, device_name, property_label,
      group_tag, assigned_profile_name, autopilot_assigned_user_upn, intune_primary_user_upn,
      last_checkin_at, trust_type, has_autopilot_record, has_intune_record, has_entra_record,
      has_profile_assigned, profile_assignment_status, is_in_correct_group, deployment_mode,
      deployment_mode_mismatch, hybrid_join_configured, hybrid_join_risk, user_assignment_match,
      compliance_state, provisioning_stalled, tag_mismatch, assignment_path, assignment_chain_complete,
      assignment_break_point, active_flags, flag_count, overall_health, diagnosis, match_confidence,
      matched_on, identity_conflict, active_rule_ids, computed_at
    ) VALUES (
      @device_key, @serial_number, @autopilot_id, @intune_id, @entra_id, @device_name, @property_label,
      @group_tag, @assigned_profile_name, @autopilot_assigned_user_upn, @intune_primary_user_upn,
      @last_checkin_at, @trust_type, @has_autopilot_record, @has_intune_record, @has_entra_record,
      @has_profile_assigned, @profile_assignment_status, @is_in_correct_group, @deployment_mode,
      @deployment_mode_mismatch, @hybrid_join_configured, @hybrid_join_risk, @user_assignment_match,
      @compliance_state, @provisioning_stalled, @tag_mismatch, @assignment_path, @assignment_chain_complete,
      @assignment_break_point, @active_flags, @flag_count, @overall_health, @diagnosis, @match_confidence,
      @matched_on, @identity_conflict, @active_rule_ids, @computed_at
    )
  `);

  const insertHistory = db.prepare(`
    INSERT OR REPLACE INTO device_state_history (
      device_key, serial_number, computed_at, overall_health, active_flags
    ) VALUES (?, ?, ?, ?, ?)
  `);

  // Only write a history row when the (health, flags) state hash actually
  // changes. This keeps the table cheap to grow and means each row marks a
  // real transition rather than every successful sync.
  const latestByDevice = db.prepare(
    `SELECT overall_health, active_flags FROM device_state_history
     WHERE device_key = ?
     ORDER BY computed_at DESC LIMIT 1`
  );

  const transaction = db.transaction((payload: typeof rows) => {
    db.prepare("DELETE FROM device_state").run();
    for (const row of payload) {
      insert.run(row);
      const previous = latestByDevice.get(row.device_key) as
        | { overall_health: string; active_flags: string }
        | undefined;
      const changed =
        !previous ||
        previous.overall_health !== row.overall_health ||
        previous.active_flags !== row.active_flags;
      if (changed) {
        insertHistory.run(
          row.device_key,
          row.serial_number ?? null,
          row.computed_at,
          row.overall_health,
          row.active_flags
        );
      }
    }
  });

  transaction(rows);
}

type RuleLookup = Map<string, { id: string; name: string; severity: string }>;

function parseDeviceListItem(row: DeviceStateRow, ruleLookup?: RuleLookup): DeviceListItem {
  const ruleIds = safeJsonParse<string[]>(row.active_rule_ids ?? "[]", []);
  const activeRules = ruleLookup
    ? ruleIds
        .map((ruleId) => {
          const rule = ruleLookup.get(ruleId);
          if (!rule) return null;
          return {
            ruleId: rule.id,
            ruleName: rule.name,
            severity: (rule.severity as "info" | "warning" | "critical") ?? "warning"
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null)
    : [];

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
    diagnosis: row.diagnosis,
    matchConfidence: row.match_confidence,
    activeRules
  };
}

function buildRuleLookup(db: Database.Database): RuleLookup {
  return new Map(
    (
      db
        .prepare("SELECT id, name, severity FROM rule_definitions")
        .all() as Array<{ id: string; name: string; severity: string }>
    ).map((row) => [row.id, row])
  );
}

export function listDeviceStates(
  db: Database.Database,
  filters: {
    search?: string;
    health?: string;
    flag?: string;
    property?: string;
    profile?: string;
    page?: number;
    pageSize?: number;
  }
) {
  const where: string[] = [];
  const params: Record<string, unknown> = {};

  if (filters.search) {
    where.push(
      "(COALESCE(device_name, '') LIKE @search OR COALESCE(serial_number, '') LIKE @search OR COALESCE(autopilot_assigned_user_upn, '') LIKE @search OR COALESCE(intune_primary_user_upn, '') LIKE @search)"
    );
    params.search = `%${filters.search}%`;
  }

  if (filters.health) {
    where.push("overall_health = @health");
    params.health = filters.health;
  }

  if (filters.flag) {
    where.push("active_flags LIKE @flag");
    params.flag = `%"${filters.flag}"%`;
  }

  if (filters.property) {
    where.push("property_label = @property");
    params.property = filters.property;
  }

  if (filters.profile) {
    where.push("assigned_profile_name = @profile");
    params.profile = filters.profile;
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const rawPage = filters.page ?? 1;
  const rawPageSize = filters.pageSize ?? 25;
  // Guard against DoS: cap pageSize at 200 and page at something reasonable.
  const pageSize = Math.min(Math.max(Number.isFinite(rawPageSize) ? rawPageSize : 25, 1), 200);
  const page = Math.min(Math.max(Number.isFinite(rawPage) ? rawPage : 1, 1), 10_000);
  params.offset = (page - 1) * pageSize;
  params.limit = pageSize;

  const rows = db
    .prepare(
      `
      SELECT *
      FROM device_state
      ${whereClause}
      ORDER BY CASE overall_health
        WHEN 'critical' THEN 0
        WHEN 'warning' THEN 1
        WHEN 'info' THEN 2
        WHEN 'healthy' THEN 3
        ELSE 4
      END ASC, flag_count DESC, COALESCE(device_name, serial_number, device_key) ASC
      LIMIT @limit OFFSET @offset
    `
    )
    .all(params) as DeviceStateRow[];

  const total = db
    .prepare(`SELECT COUNT(*) as count FROM device_state ${whereClause}`)
    .get(params) as { count: number };

  const ruleLookup = buildRuleLookup(db);
  return {
    items: rows.map((row) => parseDeviceListItem(row, ruleLookup)),
    total: total.count,
    page,
    pageSize
  };
}

export function getDeviceDetail(
  db: Database.Database,
  deviceKey: string
): DeviceDetailResponse | null {
  const ruleLookup = new Map(
    (
      db
        .prepare("SELECT id, name, severity, description FROM rule_definitions")
        .all() as Array<{
        id: string;
        name: string;
        severity: string;
        description: string;
      }>
    ).map((row) => [row.id, row])
  );
  return getDeviceDetailWithRules(db, deviceKey, ruleLookup);
}

function getDeviceDetailWithRules(
  db: Database.Database,
  deviceKey: string,
  ruleLookup: Map<string, { id: string; name: string; severity: string; description: string }>
): DeviceDetailResponse | null {
  const row = db
    .prepare("SELECT * FROM device_state WHERE device_key = ?")
    .get(deviceKey) as DeviceStateRow | undefined;

  if (!row) {
    return null;
  }

  // Fetch full source rows for raw JSON and hardware/enrollment fields
  const autopilotSource = row.autopilot_id
    ? (db.prepare("SELECT raw_json, model, manufacturer, first_seen_at, first_profile_assigned_at FROM autopilot_devices WHERE id = ?").get(row.autopilot_id) as
        | { raw_json: string | null; model: string | null; manufacturer: string | null; first_seen_at: string | null; first_profile_assigned_at: string | null }
        | undefined) ?? null
    : null;
  const intuneSource = row.intune_id
    ? (db.prepare("SELECT raw_json, os_version, enrollment_type, managed_device_owner_type, enrollment_profile_name, last_sync_datetime, management_agent FROM intune_devices WHERE id = ?").get(row.intune_id) as
        | { raw_json: string | null; os_version: string | null; enrollment_type: string | null; managed_device_owner_type: string | null; enrollment_profile_name: string | null; last_sync_datetime: string | null; management_agent: string | null }
        | undefined) ?? null
    : null;
  const entraSource = row.entra_id
    ? (db.prepare("SELECT raw_json, registration_datetime FROM entra_devices WHERE id = ?").get(row.entra_id) as
        | { raw_json: string | null; registration_datetime: string | null }
        | undefined) ?? null
    : null;

  const autopilotRaw = autopilotSource?.raw_json ?? null;
  const intuneRaw = intuneSource?.raw_json ?? null;
  const entraRaw = entraSource?.raw_json ?? null;

  // Group memberships for this device
  const groupMemberships = row.entra_id
    ? (db.prepare(
        `SELECT g.id AS group_id, g.display_name, g.membership_type
         FROM group_memberships gm
         JOIN groups g ON g.id = gm.group_id
         WHERE gm.member_device_id = ?
         ORDER BY g.display_name`
      ).all(row.entra_id) as Array<{ group_id: string; display_name: string; membership_type: string }>)
    : [];

  // Compliance policy states for this device
  const compliancePolicies = row.intune_id
    ? (db.prepare(
        `SELECT policy_id, policy_name, state, last_reported_at
         FROM device_compliance_states
         WHERE device_id = ?
         ORDER BY policy_name`
      ).all(row.intune_id) as Array<{
        policy_id: string;
        policy_name: string | null;
        state: string;
        last_reported_at: string | null;
      }>)
    : [];

  // Config profile states for this device
  const configProfileStates = row.intune_id
    ? (db.prepare(
        `SELECT profile_id, profile_name, state, last_reported_at
         FROM device_config_states
         WHERE device_id = ?
         ORDER BY profile_name`
      ).all(row.intune_id) as Array<{
        profile_id: string;
        profile_name: string | null;
        state: string;
        last_reported_at: string | null;
      }>)
    : [];

  // App install states for this device
  const appInstallStates = row.intune_id
    ? (db.prepare(
        `SELECT app_id, app_name, install_state, error_code
         FROM device_app_install_states
         WHERE device_id = ?
         ORDER BY app_name`
      ).all(row.intune_id) as Array<{
        app_id: string;
        app_name: string | null;
        install_state: string;
        error_code: string | null;
      }>)
    : [];

  const parsedAssignment = safeJsonParse<
    AssignmentPath & { diagnostics?: DeviceDetailResponse["diagnostics"] }
  >(row.assignment_path, {
    autopilotRecord: null,
    targetingGroups: [],
    assignedProfile: null,
    effectiveMode: null,
    chainComplete: false,
    breakPoint: "no_record",
    diagnostics: []
  });

  // Name-only correlation: the weakest-link logic in correlateDevices
  // already marks such bundles as low/device_name, but solo records also
  // report matched_on = "device_name" when that is the only identifier
  // they carry. We only want the warning when an actual cross-system
  // claim is being made, so require at least two source records to be
  // present before badging the bundle as name-joined.
  const sourceRecordCount =
    (row.autopilot_id ? 1 : 0) + (row.intune_id ? 1 : 0) + (row.entra_id ? 1 : 0);
  const nameJoined = row.matched_on === "device_name" && sourceRecordCount >= 2;

  return {
    summary: parseDeviceListItem(row, ruleLookup),
    identity: {
      autopilotId: row.autopilot_id,
      intuneId: row.intune_id,
      entraId: row.entra_id,
      trustType: row.trust_type,
      matchConfidence: row.match_confidence,
      matchedOn: row.matched_on,
      identityConflict: Boolean(row.identity_conflict),
      nameJoined
    },
    assignmentPath: {
      autopilotRecord: parsedAssignment.autopilotRecord,
      targetingGroups: parsedAssignment.targetingGroups,
      assignedProfile: parsedAssignment.assignedProfile,
      effectiveMode: parsedAssignment.effectiveMode,
      chainComplete: parsedAssignment.chainComplete,
      breakPoint: parsedAssignment.breakPoint
    },
    diagnostics: parsedAssignment.diagnostics ?? [],
    ruleViolations: safeJsonParse<string[]>(row.active_rule_ids ?? "[]", [])
      .map((ruleId) => {
        const rule = ruleLookup.get(ruleId);
        if (!rule) return null;
        return {
          ruleId: rule.id,
          ruleName: rule.name,
          severity: (rule.severity as "info" | "warning" | "critical") ?? "warning",
          description: rule.description
        };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null),
    hardware: {
      model: autopilotSource?.model ?? null,
      manufacturer: autopilotSource?.manufacturer ?? null,
      osVersion: intuneSource?.os_version ?? null,
      enrollmentType: intuneSource?.enrollment_type ?? null,
      ownershipType: intuneSource?.managed_device_owner_type ?? null
    },
    enrollment: {
      enrollmentProfileName: intuneSource?.enrollment_profile_name ?? null,
      managedDeviceOwnerType: intuneSource?.managed_device_owner_type ?? null,
      registrationDate: entraSource?.registration_datetime ?? null,
      firstSeenAt: autopilotSource?.first_seen_at ?? null,
      firstProfileAssignedAt: autopilotSource?.first_profile_assigned_at ?? null,
      managementAgent: intuneSource?.management_agent ?? null,
      hasConfigMgrClient: hasConfigMgrClient(intuneSource?.management_agent)
    },
    groupMemberships: groupMemberships.map((g) => ({
      groupId: g.group_id,
      groupName: g.display_name,
      membershipType: g.membership_type
    })),
    provisioningTimeline: {
      firstSeenAt: autopilotSource?.first_seen_at ?? null,
      firstProfileAssignedAt: autopilotSource?.first_profile_assigned_at ?? null,
      enrollmentDate: entraSource?.registration_datetime ?? null,
      lastCheckinAt: intuneSource?.last_sync_datetime ?? null
    },
    compliancePolicies: compliancePolicies.map((p) => ({
      policyId: p.policy_id,
      policyName: p.policy_name ?? "Unknown Policy",
      state: p.state,
      lastReportedAt: p.last_reported_at
    })),
    configProfiles: configProfileStates.map((p) => ({
      profileId: p.profile_id,
      profileName: p.profile_name ?? "Unknown Profile",
      state: p.state,
      lastReportedAt: p.last_reported_at
    })),
    appInstallStates: appInstallStates.map((a) => ({
      appId: a.app_id,
      appName: a.app_name ?? "Unknown App",
      installState: a.install_state,
      errorCode: a.error_code
    })),
    sourceRefs: {
      autopilotRawJson: autopilotRaw,
      intuneRawJson: intuneRaw,
      entraRawJson: entraRaw
    }
  };
}

export function getDeviceHistory(
  db: Database.Database,
  deviceKey: string,
  limit = 50
): DeviceHistoryResponse {
  const rows = db
    .prepare(
      `SELECT computed_at, overall_health, active_flags
       FROM device_state_history
       WHERE device_key = ?
       ORDER BY computed_at DESC
       LIMIT ?`
    )
    .all(deviceKey, limit) as Array<{
    computed_at: string;
    overall_health: HealthLevel;
    active_flags: string;
  }>;

  // Walk in chronological order so we can compute diffs against the prior
  // state, then reverse for the response (newest first).
  const ascending = [...rows].reverse();
  const entries: DeviceHistoryEntry[] = [];
  let prevFlags: FlagCode[] = [];
  let prevHealth: HealthLevel | null = null;

  for (const row of ascending) {
    const flags = safeJsonParse<FlagCode[]>(row.active_flags, []);
    const flagSet = new Set(flags);
    const prevSet = new Set(prevFlags);
    const added = flags.filter((f) => !prevSet.has(f));
    const removed = prevFlags.filter((f) => !flagSet.has(f));
    entries.push({
      computedAt: row.computed_at,
      health: row.overall_health,
      flags,
      addedFlags: added,
      removedFlags: removed,
      previousHealth: prevHealth
    });
    prevFlags = flags;
    prevHealth = row.overall_health;
  }

  return {
    deviceKey,
    entries: entries.reverse()
  };
}

export interface RelatedDevice {
  deviceKey: string;
  deviceName: string | null;
  serialNumber: string | null;
  health: HealthLevel;
  assignedProfileName: string | null;
  flagCount: number;
}

export function getRelatedDevices(
  db: Database.Database,
  userUpn: string,
  excludeDeviceKey: string
): RelatedDevice[] {
  const rows = db
    .prepare(
      `SELECT device_key, device_name, serial_number, overall_health, assigned_profile_name, flag_count
       FROM device_state
       WHERE (intune_primary_user_upn = ? OR autopilot_assigned_user_upn = ?)
         AND device_key != ?
       ORDER BY device_name`
    )
    .all(userUpn, userUpn, excludeDeviceKey) as Array<{
    device_key: string;
    device_name: string | null;
    serial_number: string | null;
    overall_health: HealthLevel;
    assigned_profile_name: string | null;
    flag_count: number;
  }>;

  return rows.map((r) => ({
    deviceKey: r.device_key,
    deviceName: r.device_name,
    serialNumber: r.serial_number,
    health: r.overall_health,
    assignedProfileName: r.assigned_profile_name,
    flagCount: r.flag_count
  }));
}

/**
 * Count of devices that became unhealthy (warning/critical) within the last
 * 24 hours, based on the most recent two history transitions per device.
 */
export function countNewlyUnhealthy(db: Database.Database, sinceIso: string): number {
  const rows = db
    .prepare(
      `SELECT device_key, overall_health, computed_at
       FROM device_state_history
       WHERE computed_at >= ?
       ORDER BY device_key, computed_at ASC`
    )
    .all(sinceIso) as Array<{
    device_key: string;
    overall_health: HealthLevel;
    computed_at: string;
  }>;

  // Look up the prior state (just before the window) for each device that
  // had transitions in the window so we can tell "became unhealthy" from
  // "was already unhealthy".
  const priorStmt = db.prepare(
    `SELECT overall_health FROM device_state_history
     WHERE device_key = ? AND computed_at < ?
     ORDER BY computed_at DESC LIMIT 1`
  );

  const seen = new Set<string>();
  let count = 0;
  for (const row of rows) {
    if (seen.has(row.device_key)) continue;
    seen.add(row.device_key);
    if (row.overall_health !== "warning" && row.overall_health !== "critical") continue;
    const prior = priorStmt.get(row.device_key, sinceIso) as
      | { overall_health: HealthLevel }
      | undefined;
    if (!prior || (prior.overall_health !== "warning" && prior.overall_health !== "critical")) {
      count += 1;
    }
  }
  return count;
}

/**
 * Returns one health snapshot per UTC day for the last `days` days. For each
 * day we look up the latest history row per device whose `computed_at` is
 * on-or-before that day's end and bucket by `overall_health`. Devices that
 * had no history yet on that day are simply not counted (they didn't exist
 * to Runway yet).
 */
export function getHealthTrend(db: Database.Database, days: number): HealthTrendPoint[] {
  const now = new Date();
  const points: HealthTrendPoint[] = [];

  // We pre-compile the per-device "latest state at-or-before this cutoff"
  // statement once and reuse it across day buckets.
  const latestPerDeviceStmt = db.prepare(
    `SELECT device_key, overall_health
       FROM device_state_history h
      WHERE computed_at = (
        SELECT MAX(computed_at) FROM device_state_history
        WHERE device_key = h.device_key AND computed_at <= ?
      )`
  );

  for (let i = days - 1; i >= 0; i--) {
    const dayDate = new Date(now);
    dayDate.setUTCDate(dayDate.getUTCDate() - i);
    const yyyy = dayDate.getUTCFullYear();
    const mm = String(dayDate.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(dayDate.getUTCDate()).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const cutoff = `${dateStr}T23:59:59.999Z`;

    const rows = latestPerDeviceStmt.all(cutoff) as Array<{
      device_key: string;
      overall_health: HealthLevel;
    }>;

    const point: HealthTrendPoint = {
      date: dateStr,
      healthy: 0,
      info: 0,
      warning: 0,
      critical: 0
    };
    for (const row of rows) {
      if (row.overall_health === "healthy") point.healthy++;
      else if (row.overall_health === "info") point.info++;
      else if (row.overall_health === "warning") point.warning++;
      else if (row.overall_health === "critical") point.critical++;
    }
    points.push(point);
  }

  return points;
}

/**
 * Severity ranking used to classify a transition. Higher = worse.
 * "unknown" is treated as 0 so first-ever observations look like recoveries
 * if they land at "healthy" and stay neutral otherwise.
 */
const HEALTH_RANK: Record<HealthLevel, number> = {
  unknown: 0,
  healthy: 1,
  info: 2,
  warning: 3,
  critical: 4
};

/**
 * Returns the most recent state transition per device that occurred within
 * the window, newest first. Each row also surfaces the prior state (so we
 * can tell whether the transition was a regression, recovery, or lateral
 * flag swap), the added/removed flag set, and the device's display fields
 * via a join on `device_state`.
 */
export function getRecentTransitions(
  db: Database.Database,
  sinceIso: string,
  limit: number
): RecentTransition[] {
  const rows = db
    .prepare(
      `SELECT h.device_key, h.computed_at, h.overall_health, h.active_flags,
              ds.device_name, ds.serial_number, ds.property_label
         FROM device_state_history h
         INNER JOIN (
           SELECT device_key, MAX(computed_at) AS max_computed_at
             FROM device_state_history
            WHERE computed_at >= ?
         GROUP BY device_key
         ) latest
           ON latest.device_key = h.device_key
          AND latest.max_computed_at = h.computed_at
         LEFT JOIN device_state ds ON ds.device_key = h.device_key
        ORDER BY h.computed_at DESC
        LIMIT ?`
    )
    .all(sinceIso, limit) as Array<{
    device_key: string;
    computed_at: string;
    overall_health: HealthLevel;
    active_flags: string;
    device_name: string | null;
    serial_number: string | null;
    property_label: string | null;
  }>;

  // Pre-compile the prior-state lookup. Each device hits this once.
  const priorStmt = db.prepare(
    `SELECT overall_health, active_flags
       FROM device_state_history
      WHERE device_key = ? AND computed_at < ?
      ORDER BY computed_at DESC LIMIT 1`
  );

  const transitions: RecentTransition[] = [];
  for (const row of rows) {
    const prior = priorStmt.get(row.device_key, row.computed_at) as
      | { overall_health: HealthLevel; active_flags: string }
      | undefined;
    const fromHealth = prior?.overall_health ?? null;
    const toHealth = row.overall_health;
    const fromRank = fromHealth ? HEALTH_RANK[fromHealth] : 0;
    const toRank = HEALTH_RANK[toHealth];
    const direction: TransitionDirection =
      toRank > fromRank ? "regression" : toRank < fromRank ? "recovery" : "lateral";

    const flags = safeJsonParse<FlagCode[]>(row.active_flags, []);
    const priorFlags = safeJsonParse<FlagCode[]>(prior?.active_flags ?? null, []);
    const flagSet = new Set(flags);
    const priorSet = new Set(priorFlags);
    const addedFlags = flags.filter((f) => !priorSet.has(f));
    const removedFlags = priorFlags.filter((f) => !flagSet.has(f));

    transitions.push({
      deviceKey: row.device_key,
      deviceName: row.device_name,
      serialNumber: row.serial_number,
      propertyLabel: row.property_label,
      fromHealth,
      toHealth,
      direction,
      computedAt: row.computed_at,
      addedFlags,
      removedFlags
    });
  }
  return transitions;
}

export function getDashboard(db: Database.Database): DashboardResponse {
  const rows = db.prepare("SELECT overall_health, active_flags, match_confidence, matched_on, identity_conflict, autopilot_id, intune_id, entra_id FROM device_state").all() as Array<{
    overall_health: keyof DashboardResponse["counts"];
    active_flags: string;
    match_confidence: string;
    matched_on: string;
    identity_conflict: number;
    autopilot_id: string | null;
    intune_id: string | null;
    entra_id: string | null;
  }>;

  const counts: DashboardResponse["counts"] = {
    critical: 0,
    warning: 0,
    info: 0,
    healthy: 0,
    unknown: 0
  };

  const flagCounts = new Map<FlagCode, number>();
  let driftCount = 0;
  let nameJoinedCount = 0;
  let identityConflictCount = 0;
  let lowConfidenceCount = 0;

  for (const row of rows) {
    const health = row.overall_health as keyof typeof counts;
    counts[health] += 1;
    const flags = safeJsonParse<FlagCode[]>(row.active_flags, []);
    if (flags.includes("compliance_drift")) {
      driftCount += 1;
    }
    for (const flag of flags) {
      flagCounts.set(flag, (flagCounts.get(flag) ?? 0) + 1);
    }
    // Correlation quality counters
    const sourceCount =
      (row.autopilot_id ? 1 : 0) + (row.intune_id ? 1 : 0) + (row.entra_id ? 1 : 0);
    if (row.matched_on === "device_name" && sourceCount >= 2) {
      nameJoinedCount += 1;
    }
    if (row.identity_conflict) {
      identityConflictCount += 1;
    }
    if (row.match_confidence === "low") {
      lowConfidenceCount += 1;
    }
  }

  const lastSync = db
    .prepare("SELECT completed_at FROM sync_log WHERE completed_at IS NOT NULL ORDER BY id DESC LIMIT 1")
    .get() as { completed_at: string | null } | undefined;

  const failurePatterns = [...flagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([flag, count]) => ({
      flag,
      count,
      severity: (["no_profile_assigned", "profile_assignment_failed", "hybrid_join_risk", "profile_assigned_not_enrolled", "provisioning_stalled"].includes(
        flag
      )
        ? "critical"
        : ["not_in_target_group", "user_mismatch", "deployment_mode_mismatch", "identity_conflict", "tag_mismatch"].includes(flag)
          ? "warning"
          : "info") as "critical" | "warning" | "info"
    }));

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const newlyUnhealthy24h = countNewlyUnhealthy(db, since);
  const healthTrend = getHealthTrend(db, 14);
  const recentTransitions = getRecentTransitions(db, since, 25);

  return {
    lastSync: lastSync?.completed_at ?? null,
    counts,
    failurePatterns,
    driftCount,
    newlyUnhealthy24h,
    healthTrend,
    recentTransitions,
    correlationQuality: {
      nameJoinedCount,
      identityConflictCount,
      lowConfidenceCount
    }
  };
}
