# Changelog

All notable changes to PilotCheck will be documented in this file. The
format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- **Rule authoring form silently dropped boolean and number rules.**
  The settings → Custom Rules form sent every non-hour value as a raw
  string, so a rule like `hasAutopilotRecord eq true` was serialized as
  `eq "true"` and the engine's type-preserving `normalize()` would
  compare `true === "true"` and never match. Field registry now
  declares each field's type; boolean fields render a True/False
  dropdown; number fields use `type="number"` and coerce via `Number()`;
  CSV list ops stay raw. Covered by seven new client-side tests.

### Added
- Device queue **column picker** — registry-driven popover lets operators
  toggle Primary User, Compliance, Property, and Deployment Mode columns
  on or off. Choices persist via `usePreference` and the Device column
  is locked on so the queue can never be rendered headerless.
- Per-flag **diagnostic playbooks** on Device Detail — each flag now
  ships templated portal links, Graph PowerShell, Graph REST URLs, and
  doc links so techs can act in one click instead of context-switching.
- **End-to-end engine tests** for `computeAllDeviceStates` (15 tests)
  feeding crafted Autopilot/Intune/Entra fixtures through
  `persistSnapshot` and asserting which flags fire — including a
  word-boundary regression guard for `hybrid_join_risk` and a
  case-insensitive UPN match for `user_mismatch`.
- Profile inspector drawer on the Profile Audit page — segmented health
  bar, click-through queue filters, targeting groups, common-problems
  grid, and a 25-row device breakdown without losing page context.
- Bulk action confirmation modal — sync/reboot from the queue now opens a
  preview dialog with health-distribution chips, a scrollable device list,
  and a destructive warning banner before any action fires.
- Device detail single-key shortcuts: `r` refetches device data, `s`
  dispatches a sync, `b` returns to the queue. Hint chips render in the
  breadcrumb row and the global shortcut overlay learns the new section.
- **Test suite expansion** — 32 new tests covering the rule DSL evaluator
  (every operator, scope filter, and malformed-predicate safety net), the
  recent-transitions and newly-unhealthy queries against a real sqlite
  schema, and remote action route guardrails (allowlist enforcement, 200
  device cap, NetBIOS rename validation, audit log writes). Total suite
  now 37 tests.

### Changed
- Global keyboard shortcut listener now attaches in capture phase so
  Vim-style two-key sequences (`g s`) preempt page-local single-key
  handlers like the new device detail shortcuts.

### Added (earlier)
- Dashboard "What changed in 24h" feed — surfaces the most recent state
  transition per device in the last 24 hours, classified as regression /
  recovery / lateral with the added/removed flag diff and a click-through
  to the device. Built on a single windowed query against
  `device_state_history`.
- Keyboard shortcut overlay (`?`) and Vim-style two-key navigation
  (`g d` Dashboard, `g v` deVices, `g c` Critical, `g p` Profiles,
  `g g` Groups, `g s` Sync, `g a` Audit, `g ,` Settings). Sequences
  time out after 1.2s and are suppressed while typing in form fields.
  Sidebar footer shows the `?` and `⌘K` hint chips.
- Device Detail header now shows four at-a-glance "breakpoint" chips
  (Identity / Targeting / Enrollment / Drift), colored by the worst severity
  in each subsystem so operators can triage in under a second.
- Settings → Tag Mapping supports JSON import (upserts via the existing
  POST endpoint) and one-click export, so the casino-tag dictionary can be
  versioned and shared across environments.
- Group Inspector now has health filter chips and a member search box for
  large groups.
- Cross-device Action Audit page (`/actions`) with success-rate stats,
  status / action-type filters, expandable error details, and 30-second
  polling.
- Dashboard 14-day estate health trend chart, computed from
  `device_state_history` transitions.
- Quick "Saved Views" chips on the device queue (All, Critical, No profile,
  User mismatch, Provisioning stalled).
- Global toast hub (no third-party dependency) wired into sync, bulk
  actions, CSV export, and tag mapping import.
- Sidebar property quick-jumps generated from the tag dictionary.
- Profile health breakdown tiles are now click-throughs to the device
  queue scoped to that profile + health.
- Sync status detail: per-row status icons, expandable error lists,
  human-readable durations, and a summary card.
- README, CONTRIBUTING, SECURITY, CHANGELOG, and `docs/` (architecture,
  engine, graph-setup) for the public release.
- MIT LICENSE.

### Fixed
- Settings page listed env vars as `GRAPH_*` but the server actually reads
  `AZURE_*` — labels and the missing-vars list now match the server.

## [0.1.0] - 2026-04-07

Initial public release.

[Unreleased]: https://github.com/giftedloser/PilotCheck/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/giftedloser/PilotCheck/releases/tag/v0.1.0
