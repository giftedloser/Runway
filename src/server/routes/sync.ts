import { Router } from "express";

import type Database from "better-sqlite3";

import { getSyncStatus } from "../db/queries/sync.js";
import { fullSync, getSyncState } from "../sync/sync-service.js";

export function syncRouter(db: Database.Database) {
  const router = Router();

  router.get("/status", (_request, response) => {
    response.json(getSyncStatus(db, getSyncState()));
  });

  router.post("/", async (_request, response, next) => {
    try {
      await fullSync(db, "manual");
      response.status(202).json(getSyncStatus(db, getSyncState()));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
