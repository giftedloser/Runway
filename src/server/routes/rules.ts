import { Router } from "express";
import { z } from "zod";

import type Database from "better-sqlite3";

import type { RulePredicate } from "../../shared/types.js";
import { requireDelegatedAuth } from "../auth/auth-middleware.js";
import {
  createRule,
  deleteRule,
  listRules,
  updateRule,
  type RuleInput
} from "../db/queries/rules.js";
import { computeAllDeviceStates } from "../engine/compute-all-device-states.js";
import { previewRule } from "../engine/preview-rule.js";
import { logger } from "../logger.js";

const opSchema = z.enum([
  "eq",
  "neq",
  "contains",
  "not_contains",
  "starts_with",
  "ends_with",
  "exists",
  "missing",
  "older_than_hours",
  "newer_than_hours",
  "in",
  "not_in"
]);

// Recursive schema for the predicate DSL. Zod requires a lazy reference
// because the type is recursive.
const predicateSchema: z.ZodType = z.lazy(() =>
  z.union([
    z.object({
      type: z.literal("leaf"),
      field: z.string().min(1),
      op: opSchema,
      value: z.union([z.string(), z.number(), z.boolean(), z.null()]).default(null)
    }),
    z.object({
      type: z.literal("and"),
      children: z.array(predicateSchema)
    }),
    z.object({
      type: z.literal("or"),
      children: z.array(predicateSchema)
    }),
    z.object({
      type: z.literal("not"),
      child: predicateSchema
    })
  ])
);

const ruleInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  severity: z.enum(["info", "warning", "critical"]),
  scope: z.enum(["global", "property", "profile"]),
  scopeValue: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
  predicate: predicateSchema
});

export function rulesRouter(db: Database.Database) {
  const router = Router();

  router.get("/", (_request, response) => {
    response.json(listRules(db));
  });

  // Dry-run: evaluate a predicate against the current device_state snapshot
  // and return (count, sample). Does not persist anything. Unauthenticated
  // on purpose — it operates on already-synced data and helps rule authors
  // validate a predicate before saving.
  router.post("/preview", (request, response) => {
    const schema = z.object({
      predicate: predicateSchema,
      scope: z.enum(["global", "property", "profile"]).optional(),
      scopeValue: z.string().nullable().optional(),
      severity: z.enum(["info", "warning", "critical"]).optional()
    });
    const result = schema.safeParse(request.body);
    if (!result.success) {
      response.status(400).json({
        message: "Invalid preview payload.",
        errors: result.error.flatten().fieldErrors
      });
      return;
    }
    try {
      const preview = previewRule(
        db,
        result.data.predicate as RulePredicate,
        result.data.scope ?? "global",
        result.data.scopeValue ?? null,
        result.data.severity ?? "warning"
      );
      response.json(preview);
    } catch (error) {
      logger.error({ err: error }, "Rule preview failed");
      response.status(500).json({
        message: error instanceof Error ? error.message : "Preview failed"
      });
    }
  });

  router.post("/", requireDelegatedAuth, (request, response) => {
    const result = ruleInputSchema.safeParse(request.body);
    if (!result.success) {
      response.status(400).json({ message: "Invalid rule.", errors: result.error.flatten().fieldErrors });
      return;
    }
    const created = createRule(db, result.data as RuleInput);
    try { computeAllDeviceStates(db); } catch (error) { logger.error({ err: error }, "Failed to recompute device states after rule creation"); }
    response.status(201).json(created);
  });

  router.put("/:id", requireDelegatedAuth, (request, response) => {
    const result = ruleInputSchema.partial().safeParse(request.body);
    if (!result.success) {
      response.status(400).json({ message: "Invalid rule.", errors: result.error.flatten().fieldErrors });
      return;
    }
    const updated = updateRule(db, request.params.id, result.data as Partial<RuleInput>);
    if (!updated) {
      response.status(404).json({ message: "Rule not found." });
      return;
    }
    try { computeAllDeviceStates(db); } catch (error) { logger.error({ err: error }, "Failed to recompute device states after rule update"); }
    response.json(updated);
  });

  router.delete("/:id", requireDelegatedAuth, (request, response) => {
    const removed = deleteRule(db, request.params.id);
    if (!removed) {
      response.status(404).json({ message: "Rule not found." });
      return;
    }
    try { computeAllDeviceStates(db); } catch (error) { logger.error({ err: error }, "Failed to recompute device states after rule deletion"); }
    response.status(204).send();
  });

  return router;
}
