import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

import { config } from "../config.js";

let database: Database.Database | null = null;

export function getDb() {
  if (database) {
    return database;
  }

  const resolvedPath = path.resolve(process.cwd(), config.DATABASE_PATH);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  database = new Database(resolvedPath);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  return database;
}
