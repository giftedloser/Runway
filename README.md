# Runway

Runway is the user-facing app name for the PilotCheck project.

![CI](https://github.com/giftedloser/PilotCheck/actions/workflows/ci.yml/badge.svg)
![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform: Windows](https://img.shields.io/badge/platform-Windows-0078d4.svg)

> A local-first triage console for **Windows** Autopilot, Intune, Entra ID,
> and Graph-derived ConfigMgr / SCCM client presence.
> Windows-only by design.

Runway correlates Windows device identities across Microsoft Autopilot,
Intune, Entra ID, and the ConfigMgr/SCCM signal exposed by Intune, computes
provisioning health with a transparent rule engine, and presents
**problem-first** diagnostics — so an operator opening the app on a Monday
morning can tell within seconds which devices are broken, _why_, and _what to
do about it_.

It's built for the small-but-real internal IT team running a fleet of a few
hundred to a few thousand Windows endpoints — the band where SCCM console
hopping is too heavy for quick triage, the Intune admin centre is too slow to
work from all day, and PowerShell scripts are how everyone is currently getting
by.

Runway is intentionally **not** a full Intune replacement, **not** a
multi-tenant tool, and does **not** attempt to manage iOS, Android, or macOS.
Those are non-goals — the product is laser-focused on the Windows triage loop
and stays honest about that scope.

## 1.0 Readiness

Runway is ready for controlled live testing when:

- Graph app credentials are configured and `SEED_MODE=none` is used for a
  clean live-data validation pass.
- `SESSION_SECRET` is present in `.env` (Runway auto-generates one on first
  boot if missing; verify it has not been wiped).
- The Entra app access gate is enabled, or an explicit local/dev exception is
  documented. Note: every `/api/*` route now requires the desktop token,
  a delegated session, or an app-access session even when the gate is
  disabled — there is no anonymous access path on the loopback API.
- At least five known devices match expected Autopilot, Intune, Entra, and
  ConfigMgr/SCCM states.
- Admin sign-in, sign-out, and one low-risk delegated action such as Intune
  device sync have been validated.
- Tauri updater signing is configured, and Windows Authenticode signing has
  either been wired with a real certificate or accepted as the remaining
  SmartScreen risk for a controlled pilot. See
  [`docs/release-signing.md`](docs/release-signing.md).
- The security review in [`docs/security-report.md`](docs/security-report.md)
  and the preflight in
  [`docs/live-testing-checklist.md`](docs/live-testing-checklist.md) have been
  accepted.

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
  _Autopilot record → group membership → assigned profile → effective
  deployment mode_ and tells you exactly which link is broken.
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
- **ConfigMgr / SCCM client presence** — optional, presence-only signal that
  appears alongside Graph, Intune, and Entra on device detail pages. Derived
  from Intune's `managementAgent` value. Tells you whether a ConfigMgr client
  is reported on the device — not whether it is healthy, on-site, or pulling
  the right update channel.
- **Tenant access gate** — Entra sign-in gate locks the app before operators
  can see fleet data once Graph is configured; delegated admin consent remains
  separate.
- **Desktop polish** — Tauri shell with Runway branding, custom title bar,
  drag region, minimize/maximize/close controls, and Windows installers.
- **Mock mode** — seeds realistic data when Graph credentials aren't
  configured, so the entire UI is explorable offline.

---

## Stack

| Layer   | Tech                                                                   |
| ------- | ---------------------------------------------------------------------- |
| Client  | React 19, TypeScript, Vite, Tailwind CSS v4                            |
| Routing | TanStack Router (URL-as-state), TanStack Query                         |
| UI      | shadcn-style primitives, lucide-react icons                            |
| Server  | Express 5, better-sqlite3, pino                                        |
| Auth    | MSAL Node - app-only sync, delegated actions, Entra app access gate    |
| Desktop | Tauri 2, custom Windows title bar, NSIS/MSI installers                 |
| Tests   | Vitest (unit / api / e2e), Testing Library, supertest                  |

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
- API: <http://localhost:3001>

If `AZURE_TENANT_ID` / `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET` are not set
and the database is empty, Runway automatically falls back to **mock mode**
on first start so the entire UI is explorable without a tenant.

For local development, either set `NODE_ENV=development` or replace
`SESSION_SECRET` in `.env` with a long random value before starting the server.

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

# Entra app-access gate. Enforced by default once Graph is configured.
APP_ACCESS_MODE=entra
APP_ACCESS_ALLOWED_USERS=

# SCCM/ConfigMgr detection is toggled in Settings.
# It is read from Intune's managementAgent field; no SCCM connector
# credentials or SCCM actions are configured in Runway.
```

### Mock mode vs live data

Runway ships with mock mode because it makes local development and demos safe.
For live tenant validation:

- Use `SEED_MODE=none`.
- Start with a clean database or a database you know does not contain seeded
  demo records.
- Confirm Settings shows Graph configured and the mock banner is gone.
- Run a sync, then validate a small known device set before trusting fleet-wide
  counts.

Mock data is realistic, but it is still fake. Do not mix mock and live records
when producing screenshots or reports for leadership.

### SCCM / ConfigMgr visibility

Runway does **not** connect to a Configuration Manager site server, does
**not** store SCCM credentials, and does **not** run SCCM actions.

For v1.0, the SCCM check answers exactly one question:

> Does Microsoft Graph / Intune report this Windows device as having a
> Configuration Manager client?

This is a **presence-only** signal. It does not confirm site assignment,
policy retrieval, last-policy-request time, inventory freshness, MP/DP
reachability, software update group membership, or which authority
(ConfigMgr vs Windows Update for Business) is driving updates on the device.

Runway reads `managedDevice.managementAgent` from Microsoft Graph. If the
value contains `configurationManager`, Runway shows the ConfigMgr client as
reported.

| Runway status                   | Meaning                                                                          |
| ------------------------------- | -------------------------------------------------------------------------------- |
| `ConfigMgr client reported`     | Intune's `managementAgent` contains `configurationManager`.                      |
| `ConfigMgr client not reported` | Intune reports a management agent, but it does not contain `configurationManager`. |
| `Not reported by Intune`        | The Intune record exists, but Graph did not return `managementAgent`.            |
| `Cannot determine`              | No Intune managed-device record exists for the correlated device.                |
| `Signal disabled`               | The optional ConfigMgr presence flag is off in Settings.                         |

If you need true ConfigMgr client health — site assignment, policy retrieval,
inventory freshness, MP/DP reachability, software update deployment status,
or console record status — that requires a direct ConfigMgr connector via
AdminService, read-only SQL, or a trusted ConfigMgr PowerShell host. That
work is **not in v1.0** and is on the roadmap as an optional, opt-in
connector.

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

| Script                 | What it does                                      |
| ---------------------- | ------------------------------------------------- |
| `npm run dev`          | Vite client + tsx server, hot reload              |
| `npm run build`        | Build client and server bundles into `dist/`      |
| `npm run start`        | Run the built server                              |
| `npm run db:migrate`   | Apply schema migrations to the SQLite database    |
| `npm run db:seed:mock` | Seed realistic mock devices, groups, profiles     |
| `npm run test`         | Vitest unit + api projects                        |
| `npm run test:e2e`     | Vitest e2e project                                |
| `npm run lint`         | ESLint                                            |
| `npm run check`        | Lint + unit/API + e2e tests                       |
| `npm run tauri:dev`    | Run as a Tauri desktop app                        |
| `npm run tauri:build`  | Build the Tauri executable and Windows installers |

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
   from Microsoft Graph and writes them into `raw_*` tables verbatim. Intune's
   `managementAgent` field is retained for the ConfigMgr/SCCM visibility
   signal.
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
- **[docs/user-guide.md](./docs/user-guide.md)** — comprehensive technician guide for day-to-day Runway use
- **[docs/engine.md](./docs/engine.md)** — health flags, rule DSL, custom rules
- **[docs/graph-setup.md](./docs/graph-setup.md)** — app registration, permissions, redirect URIs
- **[docs/troubleshooting.md](./docs/troubleshooting.md)** — live Graph troubleshooting and symptom-to-fix tables
- **[docs/live-testing-checklist.md](./docs/live-testing-checklist.md)** — pre-flight checks before connecting a tenant
- **[docs/release-signing.md](./docs/release-signing.md)** — updater signing, Authenticode status, release artifact shape
- **[docs/security-report.md](./docs/security-report.md)** — security posture summary for review/approval
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

SCCM/ConfigMgr support is visibility-only and Graph-derived. The app does not
hold SCCM credentials, open a site-server connection, or dispatch ConfigMgr
client actions.

If you discover a security issue, please see [SECURITY.md](./SECURITY.md).

---

## License

MIT © Runway contributors — see [LICENSE](./LICENSE).
