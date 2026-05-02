# Runway

> A local-first triage console for **Windows** Autopilot, Intune, Entra ID,
> and Graph-derived ConfigMgr / SCCM client presence. Windows-only by design.

![CI](https://github.com/giftedloser/Runway/actions/workflows/ci.yml/badge.svg)
![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform: Windows](https://img.shields.io/badge/platform-Windows-0078d4.svg)
![Local-first](https://img.shields.io/badge/data-local--first-2ea44f.svg)

Runway correlates Windows device identities across Microsoft Autopilot,
Intune, Entra ID, and the ConfigMgr/SCCM signal exposed by Intune, computes
provisioning health with a transparent rule engine, and presents
**problem-first** diagnostics — so an operator opening the app on a Monday
morning can tell within seconds which devices are broken, _why_, and _what to
do about it_.

It's built for the small-but-real internal IT team running a fleet of a few
hundred to a few thousand Windows endpoints — the band where SCCM console
hopping is too heavy for quick triage, the Intune admin centre is too slow to
work from all day, and PowerShell scripts are how everyone is currently
getting by.

### At a glance

|                  |                                                                            |
| ---------------- | -------------------------------------------------------------------------- |
| Platform         | Windows 11 / 10 (Tauri desktop shell)                                      |
| Data sources     | Autopilot · Intune · Entra ID · Graph-derived ConfigMgr presence           |
| Data residency   | Local SQLite on the operator's machine                                     |
| Auth             | Bring-your-own Entra app registration (app-only sync, delegated actions)   |
| Network egress   | `login.microsoftonline.com` and `graph.microsoft.com` only                 |
| Targeting        | Single tenant, single device per destructive action                        |
| Out of scope     | iOS / Android / macOS, multi-tenant, policy authoring, ConfigMgr connector |

### Jump to

[Quick start](#quick-start) ·
[What it does](#what-it-does) ·
[What it intentionally does not do](#what-it-intentionally-does-not-do) ·
[Configuration](#configuration) ·
[Tenant testing](#tenant-testing-warning) ·
[Documentation](#documentation)

Runway is laser-focused on the Windows triage loop and stays honest about
that scope.

## Tenant testing warning

Runway is intended for controlled tenant testing. Before pointing it at a
real tenant:

- Run with `SEED_MODE=none` so mock seed data does not mix with live records.
- Confirm `SESSION_SECRET` is present in `.env` — Runway auto-generates one
  on first boot, but verify it has not been wiped before live use.
- Keep the Entra app access gate enabled, or document an explicit
  single-operator/dev exception. Every `/api/*` route requires the desktop
  token, a delegated admin session, or an app-access session even when the
  gate is disabled — there is no anonymous loopback path.
- Validate the live data against a small known device set before trusting
  fleet-wide counts.
- Treat all destructive remote actions as one-click-per-device. Confirmations
  are always enforced.

The full preflight lives in
[`docs/live-testing-checklist.md`](docs/live-testing-checklist.md). The
security posture is summarised in
[`docs/security-report.md`](docs/security-report.md). Tauri updater and
Authenticode notes are in
[`docs/release-signing.md`](docs/release-signing.md).

---

## What it does

- **Cross-system identity correlation** — joins Autopilot hardware records,
  Intune managed devices, and Entra device objects on serial / device ID /
  ZTDID, surfacing identity conflicts and orphans.
- **Provisioning health engine** — pure rule evaluation against the joined
  state, producing typed flags (`no_profile_assigned`, `not_in_target_group`,
  `provisioning_stalled`, `compliance_drift`, …) with severity, summary, and
  the raw evidence behind each.
- **First-run setup** — a `/setup` checklist walks tenant connection, Graph
  permission verification through an initial sync, and the first tag mapping.
  A non-blocking banner reminds operators while it is incomplete.
- **Sync freshness pill** — the top bar shows last successful sync age,
  in-progress state, and last error, and is the gated entry point for
  manual sync.
- **Tags view** — the source-of-truth surface for Autopilot group tags,
  with health, device counts, and a side drawer for editing individual tag
  mappings. Settings only handles JSON import/export.
- **Provisioning Builder** — diagnose-and-fix workflow for a single tag's
  group/profile/payload chain. The Build Payload panel surfaces required
  apps, configuration profiles, and compliance policies for the selected
  group, and warns when assignment data is missing, stale, or routed
  through another discovered group.
- **Diagnostic playbooks and next-best-action** — every flag has a
  templated playbook with deep-links into Microsoft portals and Graph
  references; device detail surfaces a next-best-action card for the
  highest-severity subsystem.
- **Assignment-path inspector** — for any device, walks the chain
  _Autopilot record → group membership → assigned profile → effective
  deployment mode_ and tells you exactly which link is broken.
- **Device detail tabs** — Identity, Targeting, Enrollment, Drift, Operate,
  History — with deep-linkable `?tab=` search params.
- **Drift history** — transition-only `device_state_history` table, plus a
  14-day fleet-wide health trend on the dashboard.
- **Remote actions** (delegated auth) — single-device sync, reboot, rename,
  rotate LAPS, Autopilot reset, retire, factory wipe, delete-from-Intune,
  delete-from-Autopilot — destructive confirmations are always enforced and
  every attempt is logged to the cross-device Action Audit timeline. Bulk
  actions are restricted to `sync`, `reboot`, and `rotate-laps`.
- **Change Primary User EntityPicker** — search Entra users by display
  name, UPN, or mail; no raw GUID entry required.
- **LAPS and BitLocker retrieval** — on-demand fetch with reveal toggle,
  copy-to-clipboard, and auto-rehide. Secrets are never persisted.
- **Custom rules** — small predicate DSL for site-specific health checks,
  scoped globally / per-property / per-profile, with a preview-matches
  dry-run before enabling.
- **Group inspector** — Entra group membership, dynamic membership rule, the
  profiles each group resolves to, and member-level health filtering.
- **Profile audit** — health breakdown per Autopilot profile with click-through
  to the device queue.
- **Centralised portal deep-links** — device detail, provisioning, Build
  Payload, and playbook links all route through one helper so portal URL
  patterns stay consistent.
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

## What it intentionally does not do

- It is not a full Intune replacement, multi-tenant console, MSP platform,
  or policy authoring tool.
- It does not manage iOS, Android, or macOS endpoints.
- It does not run bulk destructive actions; retire, wipe, Autopilot reset,
  rename, and the delete cleanups are single-device clicks.
- It does not connect to a Configuration Manager site server, store SCCM
  credentials, or dispatch SCCM actions. The ConfigMgr signal is
  presence-only.
- It does not export tenant data to a Runway cloud — there is no Runway
  cloud, no telemetry, and no third-party data processor.

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

For local development, copy `.env.example` to `.env` at the repo root and
fill in the values. For the installed desktop app, place the same `.env`
file in the per-user app data folder:

- Windows: `%LOCALAPPDATA%\com.giftedloser.pilotcheck\.env`

<details>
<summary><strong><code>.env</code> reference</strong></summary>

The full annotated template lives in [`.env.example`](./.env.example).
The keys most operators set:

```ini
# Microsoft Graph (read-only ingestion). Use either a client secret or
# a certificate (preferred); see .env.example for cert keys.
AZURE_TENANT_ID=
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
AZURE_REDIRECT_URI=http://localhost:3001/api/auth/callback

# Session signing for delegated auth. Auto-generated on first boot if
# left blank or at the built-in default. Set manually only for shared
# multi-host installs.
SESSION_SECRET=

# Entra app-access gate. Enforced once Graph is configured; set
# `disabled` only for documented local/dev runs.
APP_ACCESS_MODE=entra
APP_ACCESS_ALLOWED_USERS=

# Server
PORT=3001
CLIENT_PORT=5173
DATABASE_PATH=./data/pilotcheck.sqlite
LOG_LEVEL=info
```

Day-to-day tunables (sync interval, rule thresholds, retention windows,
mock seed mode, theme, etc.) live in **Settings** as DB-backed app
settings. Legacy environment overrides are still honoured for
automation, but Settings values take precedence. SCCM / ConfigMgr
detection is toggled in Settings — Runway reads Intune's
`managementAgent` only and ships no SCCM connector.

</details>

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
**not** store SCCM credentials, and does **not** run SCCM actions. The
SCCM check answers exactly one question:

> Does Microsoft Graph / Intune report this Windows device as having a
> Configuration Manager client?

This is a **presence-only** signal derived from `managedDevice.managementAgent`.
It does not confirm site assignment, policy retrieval, inventory
freshness, MP/DP reachability, software update group membership, or which
authority is driving updates on the device.

<details>
<summary><strong>ConfigMgr signal states</strong></summary>

| Runway status                   | Meaning                                                                            |
| ------------------------------- | ---------------------------------------------------------------------------------- |
| `ConfigMgr client reported`     | Intune's `managementAgent` contains `configurationManager`.                        |
| `ConfigMgr client not reported` | Intune reports a management agent, but it does not contain `configurationManager`. |
| `Not reported by Intune`        | The Intune record exists, but Graph did not return `managementAgent`.              |
| `Cannot determine`              | No Intune managed-device record exists for the correlated device.                  |
| `Signal disabled`               | The optional ConfigMgr presence flag is off in Settings.                           |

If you need true ConfigMgr client health — site assignment, policy
retrieval, inventory freshness, MP/DP reachability, software update
deployment status, or console record status — that requires a direct
ConfigMgr connector via AdminService, read-only SQL, or a trusted
ConfigMgr PowerShell host. That is on the roadmap as an optional, opt-in
connector and is explicitly out of scope today.

</details>

### Required Graph permissions

<details>
<summary><strong>Application permissions (always required for read-only sync)</strong></summary>

| Permission | Why Runway needs it |
| --- | --- |
| `DeviceManagementServiceConfig.Read.All` | Read Autopilot deployment profiles and assignments. |
| `DeviceManagementManagedDevices.Read.All` | Read Intune managed devices (compliance, primary user, `managementAgent`). |
| `DeviceManagementConfiguration.Read.All` | Read configuration profiles and assignments for Build Payload. |
| `Device.Read.All` | Read Entra device objects for cross-system identity correlation. |
| `Group.Read.All` | Read Entra groups and memberships for targeting. |

</details>

<details>
<summary><strong>Delegated permissions (only grant the ones for features you'll use)</strong></summary>

| Permission | Powers | Optional? |
| --- | --- | --- |
| `User.Read` | Identifies the signed-in admin and stamps Action Audit `triggeredBy`. | **Required** for any delegated flow. |
| `DeviceManagementManagedDevices.ReadWrite.All` | Sync, reboot, rename, rotate LAPS, change primary user. | **Required** if you'll run any remote action. |
| `DeviceManagementManagedDevices.PrivilegedOperations.All` | Retire, wipe, Autopilot reset. | Optional — skip if the pilot won't run destructive actions. |
| `User.ReadBasic.All` | Change Primary User EntityPicker (search Entra users by display name / UPN / mail). | Optional — skip if Change Primary User won't be used. |
| `DeviceLocalCredential.Read.All` | LAPS password retrieval. | Optional — skip if LAPS retrieval won't be used. |
| `BitLockerKey.Read.All` | BitLocker recovery key retrieval. | Optional — skip if BitLocker retrieval won't be used. |
| `Group.ReadWrite.All` | Add / remove device from an Entra group during remediation. | Optional — skip if group remediation won't be used. |
| `DeviceManagementServiceConfig.ReadWrite.All` | Autopilot hardware-hash import. | Optional — skip if you won't import hardware hashes through Runway. |

Grant admin consent in the tenant after assigning these. Optional scopes
can be omitted up front and added later — when an action lacks its
scope, Graph returns 403 and the failure is recorded in **Action
Audit** with the HTTP status (use that to confirm whether to add a
scope vs grant the admin a different Entra/Intune role).

</details>

---

## Development

The most-used commands:

| Script                 | What it does                                   |
| ---------------------- | ---------------------------------------------- |
| `npm run dev`          | Vite client + tsx server, hot reload           |
| `npm run check`        | Lint + typecheck + unit/API + e2e tests        |
| `npm run build`        | Build client and server bundles into `dist/`   |
| `npm run tauri:dev`    | Run as a Tauri desktop app                     |
| `npm run tauri:build`  | Build the Windows installers                   |

<details>
<summary><strong>All npm scripts</strong></summary>

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
| `npm run typecheck`    | `tsc --noEmit`                                    |
| `npm run check`        | Lint + typecheck + unit/API + e2e tests           |
| `npm run tauri:dev`    | Run as a Tauri desktop app                        |
| `npm run tauri:build`  | Build the Tauri executable and Windows installers |

</details>

<details>
<summary><strong>Project layout</strong></summary>

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

</details>

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

- **[docs/user-guide.md](./docs/user-guide.md)** — admin guide for first-run setup, daily triage, Tags, Provisioning Builder, Build Payload, remote actions, LAPS/BitLocker, and tenant testing
- **[docs/architecture.md](./docs/architecture.md)** — system architecture, data flow, schema overview, sync source of truth
- **[docs/engine.md](./docs/engine.md)** — health flags, rule DSL, custom rules
- **[docs/graph-setup.md](./docs/graph-setup.md)** — app registration, permissions, redirect URIs
- **[docs/troubleshooting.md](./docs/troubleshooting.md)** — live Graph troubleshooting and symptom-to-fix tables
- **[docs/live-testing-checklist.md](./docs/live-testing-checklist.md)** — pre-flight checks before connecting a tenant
- **[docs/release-signing.md](./docs/release-signing.md)** — updater signing, Authenticode status, release artifact shape
- **[docs/security-report.md](./docs/security-report.md)** — security posture summary for review/approval
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** — development workflow, conventions
- **[SECURITY.md](./SECURITY.md)** — vulnerability reporting and trust boundaries
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
