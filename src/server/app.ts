import path from "node:path";
import fs from "node:fs";

import express from "express";
import pinoHttp from "pino-http";
import type Database from "better-sqlite3";

import { logger } from "./logger.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { devicesRouter } from "./routes/devices.js";
import { healthRouter } from "./routes/health.js";
import { profilesRouter } from "./routes/profiles.js";
import { settingsRouter } from "./routes/settings.js";
import { syncRouter } from "./routes/sync.js";

export function createApp(db: Database.Database) {
  const app = express();

  app.use(express.json());
  app.use(pinoHttp({ logger }));

  app.use("/api/health", healthRouter(db));
  app.use("/api/dashboard", dashboardRouter(db));
  app.use("/api/devices", devicesRouter(db));
  app.use("/api/profiles", profilesRouter(db));
  app.use("/api/sync", syncRouter(db));
  app.use("/api/settings", settingsRouter(db));

  const clientDist = path.resolve(process.cwd(), "dist/client");
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get(/^(?!\/api).*/, (_request, response) => {
      response.sendFile(path.join(clientDist, "index.html"));
    });
  }

  app.use(
    (
      error: unknown,
      _request: express.Request,
      response: express.Response,
      next: express.NextFunction
    ) => {
      void next;
      logger.error({ err: error }, "Request failed.");
      response.status(500).json({
        message: error instanceof Error ? error.message : "Unexpected server error"
      });
    }
  );

  return app;
}
