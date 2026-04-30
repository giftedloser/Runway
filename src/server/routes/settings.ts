import { Router, type Request } from "express";
import { z } from "zod";

import type Database from "better-sqlite3";

import { requireDelegatedAuth } from "../auth/auth-middleware.js";
import { config } from "../config.js";
import { resolveEnvPath, writeEnvUpdates } from "../config/env-writer.js";
import {
  deleteTagConfig,
  FEATURE_FLAG_KEYS,
  getSettings,
  isFeatureFlagKey,
  setFeatureFlag,
  upsertTagConfig
} from "../db/queries/settings.js";
import { scheduleRecompute } from "../engine/recompute-scheduler.js";
import { previewTagConfig } from "../engine/preview-tag-config.js";
import { logger } from "../logger.js";
import {
  isAppSettingKey,
  resetAppSettings,
  setAppSetting
} from "../settings/app-settings.js";

const tagConfigSchema = z.object({
  groupTag: z.string().min(1),
  expectedProfileNames: z.array(z.string()),
  expectedGroupNames: z.array(z.string()),
  propertyLabel: z.string().min(1)
});

// GUID with dashes — both tenant and client app IDs use this shape.
const GUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const graphConfigSchema = z.object({
  tenantId: z.string().regex(GUID_RE, "Tenant ID must be a GUID."),
  clientId: z.string().regex(GUID_RE, "Client ID must be a GUID."),
  // Real Entra app secrets are ~40 chars. We reject obvious placeholders
  // and short typos before they hit disk and silently fail at the OAuth
  // callback hours later.
  clientSecret: z
    .string()
    .min(32, "Client secret looks too short to be a real Entra value (expect ~40 chars).")
    .refine(
      (value) => !/^(your[-_]?secret|placeholder|secret|changeme|todo)/i.test(value),
      "Client secret looks like a placeholder."
    ),
  // Optional override; defaults match the server's loopback callback.
  redirectUri: z.string().url().optional()
});

