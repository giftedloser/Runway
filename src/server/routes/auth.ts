import { Router, type Request, type Response } from "express";

import { config } from "../config.js";
import {
  acquireAppAccessToken,
  acquireDelegatedToken,
  createAuthState,
  getAppAccessAuthUrl,
  getAuthUrl
} from "../auth/delegated-auth.js";
import {
  clearAppAccessSession,
  hasValidAppAccessSession
} from "../auth/auth-middleware.js";

const ADMIN_AUTH_COMPLETE_MESSAGE = "pilotcheck-auth-complete";
const APP_ACCESS_COMPLETE_MESSAGE = "pilotcheck-access-auth-complete";

function saveSession(session: Express.Request["session"]) {
  return new Promise<void>((resolve, reject) => {
    session.save((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

// --- Pending auth flows (system-browser sign-in bridge) ---
// When the Tauri desktop app opens sign-in in the system browser, the
// OAuth callback hits localhost with a *different* session cookie than
// the one the Tauri WebView2 holds. This in-memory map bridges the gap:
// the unguessable `state` parameter correlates the Tauri session (which
// initiated the flow) with the browser callback (which completes it).

interface PendingAuthFlow {
  kind: "admin" | "app-access";
  createdAt: number;
  result?: {
    accessToken?: string;
    user: string;
    name?: string;
    expiresAt: string;
  };
}

const pendingAuthFlows = new Map<string, PendingAuthFlow>();
const PENDING_AUTH_TTL_MS = 5 * 60 * 1000;

function pruneStalePendingFlows() {
  const cutoff = Date.now() - PENDING_AUTH_TTL_MS;
  for (const [state, flow] of pendingAuthFlows) {
    if (flow.createdAt < cutoff) pendingAuthFlows.delete(state);
  }
}

function getCallbackMessageOrigins() {
  const redirectOrigin = new URL(config.AZURE_REDIRECT_URI).origin;
  const clientOrigins = [
    redirectOrigin,
    `http://localhost:${config.CLIENT_PORT}`,
    `http://127.0.0.1:${config.CLIENT_PORT}`
  ];

  return [...new Set(clientOrigins)].map((origin) => JSON.stringify(origin)).join(", ");
}

function isAllowedAppAccessUser(user: string) {
  if (config.appAccessAllowedUsers.length === 0) return true;
  return config.appAccessAllowedUsers.includes(user.trim().toLowerCase());
}

function getAppAccessStatus(request: Request) {
  const authenticated = config.isAppAccessRequired
    ? hasValidAppAccessSession(request)
    : false;
  return {
    required: config.isAppAccessRequired,
    configured: config.APP_ACCESS_MODE === "entra",
    mode: config.APP_ACCESS_MODE,
    authenticated,
    user: authenticated ? request.session.appAccessUser ?? null : null,
    name: authenticated ? request.session.appAccessName ?? null : null,
    expiresAt: authenticated ? request.session.appAccessExpiresAt ?? null : null,
    allowedUsersConfigured: config.appAccessAllowedUsers.length > 0,
    reason: config.isAppAccessRequired
      ? null
      : config.APP_ACCESS_MODE !== "entra"
        ? "App access enforcement is disabled."
        : `Graph credentials are incomplete. Missing: ${config.graphMissing.join(", ")}.`
  };
}

function sendCallbackPage(
  response: Response,
  {
    title,
    description,
    messageType
  }: {
    title: string;
    description: string;
    messageType: string;
  }
) {
  response
    .status(200)
    .set("Cache-Control", "no-store")
    .type("html")
    .send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #0f1720;
        color: #e5eef8;
        font: 14px/1.5 "Segoe UI", sans-serif;
      }
      main {
        width: min(420px, calc(100vw - 32px));
        padding: 24px;
        border: 1px solid rgba(148, 163, 184, 0.22);
        border-radius: 16px;
        background: rgba(15, 23, 32, 0.96);
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
      }
      h1 {
        margin: 0 0 8px;
        font-size: 18px;
      }
      p {
        margin: 0;
        color: #b6c3d1;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      <p>${description}</p>
    </main>
    <script>
      // Two completion shapes are possible here:
      //   - Browser popup: window.opener is the calling Runway window.
      //     postMessage signals completion immediately; the close call is
      //     a fallback for the polling watchdog.
      //   - Tauri webview window: opened from Rust, no window.opener.
      //     The main webview shares the localhost:3001 session cookie via
      //     the shared WebView2 user data dir, so it just polls
      //     /api/auth/status. We still want this auth window to close
      //     itself so the operator is dropped back into the main app.
      const message = { type: ${JSON.stringify(messageType)} };
      const openerOrigins = [${getCallbackMessageOrigins()}];
      if (window.opener) {
        for (const origin of openerOrigins) {
          window.opener.postMessage(message, origin);
        }
      }
      window.setTimeout(() => {
        try {
          window.close();
        } catch {
          /* fall through to redirect below */
        }
        // If close was vetoed (some shells refuse to close non-opener
        // windows), fall back to a return-to-app redirect.
        window.setTimeout(() => window.location.assign("/"), 400);
      }, 150);
    </script>
  </body>
</html>`);
}

export function authRouter() {
  const router = Router();

  // GET /api/auth/status — check if admin is logged in
  router.get("/status", async (request, response) => {
    const session = request.session;

    // Promote a completed pending flow from system-browser sign-in.
    if (!session.delegatedToken && session.oauthState) {
      const pending = pendingAuthFlows.get(session.oauthState);
      if (pending?.kind === "admin" && pending.result) {
        session.delegatedToken = pending.result.accessToken;
        session.delegatedUser = pending.result.user;
        session.delegatedName = pending.result.name;
        session.delegatedExpiresAt = pending.result.expiresAt;
        pendingAuthFlows.delete(session.oauthState);
        session.oauthState = undefined;
        await saveSession(session);
      }
    }

    const isAuthenticated =
      Boolean(session.delegatedToken) &&
      (!session.delegatedExpiresAt || new Date(session.delegatedExpiresAt) > new Date());

    response.json({
      authenticated: isAuthenticated,
      user: isAuthenticated ? session.delegatedUser : null,
      name: isAuthenticated ? session.delegatedName : null,
      expiresAt: isAuthenticated ? session.delegatedExpiresAt : null
    });
  });

  // GET /api/auth/access-status — front-door app access gate state
  router.get("/access-status", async (request, response) => {
    // Promote a completed pending flow from system-browser sign-in.
    const session = request.session;
    if (!session.appAccessUser && session.appAccessOAuthState) {
      const pending = pendingAuthFlows.get(session.appAccessOAuthState);
      if (pending?.kind === "app-access" && pending.result) {
        session.appAccessUser = pending.result.user;
        session.appAccessName = pending.result.name;
        session.appAccessExpiresAt = pending.result.expiresAt;
        pendingAuthFlows.delete(session.appAccessOAuthState);
        session.appAccessOAuthState = undefined;
        await saveSession(session);
      }
    }

    response.json(getAppAccessStatus(request));
  });

  // GET /api/auth/access-login — tenant user sign-in for app entry
  router.get("/access-login", async (request, response) => {
    if (!config.isAppAccessRequired) {
      response.status(409).json({
        message:
          config.APP_ACCESS_MODE === "entra"
            ? `Runway app sign-in is not available until Graph is configured. Missing: ${config.graphMissing.join(", ")}.`
            : "Runway app sign-in is disabled."
      });
      return;
    }

    try {
      pruneStalePendingFlows();
      const state = createAuthState();
      request.session.appAccessOAuthState = state;
      pendingAuthFlows.set(state, { kind: "app-access", createdAt: Date.now() });
      await saveSession(request.session);
      const url = await getAppAccessAuthUrl(state);
      response.json({ loginUrl: url });
    } catch (error) {
      response.status(500).json({
        message: error instanceof Error ? error.message : "Failed to generate app sign-in URL."
      });
    }
  });

  // GET /api/auth/login — redirect to Microsoft login
  router.get("/login", async (request, response) => {
    if (!config.isGraphConfigured) {
      response.status(409).json({
        message: `Microsoft Graph sign-in is unavailable. Missing: ${config.graphMissing.join(", ")}.`
      });
      return;
    }

    try {
      pruneStalePendingFlows();
      const state = createAuthState();
      request.session.oauthState = state;
      pendingAuthFlows.set(state, { kind: "admin", createdAt: Date.now() });
      await saveSession(request.session);
      const url = await getAuthUrl(state);
      response.json({ loginUrl: url });
    } catch (error) {
      response.status(500).json({
        message: error instanceof Error ? error.message : "Failed to generate login URL."
      });
    }
  });

  // GET /api/auth/callback — handle Microsoft redirect
  //
  // Two shapes are possible:
  //   1. Same-session: the browser popup / WebView that initiated login
  //      hits the callback with the same session cookie → state matches
  //      a session field, result is stored directly in the session.
  //   2. System-browser: the default OS browser completed login and
  //      hits the callback with a *different* session cookie → state
  //      matches a pending flow in the in-memory map, result is stored
  //      there and promoted into the Tauri session when /status is polled.
  router.get("/callback", async (request, response) => {
    const code = request.query.code as string | undefined;
    const returnedState = request.query.state as string | undefined;
    const expectedAdminState = request.session.oauthState;
    const expectedAppAccessState = request.session.appAccessOAuthState;

    // Try session-based matching first (browser popup mode).
    let callbackKind: "admin" | "app-access" | null =
      returnedState && returnedState === expectedAppAccessState
        ? "app-access"
        : returnedState && returnedState === expectedAdminState
          ? "admin"
          : null;

    // Fall back to the pending-flows map (system-browser mode).
    let isPendingFlow = false;
    if (!callbackKind && returnedState) {
      const pending = pendingAuthFlows.get(returnedState);
      if (pending) {
        callbackKind = pending.kind;
        isPendingFlow = true;
      }
    }

    if (callbackKind === "app-access" && !isPendingFlow) {
      request.session.appAccessOAuthState = undefined;
    } else if (callbackKind === "admin" && !isPendingFlow) {
      request.session.oauthState = undefined;
    }

    if (!code || !returnedState || !callbackKind) {
      response.status(400).send("Invalid authentication callback.");
      return;
    }

    try {
      if (callbackKind === "app-access") {
        const result = await acquireAppAccessToken(code);
        if (!isAllowedAppAccessUser(result.account.username)) {
          if (isPendingFlow) {
            pendingAuthFlows.delete(returnedState);
          } else {
            clearAppAccessSession(request.session);
            await saveSession(request.session);
          }
          response
            .status(403)
            .send("Runway app access denied. This Entra user is not in APP_ACCESS_ALLOWED_USERS.");
          return;
        }

        if (isPendingFlow) {
          const pending = pendingAuthFlows.get(returnedState)!;
          pending.result = {
            user: result.account.username,
            name: result.account.name,
            expiresAt: result.expiresOn.toISOString()
          };
        } else {
          request.session.appAccessUser = result.account.username;
          request.session.appAccessName = result.account.name;
          request.session.appAccessExpiresAt = result.expiresOn.toISOString();
          await saveSession(request.session);
        }

        sendCallbackPage(response, {
          title: "Runway sign-in complete",
          description: isPendingFlow
            ? "Sign-in complete. You can close this tab and return to Runway."
            : "You can return to Runway now. This window should close automatically.",
          messageType: APP_ACCESS_COMPLETE_MESSAGE
        });
        return;
      }

      const result = await acquireDelegatedToken(code);

      if (isPendingFlow) {
        const pending = pendingAuthFlows.get(returnedState)!;
        pending.result = {
          accessToken: result.accessToken,
          user: result.account.username,
          name: result.account.name,
          expiresAt: result.expiresOn.toISOString()
        };
      } else {
        request.session.delegatedToken = result.accessToken;
        request.session.delegatedUser = result.account.username;
        request.session.delegatedName = result.account.name;
        request.session.delegatedExpiresAt = result.expiresOn.toISOString();
        await saveSession(request.session);
      }

      sendCallbackPage(response, {
        title: "Microsoft sign-in complete",
        description: isPendingFlow
          ? "Sign-in complete. You can close this tab and return to Runway."
          : "You can return to Runway now. This window should close automatically.",
        messageType: ADMIN_AUTH_COMPLETE_MESSAGE
      });
    } catch (error) {
      if (isPendingFlow) pendingAuthFlows.delete(returnedState);
      response.status(500).send(
        `Authentication failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  });

  // POST /api/auth/logout — clear session
  router.post("/logout", (request, response) => {
    request.session.destroy(() => {
      response.json({ authenticated: false });
    });
  });

  // POST /api/auth/access-logout — clear app-access and elevated admin sessions
  router.post("/access-logout", (request, response) => {
    request.session.destroy(() => {
      response.json({ authenticated: false });
    });
  });

  return router;
}
