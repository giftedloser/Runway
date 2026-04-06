CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS autopilot_devices (
  id TEXT PRIMARY KEY,
  serial_number TEXT,
  model TEXT,
  manufacturer TEXT,
  group_tag TEXT,
  assigned_user_upn TEXT,
  deployment_profile_id TEXT,
  deployment_profile_name TEXT,
  profile_assignment_status TEXT,
  deployment_mode TEXT,
  entra_device_id TEXT,
  first_seen_at TEXT,
  first_profile_assigned_at TEXT,
  last_synced_at TEXT NOT NULL,
  raw_json TEXT
);

CREATE TABLE IF NOT EXISTS intune_devices (
  id TEXT PRIMARY KEY,
  device_name TEXT,
  serial_number TEXT,
  entra_device_id TEXT,
  os_version TEXT,
  compliance_state TEXT,
  enrollment_type TEXT,
  managed_device_owner_type TEXT,
  last_sync_datetime TEXT,
  primary_user_upn TEXT,
  enrollment_profile_name TEXT,
  autopilot_enrolled INTEGER DEFAULT 0,
  last_synced_at TEXT NOT NULL,
  raw_json TEXT
);

CREATE TABLE IF NOT EXISTS entra_devices (
  id TEXT PRIMARY KEY,
  device_id TEXT,
  display_name TEXT,
  serial_number TEXT,
  trust_type TEXT,
  is_managed INTEGER,
  mdm_app_id TEXT,
  registration_datetime TEXT,
  device_physical_ids TEXT,
  last_synced_at TEXT NOT NULL,
  raw_json TEXT
);

CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  membership_rule TEXT,
  membership_rule_processing_state TEXT,
  membership_type TEXT NOT NULL,
  last_synced_at TEXT NOT NULL,
  raw_json TEXT
);

CREATE TABLE IF NOT EXISTS group_memberships (
  group_id TEXT NOT NULL,
  member_device_id TEXT NOT NULL,
  last_synced_at TEXT NOT NULL,
  PRIMARY KEY (group_id, member_device_id)
);

CREATE TABLE IF NOT EXISTS autopilot_profiles (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  deployment_mode TEXT,
  out_of_box_experience TEXT,
  hybrid_join_config TEXT,
  assigned_group_ids TEXT,
  last_synced_at TEXT NOT NULL,
  raw_json TEXT
);

CREATE TABLE IF NOT EXISTS autopilot_profile_assignments (
  profile_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  last_synced_at TEXT NOT NULL,
  PRIMARY KEY (profile_id, group_id)
);

CREATE TABLE IF NOT EXISTS tag_config (
  group_tag TEXT PRIMARY KEY,
  expected_profile_names TEXT NOT NULL,
  expected_group_names TEXT NOT NULL,
  property_label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS device_state (
  device_key TEXT PRIMARY KEY,
  serial_number TEXT,
  autopilot_id TEXT,
  intune_id TEXT,
  entra_id TEXT,
  device_name TEXT,
  property_label TEXT,
  group_tag TEXT,
  assigned_profile_name TEXT,
  autopilot_assigned_user_upn TEXT,
  intune_primary_user_upn TEXT,
  last_checkin_at TEXT,
  trust_type TEXT,
  has_autopilot_record INTEGER NOT NULL,
  has_intune_record INTEGER NOT NULL,
  has_entra_record INTEGER NOT NULL,
  has_profile_assigned INTEGER NOT NULL,
  profile_assignment_status TEXT,
  is_in_correct_group INTEGER NOT NULL,
  deployment_mode TEXT,
  deployment_mode_mismatch INTEGER NOT NULL,
  hybrid_join_configured INTEGER NOT NULL,
  hybrid_join_risk INTEGER NOT NULL,
  user_assignment_match INTEGER,
  compliance_state TEXT,
  provisioning_stalled INTEGER NOT NULL,
  tag_mismatch INTEGER NOT NULL DEFAULT 0,
  assignment_path TEXT NOT NULL,
  assignment_chain_complete INTEGER NOT NULL,
  assignment_break_point TEXT,
  active_flags TEXT NOT NULL,
  flag_count INTEGER NOT NULL,
  overall_health TEXT NOT NULL,
  diagnosis TEXT NOT NULL,
  match_confidence TEXT NOT NULL,
  matched_on TEXT NOT NULL,
  identity_conflict INTEGER NOT NULL DEFAULT 0,
  computed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS device_state_history (
  device_key TEXT NOT NULL,
  serial_number TEXT,
  computed_at TEXT NOT NULL,
  overall_health TEXT NOT NULL,
  active_flags TEXT NOT NULL,
  PRIMARY KEY (device_key, computed_at)
);

CREATE TABLE IF NOT EXISTS sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sync_type TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  devices_synced INTEGER DEFAULT 0,
  errors TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_autopilot_serial ON autopilot_devices(serial_number);
CREATE INDEX IF NOT EXISTS idx_intune_serial ON intune_devices(serial_number);
CREATE INDEX IF NOT EXISTS idx_entra_serial ON entra_devices(serial_number);
CREATE INDEX IF NOT EXISTS idx_device_state_health ON device_state(overall_health);
CREATE INDEX IF NOT EXISTS idx_device_state_profile ON device_state(assigned_profile_name);
CREATE INDEX IF NOT EXISTS idx_groups_display_name ON groups(display_name);