function isLoopbackAddress(address: string | undefined) {
  if (!address) return false;
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

function hasDesktopSetupToken(request: Request) {
  return (
    Boolean(config.RUNWAY_DESKTOP_TOKEN) &&
    request.get("x-runway-desktop-token") === config.RUNWAY_DESKTOP_TOKEN
  );
}

export function settingsRouter(db: Database.Database) {
  const router = Router();

  router.get("/tag-config", (_request, response) => {
    response.json(getSettings(db).tagConfig);
  });

  router.post("/tag-config", requireDelegatedAuth, (request, response) => {
    const result = tagConfigSchema.safeParse(request.body);
    if (!result.success) {
      response.status(400).json({ message: "Invalid tag config.", errors: result.error.flatten().fieldErrors });
      return;
    }
    upsertTagConfig(db, result.data);
    scheduleRecompute(db);
    response.status(201).json(getSettings(db).tagConfig);
  });

  router.post("/tag-config/preview", requireDelegatedAuth, (request, response) => {
    const result = tagConfigSchema.safeParse(request.body);
    if (!result.success) {
      response.status(400).json({ message: "Invalid tag config.", errors: result.error.flatten().fieldErrors });
      return;
    }
    response.json(previewTagConfig(db, result.data));
  });

  router.put("/tag-config/:groupTag", requireDelegatedAuth, (request, response) => {
    const result = tagConfigSchema.safeParse({
      ...request.body,
      groupTag: request.params.groupTag
    });
    if (!result.success) {
      response.status(400).json({ message: "Invalid tag config.", errors: result.error.flatten().fieldErrors });
      return;
    }
    upsertTagConfig(db, result.data);
    scheduleRecompute(db);
    response.json(getSettings(db).tagConfig);
  });

  router.delete("/tag-config/:groupTag", requireDelegatedAuth, (request, response) => {
    deleteTagConfig(db, String(request.params.groupTag));
    scheduleRecompute(db);
    response.status(204).send();
  });

  router.get("/", (_request, response) => {
    response.json(getSettings(db));
  });

  // PUT /api/settings/feature-flags/:key — toggles a named server-side
  // feature flag. Requires admin sign-in because flags can enable costly
  // data paths (extra Graph selects, extra UI panels) that shouldn't be
  // flippable by any local process that can reach the port.
  const featureFlagBodySchema = z.object({ enabled: z.boolean() });
  router.put("/feature-flags/:key", requireDelegatedAuth, (request, response) => {
    const key = String(request.params.key);
    if (!isFeatureFlagKey(key)) {
      response.status(400).json({
        message: `Unknown feature flag "${key}". Known keys: ${FEATURE_FLAG_KEYS.join(", ")}.`
      });
      return;
    }
    const body = featureFlagBodySchema.safeParse(request.body);
    if (!body.success) {
      response.status(400).json({
        message: "Body must be {\"enabled\": boolean}.",
        errors: body.error.flatten().fieldErrors
      });
      return;
    }
    setFeatureFlag(db, key, body.data.enabled);
    response.json(getSettings(db).featureFlags);
  });

  const resetBodySchema = z.object({ confirmationToken: z.literal("RESET_APP_SETTINGS") });
  router.post("/reset", requireDelegatedAuth, (request, response) => {
    const body = resetBodySchema.safeParse(request.body);
    if (!body.success) {
      response.status(400).json({
        message: "Reset requires confirmationToken: \"RESET_APP_SETTINGS\".",
        errors: body.error.flatten().fieldErrors
      });
      return;
    }
    resetAppSettings(db);
    response.json(getSettings(db).appSettings);
  });

  const appSettingBodySchema = z.object({ value: z.unknown() });
  router.put("/:key", requireDelegatedAuth, (request, response) => {
    const key = String(request.params.key);
    if (!isAppSettingKey(key)) {
      response.status(400).json({ message: `Unknown app setting "${key}".` });
      return;
    }
    const body = appSettingBodySchema.safeParse(request.body);
    if (!body.success) {
      response.status(400).json({
        message: "Body must be {\"value\": ...}.",
        errors: body.error.flatten().fieldErrors
      });
      return;
    }
    try {
      response.json(setAppSetting(db, key, body.data.value));
    } catch (error) {
      response.status(400).json({
        message: error instanceof Error ? error.message : "Invalid app setting value."
      });
    }
  });

  // GET /api/settings/graph/env — where the wizard would write, plus a
  // hint about whether the server already sees Graph credentials. The UI
  // shows the path so the operator knows what file is about to change.
  router.get("/graph/env", (_request, response) => {
    response.json({
      envPath: resolveEnvPath(),
      configured: config.isGraphConfigured,
      missing: config.graphMissing
    });
  });

  // POST /api/settings/graph — first-run wizard for Graph credentials.
  //
  // Auth model: when Graph is *not* yet configured, no admin can possibly
  // have signed in (login depends on these creds), so we let the request
  // through. Once Graph is configured, future rotations require a real
  // delegated session — otherwise the wizard becomes a credential-rewrite
  // primitive for any process that can reach localhost.
  router.post("/graph", (request, response, next) => {
    if (config.isGraphConfigured) {
      requireDelegatedAuth(request, response, next);
    } else if (!isLoopbackAddress(request.socket.remoteAddress) || config.HOST !== "127.0.0.1") {
      response.status(403).json({
        message:
          "First-run Graph bootstrap is only allowed from a loopback-only Runway server. Set credentials manually in .env for non-local deployments."
      });
    } else if (config.RUNWAY_DESKTOP_TOKEN && !hasDesktopSetupToken(request)) {
      response.status(403).json({
        message: "First-run Graph bootstrap requires the active Runway desktop session."
      });
    } else if (!config.RUNWAY_DESKTOP_TOKEN && !config.isDevOrTest) {
      response.status(403).json({
        message:
          "First-run Graph bootstrap requires the Runway desktop session token. Set credentials manually in .env for server-only production runs."
      });
    } else {
      next();
    }
  }, (request, response) => {
    const result = graphConfigSchema.safeParse(request.body);
    if (!result.success) {
      response.status(400).json({
        message: "Invalid Graph credentials.",
        errors: result.error.flatten().fieldErrors
      });
      return;
    }

    const updates: Record<string, string> = {
      AZURE_TENANT_ID: result.data.tenantId,
      AZURE_CLIENT_ID: result.data.clientId,
      AZURE_CLIENT_SECRET: result.data.clientSecret
    };
    if (result.data.redirectUri) {
      updates.AZURE_REDIRECT_URI = result.data.redirectUri;
    }

    try {
      const writeResult = writeEnvUpdates(resolveEnvPath(), updates);
      logger.info(
        { envPath: writeResult.path, created: writeResult.created },
        "Graph credentials written via wizard; restart required to take effect"
      );
      response.status(202).json({
        message:
          "Graph credentials saved. Restart Runway to apply the new credentials.",
        envPath: writeResult.path,
        restartRequired: true
      });
    } catch (error) {
      logger.error({ err: error }, "Failed to write Graph credentials to .env");
      response.status(500).json({
        message:
          error instanceof Error
            ? `Could not write .env: ${error.message}`
            : "Could not write .env."
      });
    }
  });

  return router;
}
