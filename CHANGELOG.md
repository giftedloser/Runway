# Changelog

All notable changes to Runway will be documented in this file. The
format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> Runway is pre-release. No versioned tags have been cut yet — every
> change below lives on `main`. Once the first public release is cut, the
> Unreleased section will be split and the `[0.1.0]` link activated.

## [Unreleased]

### Added
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
- **Expanded bulk actions** — `retire` and `rotate-laps` join `sync` and
  `reboot` on `/api/actions/bulk`, gated behind the existing delegated-
  auth check and 200-device cap. The confirmation modal now has three
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

[Unreleased]: https://github.com/giftedloser/PilotCheck/commits/main
