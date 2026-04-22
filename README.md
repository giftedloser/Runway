# Runway

> A local-first triage console for **Windows** Autopilot, Intune, and Entra ID.
> Windows-only by design.

Runway correlates Windows device identities across Microsoft Autopilot,
Intune, and Entra ID, computes provisioning health with a transparent rule
engine, and presents **problem-first** diagnostics — so an operator opening
the app on a Monday morning can tell within seconds which devices are broken,
*why*, and *what to do about it*.

It's built for the small-but-real internal IT team running a fleet of a few
hundred to a few thousand Windows endpoints — the band where SCCM is overkill,
the Intune admin centre is too slow to triage from, and PowerShell scripts are
how everyone is currently getting by.

Runway is intentionally **not** a full Intune replacement, **not** a
multi-tenant tool, and does **not** attempt to manage iOS, Android, or macOS.
Those are non-goals — the product is laser-focused on the Windows triage loop
and stays honest about that scope.

---

## What it does

- **Cross-system identity correlation** — joins Autopilot hardware records,
  Intune managed devices, and Entra device objects on serial / device ID /
  ZTDID, surfacing identity conflicts and orphans.
- **Provisioning health engine** — pure rule evaluation against the joined
  state, producing typed flags (`no_profile_assigned`, `not_in_target_group`,
  `provisioning_stalled`, `compliance_drift`, …) with severity, summary, and
  the raw evidence behind each.
- **Assignment-path inspector** — for any device, walks the chain
  *Autopilot record → group membership → assigned profile → effective
  deployment mode* and tells you exactly which link is broken.
- **Drift history** — transition-only `device_state_history` table, plus a
  14-day fleet-wide health trend on the dashboard.
- **Remote actions** (delegated auth) — sync, reboot, rename, rotate LAPS,
  Autopilot reset, retire, factory wipe — all logged to a cross-device action
  audit timeline.
- **LAPS retrieval** with reveal toggle, copy-to-clipboard, and 30-second
  auto-rehide.
- **Custom rules** — small predicate DSL for site-specific health checks,
  scoped globally / per-property / per-profile.
- **Group inspector** — Entra group membership, dynamic membership rule, the
  profiles each group resolves to, and member-level health filtering.
- **Profile audit** — health breakdown per Autopilot profile with click-through
  to the device queue.
- **Tag mapping dictionary** — maps Autopilot group tags to expected profiles
  and target groups, with JSON import/export for versioning.
- **Mock mode** — seeds realistic data when Graph credentials aren't
  configured, so the entire UI is explorable offline.

---

## Stack

| Layer    | Tech                                                        |
| -------- | ----------------------------------------------------------- |
| Client   | React 19, TypeScript, Vite, Tailwind CSS v4                 |
| Routing  | TanStack Router (URL-as-state), TanStack Query              |
| UI       | shadcn-style primitives, lucide-react icons                 |
| Server   | Express 5, better-sqlite3, pino                             |
| Auth     | MSAL Node — app-only for sync, delegated for actions / LAPS |
| Desktop  | Tauri 2 (optional)                                          |
| Tests    | Vitest (unit / api / e2e), Testing Library, supertest       |

---

## Quick start

```bash
# 1. Install
npm install

# 2. Initialise the database (creates ./data/pilotcheck.sqlite)
npm run db:migrate
npm run db:seed:mock     # optional — seeds realistic mock data

# 3. Run client + server
npm run dev
```

- Client: <http://localhost:5173>
- API:    <http://localhost:3001>

If `AZURE_TENANT_ID` / `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET` are not set
and the database is empty, Runway automatically falls back to **mock mode**
on first start so the entire UI is explorable without a tenant.

### As a desktop app

```bash
npm run tauri:dev      # dev build
npm run tauri:build    # production installer
```

---

## Configuration

Runway is **self-hosted, bring-your-own-Entra-app-registration**. The
installer never contains Microsoft Graph credentials — each operator
registers Runway as an application in their own tenant and places the
credentials in their per-user app data folder. See
[`docs/graph-auth.md`](docs/graph-auth.md) for the full design and the
planned migration to a PKCE public-client model.

For local development, copy `.env.example` to `.env` at the repo root and fill in:

For the installed desktop app, place the same `.env` file in the app data folder:

- Windows: `%LOCALAPPDATA%\com.giftedloser.pilotcheck\.env`

