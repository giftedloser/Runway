CREATE TABLE IF NOT EXISTS graph_assignments (
  payload_kind TEXT NOT NULL,
  payload_id TEXT NOT NULL,
  payload_name TEXT NOT NULL,
  group_id TEXT NOT NULL,
  intent TEXT,
  target_type TEXT NOT NULL,
  raw_json TEXT NOT NULL,
  synced_at TEXT NOT NULL,
  PRIMARY KEY (payload_kind, payload_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_graph_assignments_group
  ON graph_assignments(group_id);

CREATE INDEX IF NOT EXISTS idx_graph_assignments_payload
  ON graph_assignments(payload_kind, payload_id);
