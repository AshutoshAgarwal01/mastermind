# Local Development Guide

> How to get **Mastermind Online** (this npm-workspaces monorepo: `packages/shared`,
> `apps/server`, `apps/web`) running on your own machine, both in dev mode and as a production
> build. See [project-status.md](./project-status.md) for the full architecture/status reference,
> [deployment.md](./deployment.md) for hosting this on Azure, and
> [telemetry.md](./telemetry.md) for the optional Application Insights wiring.

## Prerequisites

- **Node.js 20+** (LTS). This repo has been developed against Node 24.19.0 (installed via
  `winget install OpenJS.NodeJS.LTS --scope user` on Windows) and CI runs Node 22 — anything
  20+ should work.
- **Git**.
- No database/Redis needed — all game state is in-memory in the server process.

**Windows note:** if `node`/`npm`/`git` aren't recognized in a fresh terminal, they may not be on
`PATH`. If installed via winget, the Node binary typically lives under:
```powershell
$nodeDir = 'C:\Users\<you>\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.19.0-win-x64'
$env:PATH = "$nodeDir;$env:PATH"
```
Git usually needs `C:\Program Files\Git\cmd` prepended the same way. Do this once per fresh
terminal session (or add permanently via System Properties → Environment Variables).

## Install

From the **repo root** (npm workspaces link `apps/*` and `packages/*` together — never `cd` into
a workspace and run `npm install` there):
```powershell
npm install
```

## Running in dev mode

Two dev servers run side by side — a Vite dev server for the React client (with HMR) and a
`tsx watch` process for the Fastify/Socket.IO server (auto-restarts on file changes). Run each in
its own terminal, from the repo root:
```powershell
npm run dev:server   # Fastify + Socket.IO, http://localhost:8080 (health check: /health)
npm run dev:web      # Vite dev server, http://localhost:5173
```
Open `http://localhost:5173` in a browser. The client's socket connection defaults to
`http://localhost:8080` in dev (see `apps/web/src/state/socketClient.ts`), so both must be running.

Per-workspace equivalents also work if you prefer, e.g. `npm run dev --workspace apps/server`.

To test on a phone/another device on the same network, expose the Vite server:
```powershell
npm run dev:web -- --host
```
then load the printed LAN URL on the other device (you'll also need `apps/server` reachable at
that machine's IP — see `VITE_SERVER_URL` below).

## Running a production build locally

This mirrors exactly how it runs on Azure App Service: the Fastify server builds and serves the
compiled React app itself (same origin, no separate Vite server, no CORS needed).

1. Build everything (in order: `packages/shared` → `apps/web` → `apps/server`):
   ```powershell
   npm run build
   ```
2. Run the server with `NODE_ENV=production` so it serves `apps/web/dist` and falls back to
   `index.html` for client-side routing:
   ```powershell
   $env:NODE_ENV = 'production'
   node apps/server/dist/index.js
   ```
3. Open `http://localhost:8080` (the port `PORT` defaults to — see env vars below).

`apps/web` also has its own `npm run preview` (plain `vite preview`, serving only the built static
assets on a separate port) — useful for a quick visual check of the build output, but the socket
client will still try to reach `window.location.origin` in that mode, so it won't have a working
API/Socket.IO backend unless you also set `VITE_SERVER_URL` to point at a running
`apps/server` instance before building.

## Environment variables

All are optional — sensible defaults exist for local dev.

| Variable | Used by | Default | Purpose |
| --- | --- | --- | --- |
| `PORT` | server | `8080` | Fastify/Socket.IO listen port |
| `HOST` | server | `0.0.0.0` | Fastify listen host |
| `NODE_ENV` | server | unset (dev) | Set to `production` to serve the built `apps/web/dist` + SPA fallback |
| `CORS_ORIGIN` | server | `*` (any origin) | Restrict allowed origins for the dev-mode split (client and server on different ports/domains) |
| `VITE_SERVER_URL` | web (build-time) | `http://localhost:8080` in dev, same-origin in prod builds | Override where the client connects its Socket.IO client — needed only for split hosting or LAN/phone testing |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | server | unset (telemetry no-ops) | Enables server-side Application Insights events — see [telemetry.md](./telemetry.md) |
| `VITE_APPINSIGHTS_CONNECTION_STRING` | web (build-time) | unset (telemetry no-ops) | Enables client-side Application Insights events, baked in at `npm run build` time |

Set them ad hoc in PowerShell before a command, e.g. `$env:PORT = 9000; npm run dev:server`, or
`$env:NODE_ENV = 'production'; node apps/server/dist/index.js`.

### Local secrets via `.env.local` files (git-ignored)

For values you don't want to type into a terminal every time (like the Application Insights
connection string), use a local `.env.local` file instead — both are git-ignored (see root
`.gitignore`), so they never get committed. Same filename on both sides for consistency, even
though only the client's is a Vite built-in convention (the server's is just a path we chose
ourselves when wiring up `dotenv`):

- **Server:** copy `apps/server/.env.local.example` to `apps/server/.env.local` and fill in the
  value(s). Loaded automatically via `dotenv` from `apps/server/src/telemetry.ts` — no other setup
  needed, it's a no-op if the file doesn't exist.
- **Client:** copy `apps/web/.env.local.example` to `apps/web/.env.local` and fill in the
  value(s). Vite loads `.env.local` automatically; restart `npm run dev:web` after adding/changing
  it (or re-run `npm run build` for a production build).

## Running the E2E tests locally

```powershell
npx playwright install chromium   # once
npm run test:e2e
```
[playwright.config.ts](../playwright.config.ts) auto-starts both dev servers for you
(`webServer` array) and points tests at `http://localhost:5173`. If a dev server is already
running from a separate terminal, it's reused instead of starting a new one.

## Troubleshooting

- **`node`/`npm`/`git` not found in a new terminal** — see the Windows PATH note under
  Prerequisites; it needs to be re-added per fresh terminal unless set permanently.
- **Port already in use** (`EADDRINUSE` on 5173 or 8080) — find and stop the stale process:
  ```powershell
  Get-NetTCPConnection -LocalPort 5173,8080 -State Listen -ErrorAction SilentlyContinue
  Stop-Process -Id <OwningProcess> -Force
  ```
- **Blank page / E2E tests fail right after installing a new dependency** — if a Vite dev server
  from before the `npm install` is still running, its `node_modules/.vite` dependency
  pre-bundle cache can be stale. Kill the stale process (see above) and restart `dev:web`, or just
  let `npm run test:e2e` start a fresh one.
- **`ERR_MODULE_NOT_FOUND: @mastermind/shared` when running `node apps/server/dist/index.js`** —
  make sure `npm run build` was run from the repo root first (not just `apps/server`'s own build)
  so `packages/shared`'s compiled `dist/` exists; the package's conditional `exports` field falls
  back to `dist/` for plain `node`, but only if it's actually been built.
  See [project-status.md](./project-status.md) §3 for background on this fix.
- **Client can't reach the server / CORS errors in dev** — confirm `apps/server` is running on
  the port the client expects (`http://localhost:8080` by default) and, if testing across
  devices/origins, set `CORS_ORIGIN` on the server to match the client's origin.
- **`npm install` at the repo root only** — never run `npm install` inside `apps/web` or
  `apps/server` directly; it breaks the workspace symlinks that let them resolve
  `@mastermind/shared`. If that happens, delete `node_modules` everywhere and reinstall from the
  root.
