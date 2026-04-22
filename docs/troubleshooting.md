# Troubleshooting

Common failure modes when running Runway against a real tenant, and how
to recover. If something here is missing or wrong, please open an issue —
these notes live with the code so they stay current.

See also:

- [`graph-setup.md`](./graph-setup.md) — one-time Entra app registration steps.
- [`graph-auth.md`](./graph-auth.md) — the app-only vs delegated auth model.

---

## 1. Graph permissions

Runway talks to Graph in two distinct modes and each has its own
permission surface. Most "it worked yesterday" problems are really missing
consent on one of them.

### App-only (background sync)

Used by the scheduled `fullSync` to read Autopilot, Intune, Entra, groups,
profiles, and compliance. Runs unattended with the client-credentials flow.

Required **Application** permissions:

- `DeviceManagementServiceConfig.Read.All`
- `DeviceManagementManagedDevices.Read.All`
- `DeviceManagementConfiguration.Read.All`
- `Device.Read.All`
- `Group.Read.All`

After adding permissions you must click **Grant admin consent for
&lt;tenant&gt;** in the Entra admin centre. "Consent granted" means green
check marks in the _Admin consent required_ column.

### Delegated (admin actions + LAPS)

Used when an admin signs in via **Sign in with Microsoft** to execute
destructive actions or reveal a LAPS password. Scopes are requested
dynamically by `src/server/auth/delegated-auth.ts`:

- `DeviceManagementManagedDevices.ReadWrite.All`
- `DeviceManagementManagedDevices.PrivilegedOperations.All`
- `DeviceLocalCredential.Read.All`
- `BitLockerKey.Read.All`
- `Group.ReadWrite.All`
- `User.Read.All`
- `DeviceManagementServiceConfig.ReadWrite.All`
- `Directory.AccessAsUser.All`

If any of these are missing from the app registration, sign-in will either
fail outright or succeed but produce 403s when the admin clicks an action.

### Symptom → fix

| Symptom                                          | Likely cause                                                           | Fix                                                                   |
| ------------------------------------------------ | ---------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Sync fails with `Authorization_RequestDenied`    | Application permissions present but admin consent not granted          | **API permissions → Grant admin consent for &lt;tenant&gt;**          |
| Sync succeeds, device count is 0                 | Permissions added as _Delegated_ instead of _Application_              | Remove and re-add as **Application permissions**, re-consent          |
| Actions return 403 after sign-in                 | Delegated `*.PrivilegedOperations.All` missing, or signed-in user isn't Intune Admin | Add scope and re-consent; sign in as a role with action rights       |
| LAPS reveal returns 404 for every device         | `DeviceLocalCredential.Read.All` not granted, or device not LAPS-enrolled | Grant scope; verify LAPS policy is actually assigned to the device    |
| Sign-in succeeds but scopes missing from token   | App registration's _Allowed token audiences_ or scopes got edited      | Recreate the redirect URI exactly as `http://localhost:3001/api/auth/callback` |

---

## 2. Environment setup

`.env` is loaded from the project root by `src/server/load-env.ts`. Missing
or malformed values fail fast with a Zod error listing the missing keys.

### Required keys

| Key                   | Used by                          | Notes                                                         |
| --------------------- | -------------------------------- | ------------------------------------------------------------- |
| `AZURE_TENANT_ID`     | App-only + delegated auth        | Directory ID, _not_ the tenant's vanity name                  |
| `AZURE_CLIENT_ID`     | App-only + delegated auth        | Application ID from the app registration overview            |
| `AZURE_CLIENT_SECRET` | App-only + delegated auth        | Secret **Value**, copied at creation time                    |
| `AZURE_REDIRECT_URI`  | Delegated auth                   | Default `http://localhost:3001/api/auth/callback` — must match the app registration exactly |

### Optional keys

| Key                                      | Default                                   | Notes                                           |
| ---------------------------------------- | ----------------------------------------- | ----------------------------------------------- |
| `HOST`                                   | `127.0.0.1`                               | Listen address                                   |
| `PORT`                                   | `3001`                                    | API + static server                              |
| `CLIENT_PORT`                            | `5173`                                    | Vite dev server                                  |
| `DATABASE_PATH`                          | `./data/pilotcheck.sqlite`                | SQLite path                                      |
| `SESSION_SECRET`                         | (dev default)                             | **Must** be changed for non-dev use              |
| `SYNC_INTERVAL_MINUTES`                  | `15`                                      | Background sync cadence                          |
| `PROFILE_ASSIGNED_NOT_ENROLLED_HOURS`    | `2`                                       | Rule engine grace period                         |
| `PROVISIONING_STALLED_HOURS`             | `8`                                       | Rule engine grace period                         |
| `SEED_MODE`                              | `mock`                                    | `mock` seeds fake data when Graph isn't configured |

