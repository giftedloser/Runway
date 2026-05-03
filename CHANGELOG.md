# Changelog

All notable changes to Runway will be documented in this file. The
format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> Runway 1.0.0 is the first versioned release candidate. Cut tag `v1.0.0`
> from the release commit when the signed Windows artifacts are ready.

## [Unreleased]

### Security

- Gated `POST /api/rules/preview` behind `requireDelegatedAuth` so a
  same-host process can no longer fan out arbitrary predicates against
  synced tenant data.
- Gated `GET /api/settings/tag-config` behind `requireDelegatedAuth` for
  consistency with the mutation siblings; the Tags view continues to
  read mappings via the parent `/api/settings` endpoint.
- Switched the desktop-token comparison in
  `requireLocalAccess` to `crypto.timingSafeEqual` with explicit
  length-mismatch and missing-header guards, removing the timing-attack
  surface even on a single-user workstation.
- Extended pino redact paths to cover request body credential fields
  (`clientSecret`, `azureClientSecret`, `password`, `token`,
  `accessToken`, `idToken`, `refreshToken`, session secrets,
  certificate thumbprints) and the `idempotency-key` request header.
  Defence in depth — bodies aren't logged today.
- Destructive action confirmation now uses
  `serial ?? deviceName ?? intuneId ?? autopilotId` for the typed
  confirmation token. Devices missing all four refuse to render the
  destructive flow; the previous behaviour silently fell back to the
  literal "CONFIRM" string.

### Performance

- Added migration `015-action-log-time-index.sql` (`idx_action_log_triggered_at`)
  so the audit-log CSV / NDJSON export at `GET /api/actions/logs/export`
  no longer falls back to a sequential scan.

### Changed

- Destructive actions in the device-detail toolbar now carry a subtle
  critical-color left border at rest, a critical-tinted icon, and an
  explicit `focus-visible` outline that matches severity. Hover and
  confirmation behaviour unchanged.

### Added

- `npm run db:seed:scale` — dev-only smoke seed that generates ~4,500
  devices across ~30 properties with realistic problem distribution
  and prints rough query timings (build / persist / compute /
  dashboard / device list / tags inventory / provisioning lookup /
  device detail / second-pass recompute). Never invoked by the test
  suite or CI.

### Documentation

- Added `docs/live-tenant-dry-run.md`, a step-by-step runbook for the
  first time Runway is pointed at a real tenant. Read-and-look-only;
  destructive actions are explicitly deferred to a later soak.
- Added an "Optional?" column to the delegated permission tables in
  README and `docs/security-report.md` so a security owner can grant
  only the scopes for the features they intend to use.
- Refreshed README to describe the v1.6 app shape: first-run setup,
  sync status pill, Tags view, Provisioning Builder, Build Payload
  guidance, EntityPicker for Change Primary User, single-device
  destructive actions, and an explicit "what Runway intentionally does
  not do" list.
- Light README style pass: compact "At a glance" facts table, inline
  "Jump to" links, and collapsed reference material (`.env` keys,
  ConfigMgr signal states, Graph permissions, full npm scripts, project
  layout) so the GitHub landing page scans in seconds.
- Rewrote `docs/user-guide.md` end-to-end to match the current UI.
  Removed stale references to "Confirm destructive actions" toggle,
  "enter user object ID" / "raw GUID" copy on Change Primary User, and
  Settings-side individual tag mapping editing. Added Tags view, tag
  mapping drawer, Build Payload availability states, sync status pill,
  setup checklist, EntityPicker, tabbed device detail with `?tab=`
  deep-links, and a tenant testing workflow.
- Updated `docs/architecture.md` with first-run completion criteria,
  sync status source of truth, app-only vs delegated split, Build
  Payload data flow, `tag_config` cleanup notes, and a non-goals
  section.
- Expanded `docs/live-testing-checklist.md` with first-run setup, sync
  pill, Tags, Provisioning Builder + Build Payload, EntityPicker, and
  a 1.5 → 1.6 rollback section.
