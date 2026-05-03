# Live-Tenant Dry-Run Runbook

A practical, step-by-step playbook for the first time you point Runway at a
real tenant. Use this alongside (not instead of)
[`docs/live-testing-checklist.md`](./live-testing-checklist.md), which is
the preflight; this doc is what you actually do during the soak.

The first soak is **read-and-look-only**. Destructive remote actions stay
deferred until the read paths are clean.

---

## 0. Prerequisites

- Windows 11 / 10 workstation, BitLocker-protected disk.
- Either a packaged Tauri build of Runway or a `npm run dev` checkout on a
  branch matching the deploy target.
- Microsoft Edge or Chrome installed (portal deep links open in the
  default browser).
- Workstation clock within ±5 minutes of correct UTC (Graph rejects
  drifted requests).
- An Entra app registration in the target tenant with the application
  permissions listed in `README.md` granted admin consent.
- A delegated admin account with the Intune / Entra roles for the
  delegated permissions, also consented. Identify which delegated
  permissions you actually need before granting the optional ones — see
  the **Required Graph permissions** table in [`README.md`](../README.md).
- A short list of **known test devices** in the tenant: one healthy
  Autopilot device, one Intune-only device, one device with a known
  problem (mismatched tag, missing profile, stalled provisioning, etc.),
  and one device with a Windows LAPS / BitLocker secret stored if you
  intend to verify retrieval.
- A separate workstation or browser tab logged into the Intune admin
  centre and Entra admin centre so you can cross-check what Runway shows.

---

## 1. Connect the tenant

1. Launch Runway. The first-run banner reads "Connect your tenant and run
   an initial sync to get started."
2. Open `/setup` from the sidebar (or click the banner's **Go to setup**
   button).
3. **Step 1 — Connect Entra tenant.** Paste the tenant ID, client ID, and
   either client secret (≥32 chars) or certificate path/thumbprint. The
   wizard rejects placeholder values.
4. After credentials save, **close and re-open Runway** (or restart the
   `npm run dev` process). Credentials are written to the per-user `.env`
   and only loaded at boot.
5. Sign in as the delegated admin via the sidebar **Admin sign-in**
   button. The sign-out control appears in the same place once your
   session is active.

