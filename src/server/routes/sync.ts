import { Router } from "express";

import type Database from "better-sqlite3";

import { hasValidDelegatedSession, requireDelegatedAuth } from "../auth/auth-middleware.js";
import { getSyncStatus } from "../db/queries/sync.js";
import { logger } from "../logger.js";
import { fullSync, getSyncState } from "../sync/sync-service.js";

export function syncRouter(db: Database.Database) {
  const router = Router();

  router.get("/status", (request, response) => {
    const status = getSyncStatus(db, getSyncState(), {
      canTriggerManualSync: hasValidDelegatedSession(request)
    });
    if (status.inProgress || status.lastError) {
      logger.info(
        { inProgress: status.inProgress, lastError: status.lastError },
        "[v1.6][sync-pill] Sync status reported notable state"
      );
    }
    response.json(status);
  });

  router.post("/", requireDelegatedAuth, async (_request, response, next) => {
    try {
      logger.info("[v1.6][sync-pill] Manual sync requested");
      await fullSync(db, "manual");
      response.status(202).json(getSyncStatus(db, getSyncState(), { canTriggerManualSync: true }));
    } catch (error) {
      logger.error({ err: error }, "[v1.6][sync-pill] Manual sync failed");
      next(error);
    }
  });

  return router;
}
