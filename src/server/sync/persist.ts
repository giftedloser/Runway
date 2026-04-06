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
      enrollment_profile_name, autopilot_enrolled, last_synced_at, raw_json
    ) VALUES (
      @id, @device_name, @serial_number, @entra_device_id, @os_version, @compliance_state,
      @enrollment_type, @managed_device_owner_type, @last_sync_datetime, @primary_user_upn,
      @enrollment_profile_name, @autopilot_enrolled, @last_synced_at, @raw_json
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
