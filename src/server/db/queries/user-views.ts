import { randomUUID } from "node:crypto";

import type Database from "better-sqlite3";

import type { SavedView, SavedViewInput } from "../../../shared/types.js";

interface ViewRow {
  id: string;
  name: string;
  search: string | null;
  health: string | null;
  flag: string | null;
  property: string | null;
  profile: string | null;
  page_size: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

function rowToView(row: ViewRow): SavedView {
  return {
    id: row.id,
    name: row.name,
    search: row.search,
    health: (row.health as SavedView["health"]) ?? null,
    flag: (row.flag as SavedView["flag"]) ?? null,
    property: row.property,
    profile: row.profile,
    pageSize: row.page_size ?? null,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function listUserViews(db: Database.Database): SavedView[] {
  const rows = db
    .prepare("SELECT * FROM user_views ORDER BY sort_order ASC, created_at ASC")
    .all() as ViewRow[];
  return rows.map(rowToView);
}

export function getUserView(db: Database.Database, id: string): SavedView | null {
  const row = db
    .prepare("SELECT * FROM user_views WHERE id = ?")
    .get(id) as ViewRow | undefined;
  return row ? rowToView(row) : null;
}

export function createUserView(db: Database.Database, input: SavedViewInput): SavedView {
  const id = randomUUID();
  const now = new Date().toISOString();
  // New views sort to the end of the list by default.
  const maxOrder = (
    db.prepare("SELECT COALESCE(MAX(sort_order), -1) AS max FROM user_views").get() as {
      max: number;
    }
  ).max;
  db.prepare(
    `INSERT INTO user_views
       (id, name, search, health, flag, property, profile, page_size, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.name,
    input.search ?? null,
    input.health ?? null,
    input.flag ?? null,
    input.property ?? null,
    input.profile ?? null,
    input.pageSize ?? null,
    maxOrder + 1,
    now,
    now
  );
  return getUserView(db, id)!;
}

export function updateUserView(
  db: Database.Database,
  id: string,
  input: Partial<SavedViewInput> & { sortOrder?: number }
): SavedView | null {
  const existing = getUserView(db, id);
  if (!existing) return null;
  const merged: Required<
    Pick<SavedView, "name" | "search" | "health" | "flag" | "property" | "profile" | "pageSize" | "sortOrder">
  > = {
    name: input.name ?? existing.name,
    search: input.search === undefined ? existing.search : input.search,
    health: input.health === undefined ? existing.health : input.health,
    flag: input.flag === undefined ? existing.flag : input.flag,
    property: input.property === undefined ? existing.property : input.property,
    profile: input.profile === undefined ? existing.profile : input.profile,
    pageSize: input.pageSize === undefined ? existing.pageSize : input.pageSize,
    sortOrder: input.sortOrder ?? existing.sortOrder
  };
  db.prepare(
    `UPDATE user_views SET
       name = ?,
       search = ?,
       health = ?,
       flag = ?,
       property = ?,
       profile = ?,
       page_size = ?,
       sort_order = ?,
       updated_at = ?
     WHERE id = ?`
  ).run(
    merged.name,
    merged.search,
    merged.health,
    merged.flag,
    merged.property,
    merged.profile,
    merged.pageSize,
    merged.sortOrder,
    new Date().toISOString(),
    id
  );
  return getUserView(db, id);
}

export function deleteUserView(db: Database.Database, id: string): boolean {
  const info = db.prepare("DELETE FROM user_views WHERE id = ?").run(id);
  return info.changes > 0;
}

export function reorderUserViews(db: Database.Database, orderedIds: string[]): void {
  const stmt = db.prepare("UPDATE user_views SET sort_order = ?, updated_at = ? WHERE id = ?");
  const now = new Date().toISOString();
  const tx = db.transaction((ids: string[]) => {
    ids.forEach((id, index) => {
      stmt.run(index, now, id);
    });
  });
  tx(orderedIds);
}
