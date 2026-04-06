import { Router } from "express";
import { z } from "zod";

import type Database from "better-sqlite3";

import { getSettings, deleteTagConfig, upsertTagConfig } from "../db/queries/settings.js";
import { computeAllDeviceStates } from "../engine/compute-all-device-states.js";

const tagConfigSchema = z.object({
  groupTag: z.string().min(1),
  expectedProfileNames: z.array(z.string()),
  expectedGroupNames: z.array(z.string()),
  propertyLabel: z.string().min(1)
});

export function settingsRouter(db: Database.Database) {
  const router = Router();

  router.get("/tag-config", (_request, response) => {
    response.json(getSettings(db).tagConfig);
  });

  router.post("/tag-config", (request, response) => {
    const record = tagConfigSchema.parse(request.body);
    upsertTagConfig(db, record);
    computeAllDeviceStates(db);
    response.status(201).json(getSettings(db).tagConfig);
  });

  router.put("/tag-config/:groupTag", (request, response) => {
    const record = tagConfigSchema.parse({
      ...request.body,
      groupTag: request.params.groupTag
    });
    upsertTagConfig(db, record);
    computeAllDeviceStates(db);
    response.json(getSettings(db).tagConfig);
  });

  router.delete("/tag-config/:groupTag", (request, response) => {
    deleteTagConfig(db, request.params.groupTag);
    computeAllDeviceStates(db);
    response.status(204).send();
  });

  router.get("/", (_request, response) => {
    response.json(getSettings(db));
  });

  return router;
}
