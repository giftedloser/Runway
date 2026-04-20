-- Persistent saved views for the device queue.
-- The UI already supports URL-param round-tripping for search/health/flag/
-- property/profile/pageSize; these columns simply cache those params under
-- a user-chosen name so operators can recall common triage filters in one
-- click without re-typing.
CREATE TABLE IF NOT EXISTS user_views (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  search TEXT,
  health TEXT,
  flag TEXT,
  property TEXT,
  profile TEXT,
  page_size INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_views_sort ON user_views(sort_order, created_at);
