export interface AutopilotRow {
  id: string;
  serial_number: string | null;
  model: string | null;
  manufacturer: string | null;
  group_tag: string | null;
  assigned_user_upn: string | null;
  deployment_profile_id: string | null;
  deployment_profile_name: string | null;
  profile_assignment_status: string | null;
  deployment_mode: string | null;
  entra_device_id: string | null;
  first_seen_at: string | null;
  first_profile_assigned_at: string | null;
  last_synced_at: string;
  raw_json: string | null;
}

export interface IntuneRow {
  id: string;
  device_name: string | null;
  serial_number: string | null;
  entra_device_id: string | null;
  os_version: string | null;
  compliance_state: string | null;
  enrollment_type: string | null;
  managed_device_owner_type: string | null;
  last_sync_datetime: string | null;
  primary_user_upn: string | null;
  enrollment_profile_name: string | null;
  autopilot_enrolled: number;
  last_synced_at: string;
  raw_json: string | null;
}

export interface EntraRow {
  id: string;
  device_id: string | null;
  display_name: string | null;
  serial_number: string | null;
  trust_type: string | null;
  is_managed: number | null;
  mdm_app_id: string | null;
  registration_datetime: string | null;
  device_physical_ids: string | null;
  last_synced_at: string;
  raw_json: string | null;
}

export interface GroupRow {
  id: string;
  display_name: string;
  membership_rule: string | null;
  membership_rule_processing_state: string | null;
  membership_type: string;
  last_synced_at: string;
  raw_json: string | null;
}

export interface GroupMembershipRow {
  group_id: string;
  member_device_id: string;
  last_synced_at: string;
}

export interface ProfileRow {
  id: string;
  display_name: string;
  deployment_mode: string | null;
  out_of_box_experience: string | null;
  hybrid_join_config: string | null;
  assigned_group_ids: string | null;
  last_synced_at: string;
  raw_json: string | null;
}

export interface ProfileAssignmentRow {
  profile_id: string;
  group_id: string;
  last_synced_at: string;
}
