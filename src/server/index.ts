import { createApp } from "./app.js";
import { config } from "./config.js";
import { getDb } from "./db/database.js";
import { runMigrations } from "./db/migrate.js";
import { seedMockData } from "./db/seed.js";
import { logger } from "./logger.js";
import { startBackgroundSync, fullSync } from "./sync/sync-service.js";

async function bootstrap() {
  const db = getDb();
  runMigrations(db);

  const stateCount = (db.prepare("SELECT COUNT(*) as count FROM device_state").get() as { count: number })
    .count;

  if (stateCount === 0 && config.SEED_MODE === "mock" && !config.isGraphConfigured) {
    await seedMockData(db);
  }

  if (stateCount === 0 && config.isGraphConfigured) {
    fullSync(db, "full").catch((error) => {
      logger.error({ err: error }, "Initial sync failed.");
    });
  }

  startBackgroundSync(db);

  const app = createApp(db);
  app.listen(config.PORT, config.HOST, () => {
    logger.info(`PilotCheck API listening on http://${config.HOST}:${config.PORT}`);
  });
}

bootstrap().catch((error) => {
  logger.error({ err: error }, "PilotCheck failed to start.");
  process.exitCode = 1;
});