- Tightened `docs/security-report.md` and `docs/runway-overview.md` to
  remove fabricated benchmarks and clarify destructive-action,
  idempotency, EntityPicker, and snapshot retention behaviour.
- Refreshed `.github/pull_request_template.md` with a Risks section,
  the `bug_report.md` issue template with new affected-surface options
  for Setup / Tags / Provisioning Builder / Build Payload, and added a
  CHANGELOG discipline section to `CONTRIBUTING.md`.

## [1.6.0] - 2026-05-02

### Changed

- Clarified first-run setup by merging Graph permission verification and
  initial sync into one setup step with clearer no-device-row recovery copy.
- Renamed Dashboard and Device Detail "breakpoint" language to
  admin-facing "problem area" copy.
- Improved sync status pill age labels so stale data reads as days, weeks,
  months, or years instead of large minute counts.
- Reordered Settings so Custom Rules sits beside Rules & Thresholds,
  normalized section headers, and reduced default-value hint noise on
  settings already using defaults.
- Renamed the Settings tag mapping bulk card to "Import / export tag
  mappings" and aligned the profile-audit empty state with the rest of the
  app.
- Added a visible sidebar sign-out button for active admin sessions,
  clarified the Action Audit sign-in gate, normalized sync button wording,
  and toned down sidebar help icons across themes.
- Added standard settings access tiers and server-side write enforcement for
  public-local, bootstrap, operational, and security-sensitive settings.
- Made local display preferences, including theme, editable without delegated
  Microsoft admin sign-in while keeping operational and security settings gated.
- Added first-run detection, a non-blocking setup banner, and a `/setup`
  checklist for tenant connection, Graph permission verification, initial sync,
  and first tag configuration.
- Added a persistent sync status pill with freshness, failure details, and
  clearly gated manual sync access.
- Improved empty states across Tags, Provisioning Builder, Build Payload,
  Devices, and Group Inspector.
- Added a capped HelpTooltip system with local dismissal/reset for the sidebar
  and Provisioning Builder section headers.
- Tightened sidebar property overflow so long property lists scroll while the
  footer, theme control, and version stay pinned.
- Added a delegated user EntityPicker for Change Primary User so admins can
  search by display name, UPN, or mail while the existing action still receives
  the selected Graph user ID.
- Added What now guidance to Build Payload warnings for missing required apps
  and payloads found through another discovered group.
- Centralized Microsoft portal deep-link helpers for device detail,
  provisioning, Build Payload, and playbook links; portal URL patterns were
  checked on 2026-05-01.
- Build Payload now distinguishes no selected group, unsynced assignment data,
  sync/error-unavailable assignment data, and a confirmed empty payload.
- Moved individual tag mapping edits from Settings into a Tags side drawer,
  leaving Settings with JSON import/export and a Tags management link.
- Demoted strict expected groups/profiles to Advanced tag mapping controls and
  suppressed expectation warnings when no expectations are configured.
- Unified the sidebar theme cycler and Settings theme dropdown on the
  `display.theme` app setting.
- Moved the retention sweep interval into a shared Advanced disclosure in
  Sync & Data.

### Removed

- Removed the never-disable-confirmations toggle; destructive confirmations
  are always enforced.

## [1.5.1] - 2026-04-30

### Added

- Added database-backed app settings with DB / environment / code-default
  precedence and reset-to-defaults support.
- Moved operational tunables out of `.env` and into the Settings UI while
  keeping legacy environment overrides working with a one-time boot warning.
- Added live settings for theme, date/time format, sync triggers, session
  timeout, table page size, default landing screen, and destructive-action
  confirmation.

## [1.5.0] - 2026-04-29

### Added

- Added the Tags view for provisioning tag triage, including tag-level
  health, assignment summaries, and direct navigation into scoped device
  lists.
- Added the Devices panel for provisioning tags so admins can inspect
  devices attached to a tag without leaving the provisioning workflow.
- Added Build Payload Preview support, including Graph assignment
  normalization and persistence for app, compliance, and configuration
  profile assignment payloads.
