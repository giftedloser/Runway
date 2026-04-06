import { getDb } from "./database.js";
import { runMigrations } from "./migrate.js";
import { seedMockData } from "./seed.js";

async function main() {
  const db = getDb();
  runMigrations(db);

  const command = process.argv[2];

  if (command === "seed") {
    await seedMockData(db);
    return;
  }

  if (command !== "migrate") {
    throw new Error(`Unknown db command: ${command}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
