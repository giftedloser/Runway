-- Speeds up the audit-log export at /api/actions/logs/export, which
-- pulls up to 100k rows ordered by triggered_at DESC. Without a
-- covering index this is a sequential scan — fine on a small fleet
-- today, but worth fixing before the first tenant soak so the export
-- stays snappy as action history grows.

CREATE INDEX IF NOT EXISTS idx_action_log_triggered_at
  ON action_log (triggered_at DESC);
