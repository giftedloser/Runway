import type Database from "better-sqlite3";

import type { SnapshotPayload } from "./types.js";

function placeholders(columns: string[]) {
  return columns.map((column) => `@${column}`).join(", ");
}

export function persistSnapshot(db: Database.Database, payload: SnapshotPayload) {
  const existingAutopilot = new Map(
    (
      db
        .prepare("SELECT id, first_seen_at, first_profile_assigned_at FROM autopilot_devices")
        .all() as Array<{
        id: string;
        first_seen_at: string | null;
        first_profile_assigned_at: string | null;
      }>
    ).map((row) => [row.id, row])
  );

  const insertAutopilotColumns = [
    "id",
    "serial_number",
    "model",
    "manufacturer",
    "group_tag",
    "assigned_user_upn",
    "deployment_profile_id",
    "deployment_profile_name",
    "profile_assignment_status",
    "deployment_mode",
    "entra_device_id",
    "first_seen_at",
    "first_profile_assigned_at",
    "last_synced_at",
    "raw_json"
  ];

  const insertAutopilot = db.prepare(`
    INSERT INTO autopilot_devices (${insertAutopilotColumns.join(", ")})
    VALUES (${placeholders(insertAutopilotColumns)})
  `);
  const insertIntune = db.prepare(`
    INSERT INTO intune_devices (
      id, device_name, serial_number, entra_device_id, os_version, compliance_state,
      enrollment_type, managed_device_owner_type, last_sync_datetime, primary_user_upn,
      enrollment_profile_name, autopilot_enrolled, management_agent, last_synced_at, raw_json
    ) VALUES (
      @id, @device_name, @serial_number, @entra_device_id, @os_version, @compliance_state,
      @enrollment_type, @managed_device_owner_type, @last_sync_datetime, @primary_user_upn,
      @enrollment_profile_name, @autopilot_enrolled, @management_agent, @last_synced_at, @raw_json
    )
  `);
  const insertEntra = db.prepare(`
    INSERT INTO entra_devices (
      id, device_id, display_name, serial_number, trust_type, is_managed, mdm_app_id,
      registration_datetime, device_physical_ids, last_synced_at, raw_json
    ) VALUES (
      @id, @device_id, @display_name, @serial_number, @trust_type, @is_managed, @mdm_app_id,
      @registration_datetime, @device_physical_ids, @last_synced_at, @raw_json
    )
  `);
  const insertGroup = db.prepare(`
    INSERT INTO groups (
      id, display_name, membership_rule, membership_rule_processing_state, membership_type,
      last_synced_at, raw_json
    ) VALUES (
      @id, @display_name, @membership_rule, @membership_rule_processing_state, @membership_type,
      @last_synced_at, @raw_json
    )
  `);
  const insertMembership = db.prepare(`
    INSERT INTO group_memberships (group_id, member_device_id, last_synced_at)
    VALUES (@group_id, @member_device_id, @last_synced_at)
  `);
  const insertProfile = db.prepare(`
    INSERT INTO autopilot_profiles (
      id, display_name, deployment_mode, out_of_box_experience, hybrid_join_config,
      assigned_group_ids, last_synced_at, raw_json
    ) VALUES (
      @id, @display_name, @deployment_mode, @out_of_box_experience, @hybrid_join_config,
      @assigned_group_ids, @last_synced_at, @raw_json
    )
  `);
  const insertProfileAssignment = db.prepare(`
    INSERT INTO autopilot_profile_assignments (profile_id, group_id, last_synced_at)
    VALUES (@profile_id, @group_id, @last_synced_at)
  `);
  const insertCompliancePolicy = db.prepare(`
    INSERT INTO compliance_policies (id, display_name, description, platform, last_synced_at, raw_json)
    VALUES (@id, @display_name, @description, @platform, @last_synced_at, @raw_json)
  `);
  const insertDeviceComplianceState = db.prepare(`
    INSERT INTO device_compliance_states (id, device_id, policy_id, policy_name, state, last_reported_at, last_synced_at)
    VALUES (@id, @device_id, @policy_id, @policy_name, @state, @last_reported_at, @last_synced_at)
  `);
  const insertConfigProfile = db.prepare(`
    INSERT INTO config_profiles (id, display_name, description, platform, profile_type, last_synced_at, raw_json)
    VALUES (@id, @display_name, @description, @platform, @profile_type, @last_synced_at, @raw_json)
  `);
  const insertDeviceConfigState = db.prepare(`
    INSERT INTO device_config_states (id, device_id, profile_id, profile_name, state, last_reported_at, last_synced_at)
    VALUES (@id, @device_id, @profile_id, @profile_name, @state, @last_reported_at, @last_synced_at)
  `);
  const insertMobileApp = db.prepare(`
    INSERT INTO mobile_apps (id, display_name, description, app_type, publisher, last_synced_at, raw_json)
    VALUES (@id, @display_name, @description, @app_type, @publisher, @last_synced_at, @raw_json)
  `);
  const insertDeviceAppInstallState = db.prepare(`
    INSERT INTO device_app_install_states (id, device_id, app_id, app_name, install_state, error_code, last_synced_at)
    VALUES (@id, @device_id, @app_id, @app_name, @install_state, @error_code, @last_synced_at)
  `);
  const insertConditionalAccessPolicy = db.prepare(`
    INSERT INTO conditional_access_policies (id, display_name, state, conditions_json, grant_controls_json, session_controls_json, last_synced_at, raw_json)
    VALUES (@id, @display_name, @state, @conditions_json, @grant_controls_json, @session_controls_json, @last_synced_at, @raw_json)
  `);
  const upsertTagConfig = db.prepare(`
    INSERT INTO tag_config (group_tag, expected_profile_names, expected_group_names, property_label)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(group_tag) DO UPDATE SET
      expected_profile_names = excluded.expected_profile_names,
      expected_group_names = excluded.expected_group_names,
      property_label = excluded.property_label
  `);

  const transaction = db.transaction(() => {
    db.prepare("DELETE FROM autopilot_devices").run();
    db.prepare("DELETE FROM intune_devices").run();
    db.prepare("DELETE FROM entra_devices").run();
    db.prepare("DELETE FROM groups").run();
    db.prepare("DELETE FROM group_memberships").run();
    db.prepare("DELETE FROM autopilot_profiles").run();
    db.prepare("DELETE FROM autopilot_profile_assignments").run();
    db.prepare("DELETE FROM compliance_policies").run();
    db.prepare("DELETE FROM device_compliance_states").run();
    db.prepare("DELETE FROM config_profiles").run();
    db.prepare("DELETE FROM device_config_states").run();
    db.prepare("DELETE FROM mobile_apps").run();
    db.prepare("DELETE FROM device_app_install_states").run();
    db.prepare("DELETE FROM conditional_access_policies").run();

    for (const row of payload.autopilotRows) {
      const existing = existingAutopilot.get(row.id);
      insertAutopilot.run({
        ...row,
        first_seen_at: existing?.first_seen_at ?? row.first_seen_at ?? row.last_synced_at,
        first_profile_assigned_at:
          existing?.first_profile_assigned_at ??
          row.first_profile_assigned_at ??
          (row.deployment_profile_id || row.deployment_profile_name ? row.last_synced_at : null)
      });
    }

    for (const row of payload.intuneRows) {
      insertIntune.run(row);
    }
    for (const row of payload.entraRows) {
      insertEntra.run(row);
    }
    for (const row of payload.groupRows) {
      insertGroup.run(row);
    }
    for (const row of payload.membershipRows) {
      insertMembership.run(row);
    }
    for (const row of payload.profileRows) {
      insertProfile.run(row);
    }
    for (const row of payload.profileAssignmentRows) {
      insertProfileAssignment.run(row);
    }
    for (const row of payload.compliancePolicies ?? []) {
      insertCompliancePolicy.run(row);
    }
    for (const row of payload.deviceComplianceStates ?? []) {
      insertDeviceComplianceState.run(row);
    }
    for (const row of payload.configProfiles ?? []) {
      insertConfigProfile.run(row);
    }
    for (const row of payload.deviceConfigStates ?? []) {
      insertDeviceConfigState.run(row);
    }
    for (const row of payload.mobileApps ?? []) {
      insertMobileApp.run(row);
    }
    for (const row of payload.deviceAppInstallStates ?? []) {
      insertDeviceAppInstallState.run(row);
    }
    for (const row of payload.conditionalAccessPolicies ?? []) {
      insertConditionalAccessPolicy.run(row);
    }
    for (const row of payload.tagConfigRows ?? []) {
      upsertTagConfig.run(
        row.groupTag,
        JSON.stringify(row.expectedProfileNames),
        JSON.stringify(row.expectedGroupNames),
        row.propertyLabel
      );
    }
  });

  transaction();
}
