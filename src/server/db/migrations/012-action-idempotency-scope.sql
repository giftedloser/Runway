-- Scope idempotency keys to the exact action request so a key cannot
-- replay a result for another device or a different body.
ALTER TABLE action_log ADD COLUMN idempotency_scope TEXT;
