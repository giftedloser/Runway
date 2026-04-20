import path from "node:path";
import fs from "node:fs";

import express from "express";
import session from "express-session";
import pinoHttp from "pino-http";
import type Database from "better-sqlite3";

import { config } from "./config.js";
import { logger } from "./logger.js";
import { actionsRouter } from "./routes/actions.js";
import { autopilotImportRouter } from "./routes/autopilot-import.js";
import { authRouter } from "./routes/auth.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { devicesRouter } from "./routes/devices.js";
import { groupsRouter } from "./routes/groups.js";
import { healthRouter } from "./routes/health.js";
import { bitlockerRouter } from "./routes/bitlocker.js";
import { lapsRouter } from "./routes/laps.js";
import { licensingRouter } from "./routes/licensing.js";
import { conditionalAccessRouter } from "./routes/conditional-access.js";
import { provisioningRouter } from "./routes/provisioning.js";
import { profilesRouter } from "./routes/profiles.js";
import { rulesRouter } from "./routes/rules.js";
import { settingsRouter } from "./routes/settings.js";
import { syncRouter } from "./routes/sync.js";
import { userViewsRouter } from "./routes/user-views.js";

function isLoopbackHost(host: string) {
  return host === "127.0.0.1" || host === "::1" || host === "localhost";
}

export function createApp(db: Database.Database) {
  const app = express();

  app.use(express.json());
  app.use(pinoHttp({ logger }));

  // Session middleware for delegated auth.
  // This server is intended to run on the admin workstation (Tauri sidecar)
  // so the default binding is localhost. `secure` defaults to true except
  // when NODE_ENV is explicitly "development", which avoids the common
  // footgun of forgetting to flip this on for production deployments.
  const isDev = process.env.NODE_ENV === "development";
  const cookieRequiresHttps = !isDev && !isLoopbackHost(config.HOST);
  app.use(
    session({
      secret: config.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      name: "pilotcheck.sid",
      cookie: {
        httpOnly: true,
        secure: cookieRequiresHttps,
        sameSite: "lax",
        maxAge: 3600 * 1000 // 1 hour
      }
    })
  );

  // Routes
  app.use("/api/health", healthRouter(db));
  app.use("/api/auth", authRouter());
  app.use("/api/dashboard", dashboardRouter(db));
  app.use("/api/devices", devicesRouter(db));
  app.use("/api/profiles", profilesRouter(db));
  app.use("/api/groups", groupsRouter(db));
  app.use("/api/sync", syncRouter(db));
  app.use("/api/settings", settingsRouter(db));
  app.use("/api/rules", rulesRouter(db));
  app.use("/api/user-views", userViewsRouter(db));
  app.use("/api/actions", actionsRouter(db));
  app.use("/api/laps", lapsRouter(db));
  app.use("/api/bitlocker", bitlockerRouter(db));
  app.use("/api/licensing", licensingRouter(db));
  app.use("/api/conditional-access", conditionalAccessRouter(db));
  app.use("/api/provisioning", provisioningRouter(db));
  app.use("/api/autopilot-import", autopilotImportRouter(db));

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
