import { Router } from "express";

import type Database from "better-sqlite3";

import { getFirstRunStatus } from "../setup/first-run.js";

export function setupRouter(db: Database.Database) {
  const router = Router();

  router.get("/status", (_request, response) => {
    response.json(getFirstRunStatus(db));
  });

  return router;
}
