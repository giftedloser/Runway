import { Router } from "express";

import type Database from "better-sqlite3";

import { getDashboard } from "../db/queries/devices.js";

export function dashboardRouter(db: Database.Database) {
  const router = Router();

  router.get("/", (_request, response) => {
    response.json(getDashboard(db));
  });

  return router;
}