**Stop and check**: settings page should now show three green check marks
for `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, and `AZURE_CLIENT_SECRET` (or
the cert equivalents). The sync status pill at the top should read
`Never synced`.

---

## 2. First sync

1. Click the sync status pill → **Run sync**, or use `/setup` step 2's
   **Run initial sync** button.
2. The pill shows `Syncing…` while the run is in flight. Expect:
   - 30 s – 2 min for ≤1,000 devices.
   - 2 – 5 min for 1,000 – 5,000 devices.
   - Larger fleets are out of Runway's intended fleet band.
3. When the pill flips to `Synced X ago`, open the **Sync** page and
   confirm device counts match what you'd expect from Intune. If the
   sync fails, the pill goes red — click it to read the exact error.
4. Open `/setup` step 2: it should now read "Permissions verified and
   device data imported".
5. Step 3 prompts for the first tag mapping. **Skip this for the soak**
   unless you already know the property/tag mapping you want to enforce.
   You can add mappings later from the **Tags** view.

**Stop and check**: device counts in the Sync page match the tenant.
**Action Audit** is empty. **Recent Logs** has no warn/error rows.

---

## 3. Verify read-only browsing is safe

Walk through Runway in this order, **without clicking any action**:

1. **Overview** — totals, problem-area buckets, 14-day trend, recent
   transitions. Numbers should look plausible against your operational
   awareness of the tenant.
2. **Devices** — set the page size, filter by health/critical, sort by
   property. Confirm pagination, search, and saved-view presets work.
3. Open one **device detail** for each of:
   - A known healthy device.
   - A known unhealthy device.
   - The thinnest record you can find (orphaned Autopilot, Entra-only
     device, etc.) — this is your typed-confirmation fallback test
     target later.
4. On each device detail, click through the tabs (Identity, Targeting,
   Enrollment, Drift, Operate, History) and confirm panels render
   without errors. Use the `?tab=` deep link to reload the page on
   the same tab.
5. **Tags** — confirm discovered tags match what you see on Autopilot
   group tags. Open the side drawer for one tag (do **not** save).
6. **Provisioning** — pick a configured tag, select a target group, read
   the Build Payload panel. Verify each availability state if you can
   create one (no group selected, after a failed sync, on a freshly
   synced tag).
7. **Groups** and **Profiles** — spot-check membership and assignment
   counts against the Intune / Entra portals.

**Stop and check**: nothing has been written to the tenant. **Action
Audit** is still empty.

---

## 4. First safe action

Pick one healthy known device. Run **Sync Now** (the lowest-risk action)
on it.

1. Open the device detail → **Operate** tab.
2. Click **Sync Now**.
3. Read the toast: success/failure and a link to Action Audit.
4. Open **Action Audit**. Confirm the row shows your admin UPN, the
   target device serial, the action type `sync`, the Graph response
   status (`200` or `202`), and a timestamp.
5. Wait ~5 minutes for the device to actually check in.
6. Refresh device detail; **Last Intune check-in** should be more
   recent than before.

If any of the above is wrong, **stop here** and capture logs (see §9).

---

## 5. Verify portal deep links

For one device:

1. Open the device's **Identity** tab. Click each of:
   - **Open in Intune** — should land on the Intune managed device
     blade for the same Intune ID.
   - **Open in Entra** — should land on the Entra device object blade.
   - **Open in Autopilot** — should land on the Windows Autopilot
     device blade.
2. Confirm the IDs match. If a portal opens to a generic page or 404s,
   note the device key and capture the URL Runway generated.

---

## 6. EntityPicker dry run (no commit)

The Change Primary User flow uses an EntityPicker that resolves Entra
users by display name, UPN, or mail. Verify search without committing:

1. Open a device's **Operate** tab → **Change Primary User**.
2. Type the first three letters of a known admin's display name. Wait
   for results.
3. Type a partial UPN (e.g. `admin@`). Confirm matches appear.
4. Type a partial mail address. Confirm matches appear.
5. Click **Cancel**. Do **not** click **Confirm**.
6. Open Action Audit; the picker dry-run should not have logged
   anything.

---

## 7. LAPS / BitLocker (lab device only)

Only run this against a lab device with a backed-up secret/key. Skip if
you don't have a confirmed lab target.

1. Device detail → **Operate** tab → **LAPS** panel → **Reveal**.
2. Confirm the password appears, copy works, and the password
   auto-rehides at 30 s.
3. Same drill for BitLocker (60 s rehide).
4. Open Action Audit; both retrievals should appear with your admin UPN
   and Graph response 200.

If either fails with 403, the delegated permissions are missing. If they
fail with 404, the secret/key isn't backed up to the tenant. Note which
and stop.

---

## 8. Destructive actions — DEFERRED

Do **not** run any of these during the first soak:

- Reboot.
- Rename.
- Autopilot Reset.
- Retire.
- Factory Wipe.
- Delete from Intune.
- Delete from Autopilot.
- Bulk anything (sync, reboot, rotate-laps).

Visually confirm the destructive buttons in the Operate tab show the
critical-color left border at rest and a danger-coloured focus ring on
keyboard navigation. Hover briefly to confirm the typed-confirmation
modal opens — then **cancel without typing**. The confirmation should
require you to type the device's serial number (or device name / Intune
ID / Autopilot ID, in that fallback order). If a device has none of
those, the destructive flow refuses to render — that's the
unidentifiable-record guard.

A second soak — once the first read-only soak is signed off — runs the
single-device destructive set on a lab device only.

---

## 9. Inspect logs

Three places to look while the soak is running:

1. **Sync page** — per-resource sync status and the most recent error
   message. The pill mirrors this.
2. **Settings → Recent Logs** — the in-app pino ring buffer. Filter to
   `warn` or `error`. Sensitive headers and any redacted body fields
   show as `[redacted]`.
3. **Action Audit** — every action attempt with operator, target,
   Graph status, and idempotency key. Export to CSV from this page;
   the export prevents formula injection automatically.

For deeper inspection:

```
GET /api/health/logs?level=warn&limit=200
```

requires admin sign-in.

---

## 10. Disconnect or rotate credentials

If you need to back the tenant out without losing local data:

- Settings → **Graph Integration** → **Rotate credentials** to swap to
  a different app registration (admin sign-in required).
- Or set `APP_ACCESS_MODE=disabled` in `.env` and restart, which keeps
  the local database for offline review but blocks Graph from being
  hit.
- Or close Runway and back up `data/` (SQLite) plus
  `%LOCALAPPDATA%\com.giftedloser.pilotcheck\.env` before deleting them
  to fully reset.

The desktop token is per-launch and never persisted to disk; closing
Runway invalidates it.

---

## 11. Capture during the soak

Note these so the second soak (or a regression review) has the data:

- Start and end timestamp of the soak.
- Sync duration on the first run.
- Total device count Runway reports vs the tenant's Intune count.
- Distribution of healthy / warning / critical / info / unknown.
- Any flag that appeared more often than expected — was it a real
  pattern, or a Runway misclassification?
- Any 4xx / 5xx Graph status seen in Action Audit or Sync page.
- Any UI stall longer than ~1 second on a page transition or a panel
  load.
- Any portal deep link that landed on the wrong page.
- Any panel that showed "no data" when you expected data, with the
  device key noted.
- Anything Runway said in copy that read wrong, vague, or scary.

Hand the notes to whoever's reviewing.

---

## What signals a clean dry-run

- Sync pill is green and recent the whole time.
- Action Audit only contains the safe sync action you intentionally ran.
- Recent Logs has no warn/error rows that you didn't expect (the boot
  pino-pretty notes are fine).
- Device counts and health distribution roughly match operational
  awareness.
- Three known portal links worked.
- LAPS / BitLocker retrieval (if tested) auto-rehid as documented.
- No destructive button was clicked.
- Soak notes (§11) read as boring.

If any of those go sideways, **stop the soak** and capture state before
investigating. Resume on a clean session.
