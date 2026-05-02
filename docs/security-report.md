# Runway Security Report

This document is intended for internal approval before connecting Runway to live Microsoft Graph data.

## Executive Summary

Runway is a local-first Windows endpoint triage app. It reads Autopilot, Intune, Entra ID, and ConfigMgr/SCCM visibility signals through Microsoft Graph, stores results in a local SQLite database, and presents diagnostics to IT operators.

There is no Runway cloud service, no telemetry, no analytics, and no third-party data processor introduced by the app. Tenant credentials are supplied by the operator and remain on the local workstation.

## Data Processed

- Autopilot hardware identity, group tag, assigned profile, and assigned user fields.
- Intune managed-device identity, compliance, enrollment, owner/user, management agent, and action status fields.
- Entra device identity and group membership data needed to explain targeting.
- ConfigMgr/SCCM visibility derived from Intune's `managedDevice.managementAgent` field.
- Optional BitLocker and Windows LAPS secrets when requested by a delegated admin.
- Local action audit entries for operations initiated from Runway.

## Credential Model

- The shipped installer does not include Graph credentials.
- Operators configure their own Entra app registration.
- App-only client credentials are stored in `.env` on the operator workstation.
- Delegated admin sign-in uses Microsoft identity endpoints and a signed local session cookie.
- `SESSION_SECRET` is auto-generated as a 256-bit random value and persisted to `.env` (mode 0600) on first run if not already present. The server refuses to start in non-dev mode with the built-in default.
- The first-run Graph wizard rejects client secrets shorter than 32 characters or matching common placeholder strings.
- The app access gate requires Entra sign-in before fleet data is visible once Graph is configured, unless explicitly disabled for local/dev use.

## Network Model

Runway is designed to bind its local API to loopback. Expected external calls are:

- `login.microsoftonline.com` for Microsoft authentication.
- `graph.microsoft.com` for Microsoft Graph reads and delegated actions.

Every `/api/*` route is gated by a local-access middleware that admits a request only when one of the following is true: the request carries the per-install desktop token issued by the Tauri shell, a valid delegated admin session, or a valid Entra app-access session. Mutating methods (POST/PUT/PATCH/DELETE) additionally require an allowed `Origin` (loopback or `tauri://`) so a stray browser tab on the same workstation cannot pivot off the operator's cookies. The `/api/actions/*` subtree is further protected by a per-user token-bucket rate limit (burst 30, sustained 1/s) so a runaway client cannot burn Graph quota.

The Tauri desktop shell loads the local app runtime and uses limited window controls for the custom title bar.

## Write / Action Safety

- Read-only sync is app-only and separate from delegated admin actions.
- Remote actions require delegated sign-in.
- Bulk actions are capped at 200 devices per request and limited to non-destructive or fully reversible operations (`sync`, `reboot`, `rotate-laps`). Retire, wipe, Autopilot reset, rename, change primary user, and the `delete-*` cleanups remain single-device clicks. All actions are audited.
- Destructive actions require typed confirmation. The confirmation step is always enforced — there is no toggle to disable it.
- Idempotency keys on destructive actions: client-generated UUIDs are accepted as `Idempotency-Key` and a duplicate within 24h replays the cached Graph result rather than re-dispatching.
- Change Primary User uses an EntityPicker that resolves Entra users by display name, UPN, or mail to a Graph user ID, removing the need for admins to handle raw GUIDs.
- Dangerous operations should be validated only on lab devices before production use.
- LAPS passwords are fetched on demand, auto-hide in the UI, and are not persisted to disk.
- SCCM / ConfigMgr support is visibility-only and Graph-derived. Runway does not store SCCM credentials, connect to a Configuration Manager site server, or execute SCCM actions.

## Local Storage

- SQLite database: device state, raw source snapshots (including
  Autopilot, Intune, Entra, and Graph assignment data), history, app
  settings, custom rules, saved views, and audit logs. Schema migrations
  and retention sweeps take a checkpoint-then-copy snapshot into
  `<db-dir>/snapshots/`; the most recent three per reason are retained.
