# PilotCheck

PilotCheck is a local-first diagnostic state engine for Windows Autopilot, Intune, and Entra ID. It correlates device identities across Microsoft systems, computes provisioning health, and presents problem-first diagnostics through a React SPA and Express API backed by SQLite.

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4 with shadcn-style primitives
- TanStack Query + TanStack Router
- Express + better-sqlite3
- MSAL Node for Microsoft Graph app-only authentication

## Local Development

```bash
npm install
npm run dev
```

The client runs on `http://localhost:5173` and the API runs on `http://localhost:3001`.

## Database

```bash
npm run db:migrate
npm run db:seed:mock
```

If Graph environment variables are not configured and the database is empty, PilotCheck seeds realistic mock data automatically on startup.
