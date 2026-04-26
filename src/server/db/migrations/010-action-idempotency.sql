-- Idempotency for destructive remote actions. The client sends an
-- Idempotency-Key header per click; if we've seen the same key in the
-- last 24h, we replay the original result instead of re-dispatching.
ALTER TABLE action_log ADD COLUMN idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_action_log_idempotency
  ON action_log(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
