# Runway Security Report

This document is intended for internal approval before connecting Runway to live Microsoft Graph data.

## Executive Summary

Runway is a local-first Windows endpoint triage app. It reads Autopilot, Intune, Entra ID, and ConfigMgr/SCCM management-agent signals through Microsoft Graph, stores results in a local SQLite database, and presents diagnostics to IT operators.

There is no Runway cloud service, no telemetry, no analytics, and no third-party data processor introduced by the app. Tenant credentials are supplied by the operator and remain on the local workstation.

## Data Processed

- Autopilot hardware identity, group tag, assigned profile, and assigned user fields.
- Intune managed-device identity, compliance, enrollment, owner/user, management agent, and action status fields.
- Entra device identity and group membership data needed to explain targeting.
- Optional BitLocker and Windows LAPS secrets when requested by a delegated admin.
- Local action audit entries for operations initiated from Runway.

## Credential Model

- The shipped installer does not include Graph credentials.
- Operators configure their own Entra app registration.
- App-only client credentials are stored in `.env` on the operator workstation.
- Delegated admin sign-in uses Microsoft identity endpoints and a signed local session cookie.
- `SESSION_SECRET` must be replaced before live testing; the server refuses to start in non-dev mode with the built-in default.
- The optional app access gate can require Entra sign-in before fleet data is visible.

## Network Model

Runway is designed to bind its local API to loopback. Expected external calls are:

- `login.microsoftonline.com` for Microsoft authentication.
- `graph.microsoft.com` for Microsoft Graph reads and delegated actions.

The Tauri desktop shell loads the local app runtime and uses limited window controls for the custom title bar.

## Write / Action Safety

- Read-only sync is app-only and separate from delegated admin actions.
- Remote actions require delegated sign-in.
- Bulk actions are capped and audited.
- Dangerous operations should be validated only on lab devices before production use.
- LAPS passwords are fetched on demand, auto-hide in the UI, and are not persisted to disk.
- SCCM / ConfigMgr support is visibility-only; Runway does not store SCCM credentials and does not execute SCCM actions.

## Local Storage

- SQLite database: device state, raw source snapshots, history, settings, and audit logs.
- `.env`: tenant/app IDs, client secret, session secret, and runtime configuration.
- Logs: local server/runtime logs only.

Recommended controls:

- Store the app and database on BitLocker-protected storage.
- Restrict workstation access to approved IT operators.
- Rotate the Graph client secret on the same cadence as other internal app secrets.
- Do not commit `.env`, SQLite files, logs, build outputs, or local app data.

## Permission Review

Application permissions are used for read-only ingestion:

- `DeviceManagementServiceConfig.Read.All`
- `DeviceManagementManagedDevices.Read.All`
- `DeviceManagementConfiguration.Read.All`
- `Device.Read.All`
- `Group.Read.All`

Delegated permissions are used for privileged operator flows:

- `DeviceManagementManagedDevices.ReadWrite.All`
- `DeviceManagementManagedDevices.PrivilegedOperations.All`
- `DeviceLocalCredential.Read.All`
- `BitLockerKey.Read.All`
- `Group.ReadWrite.All`
- `DeviceManagementServiceConfig.ReadWrite.All`
- `User.Read`

Only grant delegated permissions if those flows are approved for the pilot.

## Known Risks And Mitigations

- Local workstation compromise can expose `.env` and SQLite data. Mitigate with BitLocker, endpoint protection, least-privilege operator access, and secret rotation.
- The current confidential-client delegated flow is acceptable for a controlled internal pilot but should migrate to a PKCE public-client model before broader distribution.
- `npm audit` reports a moderate transitive `uuid` advisory through `@azure/msal-node`; no upstream fix is currently available. Monitor and upgrade MSAL when patched.
- Live Graph permissions are powerful. Start with read-only validation, then approve privileged delegated flows separately.

## Approval Checklist

- Security owner reviewed app-only and delegated permission lists.
- Entra app registration ownership and secret rotation owner assigned.
- Pilot operator workstation has disk encryption enabled.
- `SESSION_SECRET` changed from default.
- `APP_ACCESS_MODE=entra` plan approved for technician access.
- Live testing checklist completed on a small known device set.
- Destructive actions are restricted until lab-device validation passes.