- Added database migration `013-graph-assignments.sql` and server query
  coverage for provisioning group and build payload data.

### Fixed

- Aligned provisioning tag counts with the underlying device and
  assignment data so tag summaries match the detailed views.

## [1.0.1] - 2026-04-28

### Fixed

- Stabilized the Provisioning Builder wide-screen layout so the readiness
  review no longer shifts into a sparse side rail before a tag is loaded.

## [1.0.0] - 2026-04-28

### Documentation

- Added [`docs/user-guide.md`](docs/user-guide.md), a comprehensive
  technician-facing guide covering access, triage workflows, every major
  page, remote actions, LAPS/BitLocker, health flags, escalation, and
  operational safety.

### ConfigMgr signal — honesty pass

- **Renamed labels** to make the v1 ConfigMgr signal honest about what it
  is: a *presence* check, not a health check. UI strings change from
  `ConfigMgr detected` / `ConfigMgr not detected` to
  `ConfigMgr client reported` / `ConfigMgr client not reported`. The
  device-detail panel title moves from "SCCM / ConfigMgr Connection" to
  "SCCM / ConfigMgr Client Signal" — Runway does not open a connection.
- **Tightened tooltips, source cards, and footer disclaimers** to spell
  out that the signal does not confirm site assignment, policy retrieval,
  inventory freshness, software-update deployment status, or update
  authority. README, architecture, and live-testing docs updated to match.
- A direct ConfigMgr connector (AdminService / read-only SQL / trusted
  PowerShell host) remains a v-next, opt-in roadmap item; explicitly out
  of scope for v1.

### Tier 2 hardening (post-audit)

- **DB snapshot before destructive maintenance.** Every schema migration
  (when applying any pending `*.sql`) and every retention sweep now
  takes a checkpoint-then-copy snapshot into `<db-dir>/snapshots/`.
  Last 3 per reason are retained; older ones are pruned.
- **Per-route body limits.** Default JSON body limit dropped from 1MB
  to 32KB. The autopilot-import endpoint keeps the 1MB ceiling for its
  hardware-hash payloads. Stops a malformed POST from filling memory
  before validation runs.
- **In-app log viewer.** Pino now multistreams into a 500-entry ring
  buffer; `GET /api/health/logs?level=warn&limit=200` powers the
  Settings → Recent Logs panel for ops investigating "why didn't sync
  run". `dev:server` script pipes through `pino-pretty` to preserve
  colored output locally.
- **Audit log export.** `GET /api/actions/logs/export?format=csv|ndjson`
  streams the full action audit trail with sensible Content-Disposition
  headers. The Action Audit page has a new "Export CSV" button.
- **Tests** for the new security gates and idempotency: 4 new
  `requireLocalAccess` cases (no-creds reject, desktop-token admit,
  cross-origin POST block, tauri-origin POST admit) and 3 new
  Idempotency-Key replay cases (replay, conflict, malformed).

### Tier 1 hardening (post-audit)

- **Certificate-based Graph auth** as an alternative to client secret.
  Set `AZURE_CLIENT_CERT_PATH` + `AZURE_CLIENT_CERT_THUMBPRINT` in `.env`
  and Runway uses the cert; secret is only used as a fallback. Cert auth
  removes the rotating string from disk and is preferred for production.
- **Idempotency keys on destructive actions.** Single-device action POSTs
  now accept an `Idempotency-Key` UUID header; the client generates one
  per click. A duplicate within 24h replays the cached Graph result
  instead of re-dispatching. Reuse with a different action returns 409.
- **Graceful shutdown.** SIGTERM/SIGINT now closes the HTTP server,
  waits up to 10s for any in-flight sync to drain, then closes the
  SQLite handle cleanly before exit.
- **Tauri updater plugin wired.** `tauri-plugin-updater` is registered,
  the updater capability is enabled, and the updater public key is
  embedded in `tauri.conf.json`. The release flow is documented in
  [`docs/release-signing.md`](docs/release-signing.md).