- `.env`: tenant/app IDs, client secret, session secret, and runtime configuration.
- Logs: local server/runtime logs only, exposed in-app via the Recent
  Logs panel and `GET /api/health/logs` for ops investigations.

Recommended controls:

- Store the app and database on BitLocker-protected storage.
- Restrict workstation access to approved IT operators.
- Rotate the Graph client secret on the same cadence as other internal app secrets.
- Do not commit `.env`, SQLite files, logs, build outputs, or local app data.

## Permission Review

Application permissions are used for read-only ingestion. All five are
required for the sync to populate the local database:

| Permission | Why Runway needs it |
| --- | --- |
| `DeviceManagementServiceConfig.Read.All` | Autopilot deployment profiles + assignments. |
| `DeviceManagementManagedDevices.Read.All` | Intune managed devices, including `managementAgent` for ConfigMgr presence. |
| `DeviceManagementConfiguration.Read.All` | Configuration profile + compliance + app assignments backing Build Payload. |
| `Device.Read.All` | Entra device objects for cross-system identity correlation. |
| `Group.Read.All` | Entra groups + memberships for targeting. |

Delegated permissions gate the privileged operator flows. Grant only the
scopes you'll actually use during the pilot — optional scopes can be
added later and Runway surfaces a clear permission error when an action
lacks its scope:

| Permission | Powers | Required? |
| --- | --- | --- |
| `User.Read` | Stamps Action Audit `triggeredBy`. | Required for any delegated flow. |
| `DeviceManagementManagedDevices.ReadWrite.All` | Sync, reboot, rename, rotate LAPS, change primary user. | Required if any remote action will run. |
| `DeviceManagementManagedDevices.PrivilegedOperations.All` | Retire, wipe, Autopilot reset. | Optional — skip if destructive actions are deferred. |
| `User.ReadBasic.All` | Change Primary User EntityPicker (search by display name / UPN / mail). | Optional. |
| `DeviceLocalCredential.Read.All` | Windows LAPS password retrieval. | Optional. |
| `BitLockerKey.Read.All` | BitLocker recovery key retrieval. | Optional. |
| `Group.ReadWrite.All` | Add / remove device from Entra group during remediation. | Optional. |
| `DeviceManagementServiceConfig.ReadWrite.All` | Autopilot hardware-hash import. | Optional. |

The first soak should run with the required scopes only; layer optional
scopes in once the read paths are clean.

## Known Risks And Mitigations

- Local workstation compromise can expose `.env` and SQLite data. Mitigate with BitLocker, endpoint protection, least-privilege operator access, and secret rotation.
- The current confidential-client delegated flow is acceptable for a controlled internal pilot but should migrate to a PKCE public-client model before broader distribution. Certificate-based confidential auth (`AZURE_CLIENT_CERT_PATH` + `AZURE_CLIENT_CERT_THUMBPRINT`) is supported and preferred over `AZURE_CLIENT_SECRET` because it removes the rotating string from disk.
- `npm audit` reports a moderate transitive `uuid` advisory through `@azure/msal-node`; no upstream fix is currently available. Monitor and upgrade MSAL when patched.
- Live Graph permissions are powerful. Start with read-only validation, then approve privileged delegated flows separately.
- The SCCM signal proves only what Intune/Graph reports via `managementAgent`; it does not prove SCCM site assignment, policy retrieval, inventory freshness, or client health.

## Approval Checklist

- Security owner reviewed app-only and delegated permission lists.
- Entra app registration ownership and secret rotation owner assigned.
- Pilot operator workstation has disk encryption enabled.
- `SESSION_SECRET` confirmed present in the runtime `.env` (auto-generated on first run, but verify it has not been deleted).
- `APP_ACCESS_MODE=entra` plan approved for technician access.
- Live testing checklist completed on a small known device set.
- Destructive actions are restricted until lab-device validation passes.
