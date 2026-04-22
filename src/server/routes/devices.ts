import { Router } from "express";

import type Database from "better-sqlite3";

import { hasValidDelegatedSession } from "../auth/auth-middleware.js";
import {
  getDeviceDetail,
  getDeviceHistory,
  getRelatedDevices,
  listDeviceStates
} from "../db/queries/devices.js";
import { logger } from "../logger.js";

export function devicesRouter(db: Database.Database) {
  const router = Router();

  router.get("/", (request, response) => {
    try {
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
    } catch (error) {
      logger.error({ err: error }, "Failed to list devices");
      response.status(500).json({ error: "Failed to list devices." });
    }
  });

  router.get("/:deviceKey", (request, response) => {
    try {
      const device = getDeviceDetail(db, request.params.deviceKey, {
        includeRawJson: hasValidDelegatedSession(request)
      });
      if (!device) {
        response.status(404).json({ message: "Device not found." });
        return;
      }
      response.json(device);
    } catch (error) {
      logger.error({ err: error, deviceKey: request.params.deviceKey }, "Failed to get device detail");
      response.status(500).json({ error: "Failed to get device detail." });
    }
  });

  router.get("/:deviceKey/history", (request, response) => {
    try {
      response.json(getDeviceHistory(db, request.params.deviceKey));
    } catch (error) {
      logger.error({ err: error, deviceKey: request.params.deviceKey }, "Failed to get device history");
      response.status(500).json({ error: "Failed to get device history." });
    }
  });

  router.get("/:deviceKey/related-devices", (request, response) => {
    try {
      const device = getDeviceDetail(db, request.params.deviceKey);
      if (!device) {
        response.status(404).json({ message: "Device not found." });
        return;
      }
      const userUpn = device.summary.intunePrimaryUserUpn ?? device.summary.autopilotAssignedUserUpn;
      if (!userUpn) {
        response.json([]);
        return;
      }
      response.json(getRelatedDevices(db, userUpn, request.params.deviceKey));
    } catch (error) {
      logger.error({ err: error, deviceKey: request.params.deviceKey }, "Failed to get related devices");
      response.status(500).json({ error: "Failed to get related devices." });
    }
  });

  return router;
}
