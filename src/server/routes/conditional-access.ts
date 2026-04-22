import { Router } from "express";

import type Database from "better-sqlite3";

import { requireDelegatedAuth } from "../auth/auth-middleware.js";
import type { ConditionalAccessPolicyRow } from "../db/types.js";

function parseJsonField(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function formatPolicy(row: ConditionalAccessPolicyRow) {
  return {
    id: row.id,
    displayName: row.display_name,
    state: row.state,
    conditions: parseJsonField(row.conditions_json),
    grantControls: parseJsonField(row.grant_controls_json),
    sessionControls: parseJsonField(row.session_controls_json),
    lastSyncedAt: row.last_synced_at
  };
}

export function conditionalAccessRouter(db: Database.Database) {
  const router = Router();
  router.use(requireDelegatedAuth);

  router.get("/", (_request, response) => {
    const rows = db
      .prepare("SELECT * FROM conditional_access_policies ORDER BY display_name")
      .all() as ConditionalAccessPolicyRow[];
    response.json(rows.map(formatPolicy));
  });

  router.get("/:policyId", (request, response) => {
    const row = db
      .prepare("SELECT * FROM conditional_access_policies WHERE id = ?")
      .get(request.params.policyId) as ConditionalAccessPolicyRow | undefined;
    if (!row) {
      response.status(404).json({ message: "Conditional access policy not found." });
      return;
    }
    response.json(formatPolicy(row));
  });

  return router;
}
