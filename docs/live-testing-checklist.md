# Live Testing Checklist

Use this before connecting Runway to a real tenant. The goal is to prove the app can read safely, explain what it sees, and avoid surprise writes.

## 1. Local Workstation Preflight

- Confirm Node.js `24.14+` and npm `11+` are installed.
- Run `npm ci`.
- Run `npm run check`.
- Run `npm run build`.
- Confirm `.env` is not staged with `git status --short`.
- Set `SESSION_SECRET` to a long random value before live testing.
- Leave `APP_ACCESS_MODE=disabled` until Graph setup and first sync work.
- Use `SEED_MODE=none` when you want to verify only live tenant data.
- Keep `DATABASE_PATH` on an encrypted disk such as BitLocker-protected storage.

## 2. Entra App Registration

- Confirm the app registration tenant ID matches the tenant you will test.
- Confirm redirect URI is `http://localhost:3001/api/auth/callback`.
- Confirm the client secret is current and stored only in `.env`.
- Grant admin consent for the application permissions listed in `README.md`.
- Grant admin consent for delegated permissions if testing admin sign-in, LAPS, BitLocker, or remote actions.
- Confirm the account used for delegated testing has the Entra/Intune roles needed for the action being tested.

## 3. Intune / Autopilot Samples

Pick a small pilot set before syncing the full fleet:

- One healthy Autopilot device with an assigned profile.
- One device with an Autopilot record but no Intune enrollment yet.
- One Intune-managed device with a matching Entra device object.
- One known stale/orphaned device if available.
- One device with a known group tag and expected profile mapping.
- One device with a known mismatched tag/profile if available.
- One device with BitLocker recovery key available.
- One Windows LAPS-enabled device if delegated LAPS retrieval will be tested.

## 4. SCCM / ConfigMgr Signal

Runway does not connect directly to SCCM. It reads Intune's `managedDevice.managementAgent` value and marks devices that report a Configuration Manager client.

- In Settings, enable `SCCM / ConfigMgr Signal`.
- Pick one known co-managed or ConfigMgr-client device.
- Pick one Intune-only device.
- Confirm the device detail page shows the SCCM/ConfigMgr tag only for the device reporting a ConfigMgr management agent.
- Confirm there are no SCCM action buttons; this feature is visibility-only.

## 5. App Smoke Test

- Open the overview page and confirm dashboard counts load.
- Use master search to find a device by hostname, serial, Entra ID, and user where available.
- Open a device and confirm Graph, Intune, Entra, Autopilot, and SCCM badges match the expected source state.
- Open the playbooks for at least two flags and confirm they expand with useful next steps and portal/Graph references.
- Open Settings and confirm Graph configured status, app access status, admin sign-in, data sources, tag mapping, custom rules, and system health all load.
- Test admin sign-in with a delegated admin account.
- Test sign-out and verify privileged actions are disabled again.

## 6. Safe Action Validation

Do not start with destructive actions.

- Test a read-only flow first: dashboard, search, device detail, playbooks.
- Test delegated sign-in.
- Test LAPS or BitLocker retrieval only on a known lab device.
- Test sync on a single known device if available.
- Confirm action audit logs show who ran the action, when, target device, status, and error detail if any.
- Do not test wipe, retire, Autopilot reset, or bulk actions until the read-only and low-risk flows pass.

## 7. Go / No-Go

Ready for broader pilot when:

- `npm run check` and `npm run build` pass.
- Live sync completes without unexpected permission errors.
- Mock-only data is not mixed into the live database unless intentionally seeded.
- At least five known devices match expected Graph/Intune/Entra/SCCM state.
- App access gate has been enabled if non-admin technicians will open the app.
- Security review in `docs/security-report.md` has been accepted.
