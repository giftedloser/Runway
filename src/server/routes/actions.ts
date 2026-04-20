import { Router } from "express";
import type Database from "better-sqlite3";

import type { RemoteActionType } from "../../shared/types.js";
import { requireDelegatedAuth, getDelegatedToken, getDelegatedUser } from "../auth/auth-middleware.js";
import {
  syncDevice,
  rebootDevice,
  renameDevice,
  autopilotReset,
  retireDevice,
  wipeDevice,
  rotateLapsPassword,
  changePrimaryUser,
  deleteIntuneDevice,
  deleteEntraDevice,
  deleteAutopilotDevice
} from "../actions/remote-actions.js";
import { listActionLogs, listDeviceActionLogs, logAction } from "../db/queries/actions.js";

const VALID_ACTIONS: ReadonlySet<RemoteActionType> = new Set([
  "sync",
  "reboot",
  "rename",
  "autopilot-reset",
  "retire",
  "wipe",
  "rotate-laps",
  "change-primary-user",
  "delete-intune",
  "delete-entra",
  "delete-autopilot"
]);

const INTUNE_REQUIRED_ACTIONS: ReadonlySet<RemoteActionType> = new Set([
  "sync",
  "reboot",
  "rename",
  "autopilot-reset",
  "retire",
  "wipe",
  "rotate-laps",
  "change-primary-user",
  "delete-intune"
]);

// Windows NetBIOS device names: 1-15 chars, letters/digits/hyphens only.
// Microsoft docs: no leading/trailing hyphen, no spaces, no reserved names.
const DEVICE_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9-]{0,14}$/;

function isValidDeviceName(value: unknown): value is string {
  return typeof value === "string" && DEVICE_NAME_RE.test(value);
}

function getDeviceInfo(db: Database.Database, deviceKey: string) {
  return db
    .prepare(
      `SELECT serial_number, device_name, intune_id, entra_id, autopilot_id FROM device_state WHERE device_key = ?`
    )
    .get(deviceKey) as { serial_number: string | null; device_name: string | null; intune_id: string | null; entra_id: string | null; autopilot_id: string | null } | undefined;
}

