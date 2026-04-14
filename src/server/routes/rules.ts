import { Router } from "express";
import { z } from "zod";

import type Database from "better-sqlite3";

import { requireDelegatedAuth } from "../auth/auth-middleware.js";
import {
  createRule,
  deleteRule,
  listRules,
  updateRule,
  type RuleInput
} from "../db/queries/rules.js";
import { computeAllDeviceStates } from "../engine/compute-all-device-states.js";

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

  router.post("/", requireDelegatedAuth, (request, response) => {
    const result = ruleInputSchema.safeParse(request.body);
    if (!result.success) {
      response.status(400).json({ message: "Invalid rule.", errors: result.error.flatten().fieldErrors });
      return;
    }
    const created = createRule(db, result.data as RuleInput);
    computeAllDeviceStates(db);
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
    computeAllDeviceStates(db);
    response.json(updated);
  });

  router.delete("/:id", requireDelegatedAuth, (request, response) => {
    const removed = deleteRule(db, request.params.id);
    if (!removed) {
      response.status(404).json({ message: "Rule not found." });
      return;
    }
    computeAllDeviceStates(db);
    response.status(204).send();
  });

  return router;
}
