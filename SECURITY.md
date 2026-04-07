# Security Policy

## Reporting a vulnerability

If you discover a security issue in PilotCheck, **please do not file a
public GitHub issue**. Instead, open a [private security advisory](https://github.com/giftedloser/PilotCheck/security/advisories/new)
on the repository, or email the maintainers directly.

Please include:

- A description of the issue and its impact
- Steps to reproduce, or a proof-of-concept
- The PilotCheck version (or commit hash) you tested against
- Any suggested mitigation

We'll acknowledge receipt within a few days, work with you on a fix, and
credit you in the release notes if you'd like.

## Scope

PilotCheck is local-first — there is no PilotCheck cloud service to attack.
The relevant trust boundaries are:

- **The local SQLite database**, which contains device state, action logs,
  and any LAPS passwords retrieved during a session. Treat the file as
  sensitive and store it on an encrypted disk.
- **The Express API** bound to localhost. By default it does not listen on
  external interfaces, but a misconfigured reverse proxy could expose it.
- **Microsoft Graph credentials** in `.env`. The client secret should be
  rotated on the same cadence as any other production secret.
- **The delegated session cookie**, signed with `SESSION_SECRET`. Set this
  to a long random string in production.

## Out of scope

- Vulnerabilities in upstream dependencies — please report those to the
  upstream project. We'll bump as soon as a fix is published.
- Issues that require an attacker to already have local OS access on the
  operator's machine.
- Mock mode behaviour — mock mode is for development and demos only and
  intentionally accepts non-production shortcuts.
