# PilotCheck — Phase 5 Plan

> Status: **proposed**
> Prereq: Phase 3.5 (Remote Actions + LAPS + Delegated Auth) and Phase 4 (Group Inspector) shipped.
> Current pass: server-side hardening, UI/UX clarity refactor, source-of-truth zoning.

## Framing

PilotCheck is **not an Autopilot dashboard**. It is an **end-to-end endpoint state validation engine**
that asks one question for every device:

> _Is this endpoint joined, enrolled, configured, and operating in the state we intend — across
> Autopilot, Intune, and Entra ID — and if not, where exactly does the chain break?_

Every screen, label, and badge in the UI should reinforce that framing. The recent refactor introduced
`SourceBadge` (Autopilot / Intune / Entra ID / Graph / Derived), grouped sidebar navigation
(Triage → Inspect → System), numbered sections on the device detail page, and a clearer Settings
flow. Phase 5 builds on that foundation.

---

## Phase 5 — Goals

1. **Configurable rules engine** — let admins encode their own join/config expectations without
   touching code.
2. **Drift over time** — turn the current "snapshot" view into a time-aware story so engineers can
   see when a device started failing and what changed.
3. **Bulk operations** — multi-select in the device queue, scoped remote actions, audit-safe.
4. **Trustworthy mock mode** — make it obvious when data isn't live, and prevent silent reseeds.
5. **First-run experience** — a guided setup that walks an engineer from zero to a working
   ingestion in < 5 minutes.

---

## Workstreams

### 5.1 — Rule Engine v1 (server)

**Why:** the current state engine has 14 hard-coded flags. Real customers have site-specific
expectations (OS build floors, encryption posture, naming conventions, primary-user domains).

- New table `rule_definitions` with: id, name, description, severity, scope (global / property /
  profile), enabled, predicate (small JSON DSL), created_at, updated_at.
- Predicate DSL is intentionally tiny: `{ field, op, value }` plus `and` / `or` / `not`.
- Engine runs built-in flags + enabled rules, surfaces results with the same `FlagExplanation` shape.
- New route `/api/rules` (CRUD) gated to admin sign-in.
- Settings page gains a **Rules** section that lists, toggles, and edits rules.
- Rule evaluation must be deterministic and side-effect free (pure function over device bundle).

### 5.2 — Drift Timeline (server + client)

**Why:** "this device is broken" is half the story. "This device went from healthy to broken on
Tuesday at 14:02 after a profile assignment changed" is actionable.

- New table `device_state_history` with hashed-state-key + flag-set diff per sync.
- Each sync writes a row only when the state hash changes (cheap).
- New endpoint `GET /api/devices/:key/history` returns chronological events.
- New `Section 5: History` panel on the Device Detail page renders the timeline with
  before/after diffs of flags, profile, and trust type.
- Dashboard gains a "New today" KPI tile (devices that became unhealthy in the last 24h).

### 5.3 — Bulk Actions & Saved Views (client + server)

- Multi-select column in `DeviceTable`.
- Floating action bar appears when N > 0: Sync, Reboot, Retire (with batched confirmation and
  per-device progress reporting).
- Server-side `/api/actions/bulk` endpoint that loops with rate limiting, returns per-device
  results, and writes a single audit trail batch ID linking the entries.
- "Saved views" — store filter state in `user_view` table and surface in the sidebar under Triage.

### 5.4 — Mock Mode Honesty

- Top-level banner when `config.isGraphConfigured === false`: "Showing seeded mock data — not live."
- `/api/health` already exposes graph readiness; surface it via a `useGraphReadiness` hook and the
  banner consumes it.
- Sync page already protects against silent reseeds (Phase 3.5) — also expose the count delta in
  the sync log so it's visible.

### 5.5 — First-Run Experience

- If `tag_config` is empty AND no successful sync exists → render an Onboarding route at `/setup`.
- Steps: (1) confirm Graph credentials, (2) test connection (`/api/auth/graph-test`), (3) run first
  sync, (4) create one tag mapping, (5) finish.
- Each step is its own card with a clear pass/fail state. Skippable, but the dashboard reminds the
  user until configured.

### 5.6 — Polish carried over from this pass

- **Scroll restoration** on route navigation (TanStack Router scrollRestoration).
- **Density toggle** for the device queue (compact vs comfortable rows).
- **Per-row keyboard nav** in `DeviceTable` (j/k/Enter).
- **Profile drill-down** — click a profile to filter the device queue by that profile.

---

## Non-goals for Phase 5

- Multi-tenant. Single tenant only.
- RBAC beyond the existing delegated/non-delegated split.
- Mobile / responsive overhaul. Desktop-first stays.
- Writing back to Entra group membership or Autopilot records — read-only ingestion remains the
  contract; the only writes are remote actions via the documented Graph endpoints.

---

## Sequencing recommendation

1. **5.4 Mock Mode Honesty** — fastest, eliminates a category of confusion immediately.
2. **5.2 Drift Timeline** — highest engineering value, unblocks "what changed" investigations.
3. **5.1 Rule Engine v1** — biggest payoff for bespoke environments; do after history exists so
   rules can use historical context later.
4. **5.5 First-Run Experience** — once 5.1/5.4 are in, onboarding has something real to walk through.
5. **5.3 Bulk Actions** — last; depends on rate-limit work and adds audit complexity.

Polish items in 5.6 can be picked up opportunistically alongside any of the above.

---

## Risks & open questions

- **Graph throttling** during bulk actions — need a token-bucket or queue before 5.3.
- **History table growth** — likely fine for ~600 devices, but partition or compact older rows
  if it grows beyond expectations.
- **Rule DSL scope creep** — keep it small; resist Turing-completeness. The escape hatch for
  complex logic should be a real plugin, not more DSL.
- **Onboarding conflict with seed mode** — make sure `/setup` doesn't fight with the SEED_MODE
  guard added in the previous pass.