```ini
# Microsoft Graph (read-only ingestion)
AZURE_TENANT_ID=
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
AZURE_REDIRECT_URI=http://localhost:3001/api/auth/callback

# Session signing for delegated auth
# Required in production. The server refuses to start outside
# NODE_ENV=development|test if this is left at the built-in default.
SESSION_SECRET=change-me-in-production

# Server
PORT=3001
CLIENT_PORT=5173
DATABASE_PATH=./data/pilotcheck.sqlite

# Engine tunables
SYNC_INTERVAL_MINUTES=15
PROFILE_ASSIGNED_NOT_ENROLLED_HOURS=2
PROVISIONING_STALLED_HOURS=8

# Force mock data even when credentials are present
SEED_MODE=mock
```

### Required Graph permissions

**Application (read-only sync)**
- `DeviceManagementServiceConfig.Read.All`
- `DeviceManagementManagedDevices.Read.All`
- `DeviceManagementConfiguration.Read.All`
- `Device.Read.All`
- `Group.Read.All`

**Delegated (remote actions + LAPS / BitLocker / group checks)**
- `DeviceManagementManagedDevices.ReadWrite.All`
- `DeviceManagementManagedDevices.PrivilegedOperations.All`
- `DeviceLocalCredential.Read.All`
- `BitLockerKey.Read.All`
- `Group.ReadWrite.All`
- `DeviceManagementServiceConfig.ReadWrite.All`
- `User.Read`

Grant admin consent in the tenant after assigning these.

---

## Scripts

| Script                  | What it does                                              |
| ----------------------- | --------------------------------------------------------- |
| `npm run dev`           | Vite client + tsx server, hot reload                      |
| `npm run build`         | Build client and server bundles into `dist/`              |
| `npm run start`         | Run the built server                                      |
| `npm run db:migrate`    | Apply schema migrations to the SQLite database            |
| `npm run db:seed:mock`  | Seed realistic mock devices, groups, profiles             |
| `npm run test`          | Vitest unit + api projects                                |
| `npm run test:e2e`      | Vitest e2e project                                        |
| `npm run lint`          | ESLint                                                    |
| `npm run check`         | Lint + tests                                              |
| `npm run tauri:dev`     | Run as a Tauri desktop app                                |
| `npm run tauri:build`   | Build a signed Tauri installer                            |

---

## Project layout

```
src/
├── client/           # React SPA
│   ├── routes/       # Top-level pages (Dashboard, DeviceList, …)
│   ├── components/   # Feature-grouped components
│   ├── hooks/        # TanStack Query hooks
│   ├── lib/          # API client, types, helpers
│   └── styles/       # Tailwind v4 globals + tokens
├── server/           # Express API
│   ├── routes/       # HTTP route handlers
│   ├── db/           # better-sqlite3 schema, queries, migrations, seed
│   ├── engine/       # State / rule evaluation (pure)
│   ├── sync/         # Graph ingestion + sync orchestrator
│   └── auth/         # MSAL app-only + delegated flows
├── shared/           # Types shared across client and server
└── test/             # Vitest unit / api / e2e suites
```

---

## How the engine works

1. **Sync** (`src/server/sync/`) pulls Autopilot, Intune, and Entra resources
   from Microsoft Graph and writes them into `raw_*` tables verbatim.
2. **Compute** (`src/server/engine/compute-all-device-states.ts`) joins those
   tables into a per-device snapshot, evaluates the built-in rules and any
   user-defined rules, and writes the result to `device_state`.
3. **History** writes a row to `device_state_history` only when a device's
   health or flag set actually changes — keeping the table small while still
   supporting transition-driven views like the 14-day trend chart.
4. **Read paths** are pure SQL queries against `device_state` joined with
   `tag_config` and the raw tables for the diagnostic detail panels.

The engine is a pure function from raw state → typed flags. There is no
"magic" anywhere — every diagnostic in the UI traces back to a named rule
file you can read.

---

## Documentation

- **[docs/architecture.md](./docs/architecture.md)** — system architecture, data flow, schema overview
- **[docs/engine.md](./docs/engine.md)** — health flags, rule DSL, custom rules
- **[docs/graph-setup.md](./docs/graph-setup.md)** — app registration, permissions, redirect URIs
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** — development workflow, conventions
- **[CHANGELOG.md](./CHANGELOG.md)** — release notes

---

## Security

Runway is **local-first** — all device state and action logs stay on the
operator's machine in a local SQLite file. There is no Runway cloud, no
telemetry, no analytics. The only external network calls are to
`graph.microsoft.com` and `login.microsoftonline.com`.

LAPS passwords are fetched on-demand via delegated auth, displayed with a
30-second auto-rehide, and never persisted to disk.

Raw source JSON and conditional-access policy detail are only returned to
an authenticated admin session.

If you discover a security issue, please see [SECURITY.md](./SECURITY.md).

---

## License

MIT © Runway contributors — see [LICENSE](./LICENSE).
