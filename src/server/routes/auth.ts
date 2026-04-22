import { Router } from "express";

import { config } from "../config.js";
import { getAuthUrl, acquireDelegatedToken } from "../auth/delegated-auth.js";

export function authRouter() {
  const router = Router();

  // GET /api/auth/status — check if admin is logged in
  router.get("/status", (request, response) => {
    const session = request.session;
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

  // GET /api/auth/login — redirect to Microsoft login
  router.get("/login", async (_request, response) => {
    if (!config.isGraphConfigured) {
      response.status(409).json({
        message: `Microsoft Graph sign-in is unavailable. Missing: ${config.graphMissing.join(", ")}.`
      });
      return;
    }

    try {
      const url = await getAuthUrl();
      response.json({ loginUrl: url });
    } catch (error) {
      response.status(500).json({
        message: error instanceof Error ? error.message : "Failed to generate login URL."
      });
    }
  });

  // GET /api/auth/callback — handle Microsoft redirect
  router.get("/callback", async (request, response) => {
    const code = request.query.code as string | undefined;
    if (!code) {
      response.status(400).send("Missing authorization code.");
      return;
    }

    try {
      const result = await acquireDelegatedToken(code);
      request.session.delegatedToken = result.accessToken;
      request.session.delegatedUser = result.account.username;
      request.session.delegatedName = result.account.name;
      request.session.delegatedExpiresAt = result.expiresOn.toISOString();

      response
        .status(200)
        .set("Cache-Control", "no-store")
        .type("html")
        .send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Runway Sign-In Complete</title>
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
      <h1>Microsoft sign-in complete</h1>
      <p>You can return to Runway now. This window should close automatically.</p>
    </main>
    <script>
      window.opener?.postMessage({ type: "pilotcheck-auth-complete" }, "*");
      window.setTimeout(() => window.close(), 150);
    </script>
  </body>
</html>`);
    } catch (error) {
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

  return router;
}