- Authenticode signing slot in `tauri.conf.json` remains ready for a
  Windows code-signing cert (`bundle.windows.signCommand`).

### Fixed

- Pre-existing TypeScript errors that blocked clean `tsc --noEmit`:
  `Setup.tsx` casing in the router, and `as const`-typed dashboard
  search defaults that rejected the typed `health` / `flag` literals.

### Security

- **`/api/*` is now gated end-to-end.** New `requireLocalAccess`
  middleware admits a request only when it carries the per-install
  desktop token, a delegated admin session, or an Entra app-access
  session. Mutating methods additionally enforce an Origin allowlist
  (loopback / `tauri://`) so a stray browser tab on the same workstation
  cannot pivot off the user's cookies. Closes the gap where read routes
  were reachable from any local process when `APP_ACCESS_MODE=disabled`.
- **`SESSION_SECRET` is auto-generated on first run** and persisted to
  `.env` (mode 0600). Packaged desktop builds previously failed to start
  with `NODE_ENV=production` and no pre-existing secret.
- **First-run Graph wizard** now requires a real Entra-shaped client
  secret (≥32 chars, placeholder-rejecting) before writing it to disk.
- **Per-user rate limit** on `/api/actions/*` (token bucket: burst 30,
  sustained 1/s) so a runaway client loop cannot burn Graph quota.
- **Bulk `retire` removed.** Bulk actions are now `sync`, `reboot`,
  `rotate-laps` only — destructive multi-device actions stay one-click-
  per-device.
- `getDelegatedToken` throws when called without a session instead of
  returning a `!`-narrowed `undefined`, so a future middleware reorder
  cannot leak an unauthenticated request to Microsoft Graph.
- Desktop token header is no longer attached to absolute external URLs.

### Performance

- Rule and tag-config CRUD no longer block the event loop on a
  multi-thousand-device fleet. A debounced `scheduleRecompute` coalesces
  bursts and runs `computeAllDeviceStates` on `setImmediate`.
- Graph `Retry-After` is clamped to 1–60s so a misbehaving response can
  no longer hang an entire sync.

### Changed

- Rule predicate evaluation errors are logged once per rule instead of
  silently no-op'ing across the fleet.
- First-run mock seeding flows through `fullSync` (single trigger in
  `index.ts`) and respects `SEED_MODE=none`.
- Centralized `getDeviceIdentity` shared by actions, LAPS, and BitLocker
  routes; `safeJsonParse` consolidated to one definition.
- Dead `RemoteActionType` (snake-case) removed from the actions module
  in favor of the shared kebab-case type.

### Added

- SCCM / ConfigMgr signal hardening: device detail now distinguishes
  `ConfigMgr detected`, `ConfigMgr not detected`, `Not reported by Intune`,
  `Cannot determine`, and `Signal disabled`; docs now spell out the
  Graph-derived `managementAgent` contract for live testing.
- GitHub repo polish: stricter CI now runs lint, database migration, unit/API
  tests, e2e tests, and production build; pull request and issue templates were
  refreshed for Runway; live-testing and security review docs were added.
- **Persistent Saved Views** on the device queue — operators can now save
  the current filter set as a named view (`user_views` table), reorder
  them, rename, delete, and one-click recall. The five built-in presets
  (All, Critical, No profile, User mismatch, Provisioning stalled) remain
  as locked defaults.
- **Rule preview / dry-run** in Settings → Custom Rules — before enabling
  a rule, click "Preview matches" to see the count and a sample of up to
  25 devices that would flag, evaluated against the current snapshot with
  the same engine code the live run uses.
- **Device Detail tab navigation** — the 15 stacked panels are now
  organized into six named tabs (Identity, Targeting, Enrollment, Drift,
  Operate, History) with deep-linkable `?tab=` search params so tickets
  can reference a specific section. The default tab auto-selects the
  highest-severity failing subsystem when none is specified.
