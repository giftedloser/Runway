# Changelog

All notable changes to PilotCheck will be documented in this file. The
format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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
