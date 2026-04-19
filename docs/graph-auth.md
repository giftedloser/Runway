# Graph authentication model

PilotCheck talks to Microsoft Graph in two distinct modes:

1. **App-only sync** — the background poller that reads Autopilot, Intune,
   and Entra resources every few minutes.
2. **Delegated actions** — remote sync / reboot / LAPS retrieval / device
   deletion, which run on behalf of the signed-in admin.

Both currently go through `@azure/msal-node`'s `ConfidentialClientApplication`,
which requires `AZURE_CLIENT_ID` **and** `AZURE_CLIENT_SECRET`. This document
explains the consequences of that choice for a distributed Windows desktop
app, the three viable auth models, and the committed path forward.

---

## The secret-bundling problem

A confidential client, by definition, authenticates to Azure AD with a shared
secret (`client_secret`) or a private-key certificate. That secret must be
available to the running app. For a Windows desktop installer that means one
of three things:

1. **Bundle the secret in the installer** — every installation contains the
   same shared secret. Anyone who extracts it can impersonate PilotCheck's
   app registration against your tenant. **Unacceptable.**
2. **Ship a blank installer and have each operator paste a per-tenant secret
   into `%LOCALAPPDATA%\...\.env` on first run.** The secret lives only on the
   operator's machine and is never transmitted. **This is what PilotCheck
   does today.**
3. **Drop the confidential client entirely and use a public-client PKCE flow
   for delegated auth.** The app has no secret, and Azure AD enforces
   user-presence-based flows for every privileged call.

The existing code (`src/server/auth/delegated-auth.ts`,
`src/server/sync/graph-client.ts`, `src/server/config.ts`) assumes path 2.
README and `.env.example` reflect that, but the framing was implicit rather
than explicit — this document makes it explicit and commits to a long-term
direction.

---

## Options considered

### Option A — Public client with PKCE (long-term target)

Replace `ConfidentialClientApplication` with `PublicClientApplication` and
use Authorization Code + PKCE for every delegated call. Drop
`AZURE_CLIENT_SECRET` from the config schema. The Entra app registration
is marked *public client / allow public client flows = yes*.

For background sync, two sub-options:

- **A1 — Delegated-only sync.** Sync only runs while an admin is signed in
  and the app is open. This fits the product model ("an operator opening the
  app on a Monday morning can tell within seconds which devices are broken")
  but breaks the current 15-minute background poller.
- **A2 — Separate app-only registration for sync.** Keep a second Entra app
  registration with a client secret, but require the operator to configure it
  per-deployment in Settings (never bundled). The secret lives in
  `%LOCALAPPDATA%\...\.env` exactly as it does today, just scoped smaller.

**Pros:** correct MSAL pattern for desktop; no secret to leak, rotate, or
bundle; ships a single signed installer safely; matches published Microsoft
guidance for Win32 apps.

**Cons:** non-trivial code change across `delegated-auth.ts`,
`graph-client.ts`, and the sync orchestrator; breaks the "unattended
background sync out of the box" story unless A2 is adopted.

### Option B — Per-tenant operator registration (v0.1.0 commitment)

Keep the confidential-client code as-is, but formally document that
PilotCheck is a **self-hosted, bring-your-own-Entra-app-registration** tool.
The shipped installer is blank. On first run the operator:

1. Registers PilotCheck as an application in their own tenant.
2. Generates a client secret (or uploads a certificate).
3. Pastes tenant ID, client ID, and secret into
   `%LOCALAPPDATA%\com.giftedloser.pilotcheck\.env`.

The secret is never included in the installer, never transmitted over the
network beyond the Azure AD token endpoint, and never logged.

**Pros:** zero code change; matches the existing enterprise IT deployment
pattern (most internal tools work this way); keeps the background poller
without extra registration; the secret problem becomes a per-deployment
config problem rather than a distribution problem.

**Cons:** higher setup friction — the operator has to register an app;
`.env` on disk is readable by anyone with local admin on that machine
(mitigated by Windows DPAPI or BitLocker, but not enforced by PilotCheck
itself).

### Option C — Hybrid (future consideration)

PKCE for all delegated actions + optional operator-provided app-only
credentials for unattended sync. If `AZURE_CLIENT_SECRET` is set, the
background poller runs every 15 minutes; if absent, sync only runs while an
admin is signed in.

**Pros:** most flexible; preserves the current user experience for operators
who want background sync while giving no-secret deployments a clean path.

**Cons:** doubles the auth surface area, two registration paths to document
and maintain, more ways to misconfigure.

---

## Recommendation

**v0.1.0 ships on Option B**, explicitly framed. This matches what the code
actually does today and what most internal enterprise tools look like. The
setup friction is real but is the honest cost of the current architecture.

**Option A remains the long-term target** and is tracked as a post-v0.1.0
milestone. It's the architecturally correct choice for a distributed desktop
app, but it's a real code change that deserves its own design pass — not a
pre-tag scramble.

Option C is deferred until there's evidence that operators want both modes.
If Option A1 (delegated-only sync) turns out to be acceptable in practice,
the hybrid doesn't need to exist at all.

---

## What Option B commits to

1. **Installer never contains Graph credentials.** No secret, no tenant ID,
   no client ID — a fresh install boots into mock mode until the operator
   provisions `.env`.
2. **`.env` lives only in the per-user app data folder** on each operator's
   machine: `%LOCALAPPDATA%\com.giftedloser.pilotcheck\.env`. It is **never**
   checked into git and **never** bundled into the dist/ output.
3. **README + SECURITY.md state this explicitly.** No implicit assumptions
   about where the secret lives.
4. **Recommend DPAPI or BitLocker at rest.** PilotCheck itself does not
   encrypt `.env` — that's the operator's responsibility. Windows DPAPI via
   `ProtectedData.Protect` or a full-disk encryption baseline handles this
   cleanly.
5. **`SESSION_SECRET` fails fast outside dev.** `src/server/config.ts`
   refuses to start if the built-in default session secret is in use and
   `NODE_ENV` is not `development` or `test`.
6. **Graph credentials are never logged.** The pino logger and the Tauri
   stdout/stderr capture already exclude Authorization headers; keep it that
   way.

---

## Migration path to Option A

When Option A becomes the next milestone, the work is scoped as:

1. Swap `ConfidentialClientApplication` → `PublicClientApplication` in
   `src/server/auth/delegated-auth.ts`. Remove `clientSecret` from the
   auth config; keep `clientId` and `authority`.
2. Switch the delegated sign-in flow from `acquireTokenByCode` to the
   authorization-code-with-PKCE variant. The existing popup-based sign-in
   in `useAuth.ts` already maps cleanly to PKCE.
3. Decide between A1 (delegated-only sync) and A2 (separate app-only
   registration). If A1: remove `src/server/sync/graph-client.ts`'s
   `ClientCredentialRequest` path and have the sync orchestrator pull the
   admin's delegated token from the active session. If A2: keep the
   confidential client, but narrow its scope to *sync only* and document
   the second app registration.
4. Update `.env.example`, `AZURE_CLIENT_SECRET` becomes optional (A2) or
   disappears entirely (A1).
5. Update `docs/graph-setup.md` with the PKCE-friendly app registration
   steps (public client flows enabled, `http://localhost` redirect URI).
6. Tests: add unit coverage for the PKCE flow and any new sync behaviour.

That's the whole story. It's deferred, not forgotten.
