import fs from "node:fs";
import path from "node:path";

import type Database from "better-sqlite3";

const migrationsDirCandidates = [
  path.resolve(process.cwd(), "src/server/db/migrations"),
  path.resolve(process.cwd(), "dist/server/migrations")
];

function getMigrationsDir() {
  const existing = migrationsDirCandidates.find((candidate) => fs.existsSync(candidate));
  if (!existing) {
    throw new Error(`Could not locate SQL migrations. Checked: ${migrationsDirCandidates.join(", ")}`);
  }
  return existing;
}

export function runMigrations(db: Database.Database) {
  const migrationsDir = getMigrationsDir();
  const applied = new Set(
    db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'")
      .all().length
      ? (db.prepare("SELECT id FROM schema_migrations").all() as Array<{ id: string }>).map(
          (row) => row.id
        )
      : []
  );

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    db.exec(sql);
    db.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)").run(
      file,
      new Date().toISOString()
    );
  }
}
