-- SCCM / ConfigMgr detection.
--
-- Intune's `managedDevice.managementAgent` field reports whether a device
-- is running the ConfigMgr client (values containing "configurationManager"
-- indicate co-management / tenant attach). We capture the raw value so the
-- UI can surface a simple "ConfigMgr client detected" signal and the rule
-- engine can author predicates against it.
--
-- feature_flags is a small generic key/value store for on/off switches.
-- We use it instead of hard-coding columns per feature so new booleans
-- ("detect ConfigMgr", "show experimental trends", etc.) don't require a
-- migration each time. Only the server writes defaults; operators toggle
-- values via the Settings UI.

ALTER TABLE intune_devices ADD COLUMN management_agent TEXT;

CREATE TABLE IF NOT EXISTS feature_flags (
  key TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

-- Seed the SCCM detection flag as OFF so existing installs don't suddenly
-- sprout a new device-detail tile without the operator asking for it.
INSERT OR IGNORE INTO feature_flags (key, enabled, updated_at)
VALUES ('sccm_detection', 0, datetime('now'));
