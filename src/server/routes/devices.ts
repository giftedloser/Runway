import { Router } from "express";

import type Database from "better-sqlite3";

import { getDeviceDetail, listDeviceStates } from "../db/queries/devices.js";

export function devicesRouter(db: Database.Database) {
  const router = Router();

  router.get("/", (request, response) => {
    const { search, health, flag, property, profile, page, pageSize } = request.query;
    response.json(
      listDeviceStates(db, {
        search: typeof search === "string" ? search : undefined,
        health: typeof health === "string" ? health : undefined,
        flag: typeof flag === "string" ? flag : undefined,
        property: typeof property === "string" ? property : undefined,
        profile: typeof profile === "string" ? profile : undefined,
        page: typeof page === "string" ? Number(page) : undefined,
        pageSize: typeof pageSize === "string" ? Number(pageSize) : undefined
      })
    );
  });

  router.get("/:deviceKey", (request, response) => {
    const device = getDeviceDetail(db, request.params.deviceKey);
    if (!device) {
      response.status(404).json({ message: "Device not found." });
      return;
    }
    response.json(device);
  });

  return router;
}
