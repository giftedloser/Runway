-- Groups per-device audit rows emitted by a single bulk action request.
ALTER TABLE action_log ADD COLUMN bulk_run_id TEXT;

CREATE INDEX IF NOT EXISTS idx_action_log_bulk_run
  ON action_log(bulk_run_id)
  WHERE bulk_run_id IS NOT NULL;
