import { Router } from "express";

import type Database from "better-sqlite3";

import { getDashboard } from "../db/queries/devices.js";
import { logger } from "../logger.js";

export function dashboardRouter(db: Database.Database) {
  const router = Router();

  router.get("/", (_request, response) => {
    try {
      response.json(getDashboard(db));
    } catch (error) {
      logger.error({ err: error }, "Failed to load dashboard");
      response.status(500).json({ error: "Failed to load dashboard." });
    }
  });

  return router;
}