export function actionsRouter(db: Database.Database) {
  const router = Router();

  // GET /api/actions/logs — list recent actions (admin audit trail)
  router.get("/logs", requireDelegatedAuth, (request, response) => {
    const limitRaw = Number(request.query.limit);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 100;
    response.json(listActionLogs(db, limit));
  });

  // GET /api/actions/logs/:deviceKey — action history for a device
  router.get("/logs/:deviceKey", requireDelegatedAuth, (request, response) => {
    const deviceKey = String(request.params.deviceKey ?? "");
    const device = getDeviceInfo(db, deviceKey);
    if (!device) {
      response.status(404).json({ message: "Device not found." });
      return;
    }
    const limitRaw = Number(request.query.limit);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;
    response.json(listDeviceActionLogs(db, device.serial_number ?? "", limit));
  });

  // All action execution routes require delegated auth
  router.use(requireDelegatedAuth);

  // POST /api/actions/bulk — fan out an action across many devices.
  // `retire` and `rotate-laps` are allowed here because they have meaningful
  // fleet-wide use cases (end-of-life cohorts, compliance-driven LAPS
  // rotation) — but `wipe`, `autopilot-reset`, `rename`, and the three
  // `delete-*` cleanups are deliberately excluded. Those remain
  // single-device clicks so an operator cannot fat-finger a destructive
  // multi-device run.
  const BULK_ALLOWED: ReadonlySet<RemoteActionType> = new Set([
    "sync",
    "reboot",
    "retire",
    "rotate-laps"
  ]);
  router.post("/bulk", async (request, response) => {
    const action = request.body?.action as RemoteActionType | undefined;
    const deviceKeys = request.body?.deviceKeys;

    if (!action || !BULK_ALLOWED.has(action)) {
      response.status(400).json({
        message: `Bulk actions only support: ${[...BULK_ALLOWED].join(", ")}.`
      });
      return;
    }
    if (!Array.isArray(deviceKeys) || deviceKeys.length === 0) {
      response.status(400).json({ message: "deviceKeys must be a non-empty array." });
      return;
    }
    if (deviceKeys.length > 200) {
      response.status(400).json({ message: "Bulk actions are capped at 200 devices per request." });
      return;
    }

    const token = getDelegatedToken(request);
    const user = getDelegatedUser(request);
    const triggeredAt = new Date().toISOString();

    const results: Array<{
      deviceKey: string;
      success: boolean;
      status: number;
      message: string;
    }> = [];

    for (const rawKey of deviceKeys) {
      const deviceKey = String(rawKey ?? "");
      const device = getDeviceInfo(db, deviceKey);
      if (!device || !device.intune_id) {
        results.push({
          deviceKey,
          success: false,
          status: 404,
          message: device ? "No Intune enrollment." : "Device not found."
        });
        continue;
      }

      let result: { success: boolean; status: number; message: string };
      try {
        switch (action) {
          case "sync":
            result = await syncDevice(token, device.intune_id);
            break;
          case "reboot":
            result = await rebootDevice(token, device.intune_id);
            break;
          case "retire":
            result = await retireDevice(token, device.intune_id);
            break;
          case "rotate-laps":
            result = await rotateLapsPassword(token, device.intune_id);
            break;
          default:
            result = { success: false, status: 400, message: `Unsupported bulk action: ${action}` };
        }
      } catch (error) {
        result = {
          success: false,
          status: 500,
          message: error instanceof Error ? error.message : "Action failed."
        };
      }

      logAction(db, {
        deviceSerial: device.serial_number,
        deviceName: device.device_name,
        intuneId: device.intune_id,
        actionType: action,
        triggeredBy: user,
        triggeredAt,
        graphResponseStatus: result.status,
        notes: `[bulk] ${result.message}`
      });

      results.push({ deviceKey, ...result });
    }

    const successCount = results.filter((r) => r.success).length;
    response.json({
      action,
      total: results.length,
      successCount,
      failureCount: results.length - successCount,
      results
    });
  });

  // POST /api/actions/:deviceKey/:action
  router.post("/:deviceKey/:action", async (request, response) => {
    const { deviceKey, action } = request.params;
    const token = getDelegatedToken(request);
    const user = getDelegatedUser(request);

    if (!VALID_ACTIONS.has(action as RemoteActionType)) {
      response.status(400).json({ message: `Unknown action: ${action}` });
      return;
    }

    const device = getDeviceInfo(db, deviceKey);
    if (!device) {
      response.status(404).json({ message: "Device not found." });
      return;
    }
    if (INTUNE_REQUIRED_ACTIONS.has(action as RemoteActionType) && !device.intune_id) {
      response.status(400).json({ message: "Device has no Intune enrollment. Cannot execute remote actions." });
      return;
    }

    let result: { success: boolean; status: number; message: string } = {
      success: false,
      status: 500,
      message: "Action did not complete."
    };

    try {
      switch (action as RemoteActionType) {
        case "sync":
          result = await syncDevice(token, device.intune_id);
          break;
        case "reboot":
          result = await rebootDevice(token, device.intune_id);
          break;
        case "rename": {
          const newName = request.body?.deviceName;
          if (!isValidDeviceName(newName)) {
            response.status(400).json({
              message:
                "deviceName must be 1-15 characters, letters/digits/hyphens only, and cannot start with a hyphen."
            });
            return;
          }
          result = await renameDevice(token, device.intune_id, newName);
          break;
        }
        case "autopilot-reset":
          result = await autopilotReset(token, device.intune_id);
          break;
        case "retire":
          result = await retireDevice(token, device.intune_id);
          break;
        case "wipe":
          result = await wipeDevice(token, device.intune_id);
          break;
        case "rotate-laps":
          result = await rotateLapsPassword(token, device.intune_id);
          break;
        case "change-primary-user": {
          const userId = request.body?.userId;
          if (typeof userId !== "string" || !userId.trim()) {
            response.status(400).json({
              message: "userId is required (Entra user object ID or UPN)."
            });
            return;
          }
          result = await changePrimaryUser(token, device.intune_id, userId.trim());
          break;
        }
        case "delete-intune":
          result = await deleteIntuneDevice(token, device.intune_id);
          break;
        case "delete-entra": {
          if (!device.entra_id) {
            response.status(400).json({ message: "Device has no Entra ID object. Cannot delete." });
            return;
          }
          result = await deleteEntraDevice(token, device.entra_id);
          break;
        }
        case "delete-autopilot": {
          if (!device.autopilot_id) {
            response.status(400).json({ message: "Device has no Autopilot registration. Cannot delete." });
            return;
          }
          result = await deleteAutopilotDevice(token, device.autopilot_id);
          break;
        }
      }
    } catch (error) {
      result = {
        success: false,
        status: 500,
        message: error instanceof Error ? error.message : "Action failed."
      };
    }

    // Log the action
    logAction(db, {
      deviceSerial: device.serial_number,
      deviceName: device.device_name,
      intuneId: device.intune_id,
      actionType: action,
      triggeredBy: user,
      triggeredAt: new Date().toISOString(),
      graphResponseStatus: result.status,
      notes: result.message
    });

    const httpStatus = result.success ? 200 : result.status >= 400 ? result.status : 500;
    response.status(httpStatus).json(result);
  });

  return router;
}
