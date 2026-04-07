# Contributing to PilotCheck

Thanks for being here. PilotCheck is an opinionated tool built for a
specific operational reality, so the bar for new features is "does this make
a real on-call shift better". Bug fixes, docs, and rough edges are always
welcome.

## Development

```bash
git clone https://github.com/giftedloser/PilotCheck.git
cd PilotCheck
npm install
npm run db:migrate
npm run db:seed:mock
npm run dev
```

You'll need:

- Node.js **24.14+** (see `engines` in `package.json`)
- npm **11+**
- A C toolchain available for the `better-sqlite3` native build
  - Windows: Visual Studio Build Tools with the "Desktop development with C++" workload
  - macOS: `xcode-select --install`
  - Linux: `build-essential` + `python3`

## Day-to-day

- `npm run dev` — client + server with hot reload
- `npm run check` — lint + tests (run before pushing)
- `npm run test` — unit + api projects only
- `npm run test:e2e` — full end-to-end suite (slower)

## Conventions

- **TypeScript everywhere**, no `any` unless interfacing with an untyped lib.
  Prefer narrow types and discriminated unions.
- **Server queries are pure SQL** in `src/server/db/queries/`. Routes are
  thin shells over them.
- **The engine is a pure function** — no I/O during evaluation. If you need
  to read from the database, do it in a query and pass the result in.
- **URL-as-state** — page filters that should survive a refresh live in
  TanStack Router search params, not local state.
- **Tailwind v4 + design tokens** — use the `--pc-*` CSS custom properties
  in `src/client/styles/globals.css`. Don't hard-code colors.
- **No third-party toast / modal libraries** — there is a context-based
  toast hub at `src/client/components/shared/toast.tsx`. Use it.
- **Commit messages** follow Conventional Commits where it helps:
  `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`.

## Adding a built-in flag

1. Add the new code to the `FlagCode` union in `src/shared/types.ts`.
2. Add the human-readable metadata (title, summary, why-it-matters,
   checks) in the engine's flag table.
3. Implement the rule in `src/server/engine/`.
4. Categorise it into one of the four breakpoint buckets in
   `src/client/routes/DeviceDetail.tsx` (`BREAKPOINT_BUCKETS`).
5. Add an icon mapping in `src/client/components/devices/FlagBadge.tsx` if
   appropriate.
6. Document it in `docs/engine.md`.
7. Add a unit test in `test/unit/engine/` covering both the firing and
   non-firing case.

## Pull requests

- Keep PRs focused. One feature or one bug fix per PR.
- Update tests for any behaviour change.
- Update `docs/` if you change a flag, an env var, a permission, or the
  schema.
- Add a `CHANGELOG.md` entry under `## Unreleased`.

## Reporting bugs

Please include:

- PilotCheck version (or commit hash)
- Node version
- OS
- Whether you're in mock mode or live Graph mode
- Steps to reproduce
- The relevant `pino` log output if the issue is server-side

For security issues, see [SECURITY.md](./SECURITY.md) — please **do not**
file a public issue.