### Symptom → fix

| Symptom                                                              | Likely cause                                       | Fix                                                              |
| -------------------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------- |
| Server refuses to start: `SESSION_SECRET is set to the built-in…`    | Default secret used in a non-dev environment       | Set `SESSION_SECRET` to a long random value, or `NODE_ENV=development` |
| Server starts, Settings card shows red for all three Graph keys      | `.env` not loaded, or keys named wrong             | Confirm `.env` is in the project root and keys match exactly      |
| Settings card shows green, sync still silently no-ops                | `isGraphConfigured` is true but secret is stale    | Rotate the client secret; update `AZURE_CLIENT_SECRET`            |
| `AADSTS7000215: Invalid client secret provided`                      | Secret expired or the _Value_ was not captured at creation | Create a new client secret and update `.env`                 |
| `AADSTS700016: Application was not found`                            | Wrong tenant ID, or app registration was deleted   | Confirm `AZURE_TENANT_ID` matches the directory that owns the app |

---

## 3. Sync failures

`fullSync` runs two waves of parallel fetches and a single persist + compute
step at the end. See `src/server/sync/sync-service.ts` for the flow.

- **Wave 1 (hard-fail, `Promise.all`)** — Autopilot, Intune, Entra, groups,
  profiles. If any one rejects, the whole sync aborts, the error is written
  to `sync_log.errors`, and the exception is rethrown.
- **Best-effort** — conditional access. A failure here is logged at `warn`
  level and the sync continues with an empty policy list.
- **Wave 2 (hard-fail)** — compliance, config profiles, apps. Same
  hard-fail semantics as wave 1.

### Finding the actual error

1. **UI:** Open **Sync → Timeline**. Each row with an `errors` array is
   expandable and shows the raw Graph message.
2. **DB:** `SELECT id, started_at, errors FROM sync_log ORDER BY id DESC LIMIT 10;`
3. **Logs:** The server logs via `pino`. Errors are at `error` level; the
   best-effort CA failure is at `warn`.

### Symptom → fix

| Symptom                                                        | Likely cause                                                     | Fix                                                              |
| -------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| Sync log shows `Graph request failed: 429 Too Many Requests`   | Tenant is being throttled                                        | `graph-client.ts` already retries with `Retry-After`; if it still fails, reduce `SYNC_INTERVAL_MINUTES` |
| Sync log shows `Graph request failed: 5xx` after 3 retries     | Transient Graph outage                                           | Wait; if persistent, check <https://status.cloud.microsoft>      |
| Sync aborts on Intune but Entra completed                      | Intune Graph returned 4xx/5xx; wave-1 `Promise.all` aborts       | Inspect `errors` for the specific status; if 403, re-check Intune permissions |
| Conditional access missing from dashboard but sync "succeeded" | CA sync failed and was swallowed (best-effort)                   | Check server logs at `warn`; usually a permissions issue         |
| Sync completes but `devices_synced` is 0                       | No Windows devices matched the `$filter`, or all Intune IDs were stale | Confirm at least one Windows device is Intune-enrolled and visible in the admin centre |
| `A sync is already in progress.` on manual click               | Previous sync is still running (or state leaked after a crash)   | Wait for it; if truly stuck, restart the server                  |
| Sync succeeds but dashboard looks empty                        | `computeAllDeviceStates` ran on zero rows                        | Check `device_state` count; confirm wave-1 fetches returned data |

### When the sync keeps failing

1. Reproduce with a single module in isolation: set `SEED_MODE=none`,
   then hit `/api/sync/run` and watch which stage throws.
2. Try the exact Graph request in [Graph Explorer](https://developer.microsoft.com/en-us/graph/graph-explorer)
   with the same signed-in account to confirm it's a permissions issue vs a
   code issue.
3. Check `sync_log.errors` — the full Graph status + statusText is recorded.

---

## 4. Still stuck?

File an issue with:

- The exact error message from `sync_log.errors` or the server logs.
- Whether you're in app-only, delegated, or both.
- The list of Graph permissions granted (screenshot of the API permissions
  page is ideal).
- The Runway commit SHA (`git rev-parse HEAD`).
