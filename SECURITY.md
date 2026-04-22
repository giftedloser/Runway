# Security Policy

## Reporting a vulnerability

If you discover a security issue in Runway, **please do not file a
public GitHub issue**. Instead, open a [private security advisory](https://github.com/giftedloser/PilotCheck/security/advisories/new)
on the repository, or email the maintainers directly.

Please include:

- A description of the issue and its impact
- Steps to reproduce, or a proof-of-concept
- The Runway version (or commit hash) you tested against
- Any suggested mitigation

We'll acknowledge receipt within a few days, work with you on a fix, and
credit you in the release notes if you'd like.

## Deployment model

Runway is **self-hosted, bring-your-own-Entra-app-registration**. The
shipped installer does not contain Microsoft Graph credentials. On first
run the operator registers Runway as an application in their own Entra
tenant, generates a client secret (or uploads a certificate), and places
the tenant ID / client ID / secret into the per-user app data `.env` at
`%LOCALAPPDATA%\com.giftedloser.pilotcheck\.env`.

The credentials never leave that machine except to talk to
`login.microsoftonline.com` and `graph.microsoft.com`. They are never
logged, never bundled into `dist/`, and never checked into git.

See [`docs/graph-auth.md`](docs/graph-auth.md) for the full rationale,
the alternatives considered, and the planned migration to a public-client
PKCE model in a later milestone.

## Scope

Runway is local-first — there is no Runway cloud service to attack.
The relevant trust boundaries are:

- **The local SQLite database**, which contains device state and action
  logs. Treat the file as sensitive and store it on an encrypted disk.
- **The Express API** bound to localhost. By default it does not listen on
  external interfaces, but a misconfigured reverse proxy could expose it.
- **First-run Graph bootstrap**, which is only accepted when the server is
  bound to loopback and the request also originates from a loopback
  address. Non-local deployments must provision Graph credentials through
  `.env` instead of the setup form.
- **Microsoft Graph credentials** in the per-user app data `.env`. The
  client secret lives only on the operator's machine. Rotate it on the
  same cadence as any other production secret. Use Windows DPAPI or
  BitLocker at rest — Runway itself does not encrypt `.env`.
- **The delegated session cookie**, signed with `SESSION_SECRET`. Set this
  to a long random string before shipping. `src/server/config.ts` refuses
  to start outside `NODE_ENV=development`/`test` if the built-in default
  session secret is still in use.
- **The optional app access gate**, controlled by `APP_ACCESS_MODE=entra`,
  requires an Entra sign-in before operators can view fleet data. Keep it
  disabled during first-run setup, then enable it before broader pilot use.
- **The Tauri desktop shell**, which loads the local web runtime only and
  grants a narrow window-control capability for the custom title bar.
- **SCCM / ConfigMgr visibility**, which is read-only and derived from
  Intune's `managementAgent` value. Runway does not store SCCM credentials
  and does not execute SCCM actions.

## Current known advisories

`npm audit` currently reports a moderate advisory in the transitive
`uuid` dependency pulled through `@azure/msal-node`. There is no upstream
fix available in the current dependency tree. Track the advisory and bump
MSAL as soon as Microsoft publishes a patched release.

## Out of scope

- Vulnerabilities in upstream dependencies — please report those to the
  upstream project. We'll bump as soon as a fix is published.
- Issues that require an attacker to already have local OS access on the
  operator's machine. A compromised operator workstation can read the
  `.env`; that is a known consequence of the self-hosted model and is
  addressed by the operator's endpoint protection, not by Runway.
- The pilot-only choice to use a local confidential-client secret for the
  current delegated flow. This is documented architectural debt until the
  planned PKCE public-client migration lands.
- Mock mode behaviour — mock mode is for development and demos only and
  intentionally accepts non-production shortcuts.
