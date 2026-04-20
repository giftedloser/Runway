import { Router } from "express";
import { z } from "zod";

import type Database from "better-sqlite3";

import {
  createUserView,
  deleteUserView,
  listUserViews,
  reorderUserViews,
  updateUserView
} from "../db/queries/user-views.js";

const healthSchema = z.enum(["critical", "warning", "info", "healthy", "unknown"]).nullable();
const flagSchema = z
  .enum([
    "no_autopilot_record",
    "no_profile_assigned",
    "profile_assignment_failed",
    "profile_assigned_not_enrolled",
    "not_in_target_group",
    "deployment_mode_mismatch",
    "hybrid_join_risk",
    "user_mismatch",
    "provisioning_stalled",
    "compliance_drift",
    "orphaned_autopilot",
    "missing_ztdid",
    "identity_conflict",
    "tag_mismatch"
  ])
  .nullable();

const viewInputSchema = z.object({
  name: z.string().min(1).max(80),
  search: z.string().nullable().optional(),
  health: healthSchema.optional(),
  flag: flagSchema.optional(),
  property: z.string().nullable().optional(),
  profile: z.string().nullable().optional(),
  pageSize: z.number().int().positive().max(200).nullable().optional()
});

export function userViewsRouter(db: Database.Database) {
  const router = Router();

  router.get("/", (_request, response) => {
    response.json(listUserViews(db));
  });

  router.post("/", (request, response) => {
    const result = viewInputSchema.safeParse(request.body);
    if (!result.success) {
      response.status(400).json({
        message: "Invalid view.",
        errors: result.error.flatten().fieldErrors
      });
      return;
    }
    const created = createUserView(db, result.data);
    response.status(201).json(created);
  });

  router.put("/reorder", (request, response) => {
    const parsed = z.object({ ids: z.array(z.string().min(1)) }).safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ message: "Invalid reorder payload." });
      return;
    }
    reorderUserViews(db, parsed.data.ids);
    response.json(listUserViews(db));
  });

  router.put("/:id", (request, response) => {
    const result = viewInputSchema.partial().safeParse(request.body);
    if (!result.success) {
      response.status(400).json({
        message: "Invalid view.",
        errors: result.error.flatten().fieldErrors
      });
      return;
    }
    const updated = updateUserView(db, request.params.id, result.data);
    if (!updated) {
      response.status(404).json({ message: "View not found." });
      return;
    }
    response.json(updated);
  });

  router.delete("/:id", (request, response) => {
    const removed = deleteUserView(db, request.params.id);
    if (!removed) {
      response.status(404).json({ message: "View not found." });
      return;
    }
    response.status(204).send();
  });

  return router;
}
