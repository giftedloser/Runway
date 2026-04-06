import { Router } from "express";

import type Database from "better-sqlite3";

import { getProfileDetail, listProfiles } from "../db/queries/profiles.js";

export function profilesRouter(db: Database.Database) {
  const router = Router();

  router.get("/", (_request, response) => {
    response.json(listProfiles(db));
  });

  router.get("/:profileId", (request, response) => {
    const profile = getProfileDetail(db, request.params.profileId);
    if (!profile) {
      response.status(404).json({ message: "Profile not found." });
      return;
    }
    response.json(profile);
  });

  return router;
}
