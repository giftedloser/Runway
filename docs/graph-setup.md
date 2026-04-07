# Microsoft Graph Setup

PilotCheck talks to Graph in two distinct modes:

- **App-only** — used by the background sync to read Autopilot, Intune, and
  Entra resources. Runs unattended.
- **Delegated** — used for remote actions (sync, reboot, rotate LAPS, etc.)
  and for retrieving LAPS passwords. Requires an interactive admin sign-in.

Both flows share a single Entra app registration.

## 1. Create the app registration

In the Entra admin centre:

1. **Identity → Applications → App registrations → New registration**
2. Name it `PilotCheck` (or whatever you like).
3. Supported account types: **Single tenant**.
4. Redirect URI: `Web` → `http://localhost:3001/api/auth/callback`
5. Click **Register**.

Copy the **Application (client) ID** and **Directory (tenant) ID** from the
overview page into your `.env`:

```ini
AZURE_TENANT_ID=<directory id>
AZURE_CLIENT_ID=<application id>
```

## 2. Create a client secret

1. **Certificates & secrets → Client secrets → New client secret**
2. Description: `PilotCheck server`
3. Expires: pick a policy that matches your tenant's rotation rules.
4. Copy the **Value** immediately into your `.env`:

```ini
AZURE_CLIENT_SECRET=<value>
```

> The secret value is only visible once. If you lose it, generate a new one.

## 3. Grant API permissions

Under **API permissions → Add a permission → Microsoft Graph**:

### Application permissions (for sync)

- `DeviceManagementServiceConfig.Read.All`
- `DeviceManagementManagedDevices.Read.All`
- `DeviceManagementConfiguration.Read.All`
- `Device.Read.All`
- `Group.Read.All`

### Delegated permissions (for actions + LAPS)

- `DeviceManagementManagedDevices.ReadWrite.All`
- `DeviceManagementManagedDevices.PrivilegedOperations.All`
- `DeviceLocalCredential.Read.All`
- `User.Read` (default)

Then click **Grant admin consent for &lt;tenant&gt;**. Both columns should
turn green.

## 4. Verify

Restart the PilotCheck server. The **Settings → Microsoft Graph
Integration** card should now show three green check marks for
`AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, and `AZURE_CLIENT_SECRET`.

Trigger a sync from **Sync → Run sync now** (or wait for the next interval).
Successful sync rows will appear in the timeline; failures will surface
their Graph error in an expandable details element.

## Troubleshooting

| Symptom                                              | Likely cause                                                                       |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Sync fails with `AADSTS700016`                       | Wrong tenant ID, or app deleted                                                    |
| Sync fails with `Authorization_RequestDenied`        | App permissions not granted, or admin consent not clicked                          |
| Sync succeeds but device count is 0                  | App permissions are *delegated* not *application* — re-add as **Application**      |
| Sign-in succeeds but actions return 403              | Delegated `*.PrivilegedOperations.All` not granted, or signed-in user is not admin |
| LAPS reveal returns 404                              | `DeviceLocalCredential.Read.All` not granted                                       |
| Sign-in loop                                         | Redirect URI in app registration does not exactly match `AZURE_REDIRECT_URI`       |
