import { createApp } from "./app.js";
import { config } from "./config.js";
import { resolveEnvPath } from "./config/env-writer.js";
import { getDb } from "./db/database.js";
import { runMigrations } from "./db/migrate.js";
import { logger } from "./logger.js";
import { startRetentionScheduler } from "./maintenance/retention.js";
import { getAppSettingValues } from "./settings/app-settings.js";
import { fullSync, getSyncState, startBackgroundSync } from "./sync/sync-service.js";

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function bootstrap() {
  // Surface the active .env path on every boot so that "credentials in
  // the wrong file" is debuggable from backend-launch.log alone. Without
  // this, an operator who edits a stranger .env (e.g., the dev project
  // root) has no signal that the running server reads from somewhere
  // else entirely.
  logger.info(
    {
      envPath: resolveEnvPath(),
      graphConfigured: config.isGraphConfigured,
      graphMissing: config.graphMissing
    },
    "[startup] Runway env loaded"
  );

  const db = getDb();
  runMigrations(db);

  const stateCount = (db.prepare("SELECT COUNT(*) as count FROM device_state").get() as { count: number })
    .count;
  const appSettings = getAppSettingValues(db);

  // First-run seed/sync. fullSync owns the mock-vs-real branching now —
  // we just trigger it once here when device_state is empty.
  if (stateCount === 0 && appSettings.syncOnLaunch && !appSettings.syncPaused) {
    fullSync(db, "full").catch((error) => {
      logger.error({ err: error }, "Initial sync/seed failed.");
    });
  }

  startBackgroundSync(db);
  startRetentionScheduler(db);

  const app = createApp(db);
  const server = app.listen(config.PORT, config.HOST, () => {
    logger.info(`Runway API listening on http://${config.HOST}:${config.PORT}`);
  });

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "Shutdown requested; draining.");

    server.close((error) => {
      if (error) logger.error({ err: error }, "Error closing HTTP server.");

      // Wait for any in-flight sync to drain before closing the DB.
      const waitForSync = () =>
        new Promise<void>((resolve) => {
          const tick = () => {
            if (!getSyncState().inProgress) return resolve();
            setTimeout(tick, 200);
          };
          tick();
        });

      Promise.race([
        waitForSync(),
        new Promise<void>((resolve) => setTimeout(resolve, SHUTDOWN_TIMEOUT_MS))
      ]).finally(() => {
        try {
          db.close();
        } catch (closeError) {
          logger.error({ err: closeError }, "Error closing database.");
        }
        process.exit(0);
      });
    });

    setTimeout(() => {
      logger.warn("Shutdown drain exceeded budget; forcing exit.");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS + 2_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

bootstrap().catch((error) => {
  logger.error({ err: error }, "Runway failed to start.");
  process.exitCode = 1;
});
