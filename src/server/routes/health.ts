import { Router } from "express";

import type Database from "better-sqlite3";

export function healthRouter(db: Database.Database) {
  const router = Router();

  router.get("/", (_request, response) => {
    const dbReady = Boolean(
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'device_state'").get()
    );

    response.json({
      ok: true,
      dbReady,
      uptimeSeconds: process.uptime()
    });
  });

  return router;
}