- **Expanded bulk actions** — `rotate-laps` joins `sync` and `reboot`
  on `/api/actions/bulk`, gated behind the existing delegated-auth
  check and 200-device cap. The confirmation modal now has three
  phases (confirming → running → results) with per-device pass/fail
  status and Graph response codes after the run completes.
- Typed Graph response interfaces replace `any` across the four core
  sync modules (Autopilot, Intune, Entra, Groups) so TypeScript surfaces
  shape drift at build time instead of runtime.
- LAPS delegated-token unit tests (base64 decode, UTF-8, token refresh,
  404/403 error paths).
- Partial sync failure tests covering Intune-fails-while-Entra-succeeds,
  the best-effort conditional access swallow, and the in-progress lock.
- `docs/troubleshooting.md` — Graph permissions matrix (app-only +
  delegated), env setup keys, and the three-wave sync failure model with
  symptom→fix tables.

### Fixed

- **Rule authoring form silently dropped boolean and number rules.**
  The settings → Custom Rules form sent every non-hour value as a raw
  string, so a rule like `hasAutopilotRecord eq true` was serialized as
  `eq "true"` and the engine's type-preserving `normalize()` would
  compare `true === "true"` and never match. Field registry now
  declares each field's type; boolean fields render a True/False
  dropdown; number fields use `type="number"` and coerce via `Number()`;
  CSV list ops stay raw.
- Settings page listed env vars as `GRAPH_*` but the server actually reads
  `AZURE_*` — labels and the missing-vars list now match the server.
- Auth hardening, resilient parsing, and Tier 1 polish (see commit
  `a6ba23e` for the full audit sweep).

### Changed

- Global keyboard shortcut listener now attaches in capture phase so
  Vim-style two-key sequences (`g s`) preempt page-local single-key
  handlers like the device detail shortcuts.

### Earlier on main (pre-audit)

- Device queue **column picker** — registry-driven popover lets operators
  toggle Primary User, Compliance, Property, and Deployment Mode columns
  on or off. Choices persist via `usePreference` and the Device column is
  locked on so the queue can never be rendered headerless.
- Per-flag **diagnostic playbooks** on Device Detail — each flag ships
  templated portal links, Graph PowerShell, Graph REST URLs, and doc
  links so techs can act in one click instead of context-switching.
- Profile inspector drawer on the Profile Audit page — segmented health
  bar, click-through queue filters, targeting groups, common-problems
  grid, and a 25-row device breakdown without losing page context.
- Bulk action confirmation modal, device detail single-key shortcuts
  (`r` refetch, `s` sync, `b` back).
- Dashboard "What changed in 24h" feed classified as regression /
  recovery / lateral, with added/removed flag diffs.
- Keyboard shortcut overlay (`?`) and Vim-style two-key navigation
  (`g d`, `g v`, `g c`, `g p`, `g g`, `g s`, `g a`, `g ,`). Sequences
  time out after 1.2s and are suppressed while typing in form fields.
- Device Detail header shows four at-a-glance "breakpoint" chips
  (Identity / Targeting / Enrollment / Drift) colored by the worst
  severity in each subsystem.
- Settings → Tag Mapping JSON import/export.
- Group Inspector health filter chips and member search.
- Cross-device Action Audit page (`/actions`) with success-rate stats,
  filters, expandable error details, 30-second polling.
- Dashboard 14-day estate health trend chart from `device_state_history`.
- Global toast hub (no third-party dependency).
- Sidebar property quick-jumps from the tag dictionary.
- Profile health breakdown click-throughs to the device queue scoped to
  that profile + health.
- Sync status detail: per-row status icons, expandable error lists,
  human-readable durations, summary card.
- README, CONTRIBUTING, SECURITY, `docs/` (architecture, engine,
  graph-setup), MIT LICENSE.

[Unreleased]: https://github.com/giftedloser/Runway/compare/v1.5.0...HEAD
[1.5.0]: https://github.com/giftedloser/Runway/compare/v1.0.1...v1.5.0
[1.0.1]: https://github.com/giftedloser/Runway/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/giftedloser/Runway/releases/tag/v1.0.0
