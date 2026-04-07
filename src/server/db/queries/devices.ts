import type Database from "better-sqlite3";

import type {
  AssignmentPath,
  DashboardResponse,
  DeviceDetailResponse,
  DeviceListItem,
  FlagCode
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
      matched_on, identity_conflict, computed_at
    ) VALUES (
      @device_key, @serial_number, @autopilot_id, @intune_id, @entra_id, @device_name, @property_label,
      @group_tag, @assigned_profile_name, @autopilot_assigned_user_upn, @intune_primary_user_upn,
      @last_checkin_at, @trust_type, @has_autopilot_record, @has_intune_record, @has_entra_record,
      @has_profile_assigned, @profile_assignment_status, @is_in_correct_group, @deployment_mode,
      @deployment_mode_mismatch, @hybrid_join_configured, @hybrid_join_risk, @user_assignment_match,
      @compliance_state, @provisioning_stalled, @tag_mismatch, @assignment_path, @assignment_chain_complete,
      @assignment_break_point, @active_flags, @flag_count, @overall_health, @diagnosis, @match_confidence,
      @matched_on, @identity_conflict, @computed_at
    )
  `);

  const insertHistory = db.prepare(`
    INSERT OR REPLACE INTO device_state_history (
      device_key, serial_number, computed_at, overall_health, active_flags
    ) VALUES (?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction((payload: typeof rows) => {
    db.prepare("DELETE FROM device_state").run();
    for (const row of payload) {
      insert.run(row);
      insertHistory.run(
        row.device_key,
        row.serial_number ?? null,
        row.computed_at,
        row.overall_health,
        row.active_flags
      );
    }
  });

  transaction(rows);
}

function parseDeviceListItem(row: DeviceStateRow): DeviceListItem {
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
    matchConfidence: row.match_confidence
  };
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

  return {
    items: rows.map(parseDeviceListItem),
    total: total.count,
    page,
    pageSize
  };
}

export function getDeviceDetail(db: Database.Database, deviceKey: string): DeviceDetailResponse | null {
  const row = db
    .prepare("SELECT * FROM device_state WHERE device_key = ?")
    .get(deviceKey) as DeviceStateRow | undefined;

  if (!row) {
    return null;
  }

  const autopilotRaw = row.autopilot_id
    ? ((db.prepare("SELECT raw_json FROM autopilot_devices WHERE id = ?").get(row.autopilot_id) as
        | { raw_json: string | null }
        | undefined)?.raw_json ?? null)
    : null;
  const intuneRaw = row.intune_id
    ? ((db.prepare("SELECT raw_json FROM intune_devices WHERE id = ?").get(row.intune_id) as
        | { raw_json: string | null }
        | undefined)?.raw_json ?? null)
    : null;
  const entraRaw = row.entra_id
    ? ((db.prepare("SELECT raw_json FROM entra_devices WHERE id = ?").get(row.entra_id) as
        | { raw_json: string | null }
        | undefined)?.raw_json ?? null)
    : null;

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

  return {
    summary: parseDeviceListItem(row),
    identity: {
      autopilotId: row.autopilot_id,
      intuneId: row.intune_id,
      entraId: row.entra_id,
      trustType: row.trust_type,
      matchConfidence: row.match_confidence,
      matchedOn: row.matched_on,
      identityConflict: Boolean(row.identity_conflict)
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
    sourceRefs: {
      autopilotRawJson: autopilotRaw,
      intuneRawJson: intuneRaw,
      entraRawJson: entraRaw
    }
  };
}

export function getDashboard(db: Database.Database): DashboardResponse {
  const rows = db.prepare("SELECT overall_health, active_flags FROM device_state").all() as Array<{
    overall_health: DashboardResponse["counts"][keyof DashboardResponse["counts"]];
    active_flags: string;
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

  return {
    lastSync: lastSync?.completed_at ?? null,
    counts,
    failurePatterns,
    driftCount
  };
}
