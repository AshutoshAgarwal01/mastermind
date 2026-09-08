# Mastermind — Deployment Guide (Azure)

> Recommended deployment approach, following the intended shape described in
> [tech-stack.md](./tech-stack.md) §7. See that doc for the fuller reasoning.

**Progress:** Steps 1, 3, 4, 5, 6 done (resources created, WebSockets + Always
On enabled, env vars confirmed, server now serves the built frontend, OIDC +
GitHub Actions wired up). Step 7 (monitoring & cost) still pending.

## Current Azure resources

Already created (Portal), for reference in the commands below:

| Resource | Name |
| --- | --- |
| Resource group | `rg-mastermind` |
| App Service plan | `plan-mastermind` (tier: **B1 / Basic**) |
| Web App | `mastermind` |
| Default hostname | `mastermind-hggefxb9athnfyfz.westus3-01.azurewebsites.net` |

> **B1 (Basic) tier notes:**
> - **Always On is available** — enable it now (see §4 below) so the
>   in-memory room state doesn't get evicted on idle unload.
> - WebSockets are not connection-capped like Free/Shared tiers.
> - Not free (small hourly cost) — worth setting a spending alert on the
>   subscription.
> - Still a single instance, which matches this app's in-memory room state
>   (do not enable autoscale without adding Redis + the Socket.IO Redis
>   adapter first).

## Recommended: single Azure App Service (Linux)

**Why one service:** `apps/server` (Fastify + Socket.IO) and `apps/web`
(Vite/React) become one deployable unit — the server serves the built web
assets as static files, so there's no CORS to configure and no second service
to coordinate.

### 1. Make the server serve the built frontend — ✅ Done

`apps/server` now uses `@fastify/static` to serve `apps/web/dist`, with a
`setNotFoundHandler` SPA fallback (unmatched `GET` requests → `index.html`,
except `/socket.io/*` transport requests) so client-side routing still works.
Only active when `NODE_ENV=production` — local dev is unaffected and still
uses the two separate dev servers.

**Also fixed along the way:** `packages/shared`'s `package.json` pointed
`"main"` directly at its TypeScript source (`./src/index.ts`), which only
resolves through tsx/Vite's dev-time TS handling. Plain `node` (i.e. any real
production run of the compiled server) crashed immediately with
`ERR_MODULE_NOT_FOUND` trying to import it. Fixed via conditional exports:
```json
"exports": {
  ".": {
    "development": "./src/index.ts",
    "types": "./dist/index.d.ts",
    "default": "./dist/index.js"
  }
}
```
tsx and Vite both automatically pass the `development` condition in dev
mode, so live TS source is still used for local dev with no rebuild step;
plain `node` (production) falls through to `default` and correctly loads the
compiled `dist/index.js`. Verified: `node apps/server/dist/index.js` with
`NODE_ENV=production` now serves `/health`, `/`, and an arbitrary unmatched
client route (SPA fallback) all with `200`; a fresh `tsx` dev run still
resolves `@mastermind/shared` from source with no rebuild needed.

### 2. Build once, deploy the artifact — ✅ Works locally today

The root `npm run build` already does the right order: `packages/shared` →
`apps/web` → `apps/server`. The deployable artifact is just `apps/server`
(compiled JS) + `apps/server/node_modules` + the `apps/web/dist` folder it
serves.

### 3. Create the Azure resources — ✅ Done

See "Current Azure resources" above. For reference, this is what was run:

```powershell
az group create -n rg-mastermind -l westus3
az appservice plan create -g rg-mastermind -n plan-mastermind --is-linux --sku B1
az webapp create -g rg-mastermind -p plan-mastermind -n mastermind --runtime "NODE:22-lts"
```

### 4. Required App Service settings — ✅ Done

- **WebSockets:**
  ```powershell
  az webapp config set -g rg-mastermind -n mastermind --web-sockets-enabled true
  ```
- **Always On** (available on B1 — enable it so in-memory room state
  survives idle periods):
  ```powershell
  az webapp config set -g rg-mastermind -n mastermind --always-on true
  ```
- **Single instance:** do **not** enable autoscale/multiple instances — rooms
  live in one process's memory; scaling out would split players across
  instances that can't see each other's rooms (same "known gap" noted in
  [project-status.md](./project-status.md): needs Redis + the Socket.IO Redis
  adapter before horizontal scaling).
- `PORT` is injected automatically by App Service — the Fastify server
  should already listen on `process.env.PORT ?? 8080`.

### 5. Environment variables to set — ✅ Done

- `NODE_ENV=production`
- `VITE_SERVER_URL` is **not needed** for this single-App-Service approach —
  `apps/web/src/state/socketClient.ts` now defaults to `window.location.origin`
  in production builds (only falls back to `http://localhost:8080` in local
  dev, via Vite's `import.meta.env.DEV`). Only set `VITE_SERVER_URL` if using
  the split-hosting alternative below, where the frontend and API live on
  different domains.

### 6. Deploy (GitHub Actions + OIDC) — ✅ Done

A starter workflow already exists at
[.github/workflows/deploy.yml](../.github/workflows/deploy.yml). It builds,
lints, and runs the E2E suite, then deploys via `azure/webapps-deploy` using
**OIDC (workload identity federation)** instead of a publish-profile secret —
no long-lived credential is stored in GitHub. To finish wiring it up:

1. **Create an Azure AD app registration** and a service principal for it:
   ```powershell
   az ad app create --display-name mastermind-deploy
   az ad sp create --id <appId-from-above>
   ```
2. **Grant it deploy rights**, scoped to just the resource group:
   ```powershell
   az role assignment create --assignee <appId> --role "Website Contributor" \
     --scope /subscriptions/<sub-id>/resourceGroups/rg-mastermind
   ```
3. **Add a federated credential** trusting this exact repo + branch (Azure
   Portal → App registration → Certificates & secrets → Federated credentials,
   or `az ad app federated-credential create`), subject:
   `repo:<org>/<repo>:ref:refs/heads/main`.
   > **Gotcha hit + fixed:** GitHub now includes immutable owner/repo IDs in
   > the OIDC subject claim (security hardening), so the actual subject sent
   > is `repo:<org>@<org-id>/<repo>@<repo-id>:ref:refs/heads/main`, not the
   > plain-name format above — Azure AD requires an exact string match, so
   > using the plain-name subject fails with `AADSTS700213`. Get the real
   > subject from a failed Actions run's "Azure login (OIDC)" step log (it's
   > printed under "Federated token details"), and use that literal string.
   > For this repo it was:
   > `repo:AshutoshAgarwal01@17690014/mastermind@1360735620:ref:refs/heads/main`.
4. **Add repo secrets** (Settings → Secrets and variables → Actions):
   `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` (all from the
   app registration / `az account show`).
5. **Add a repo variable** `AZURE_WEBAPP_NAME` set to `mastermind`.
6. **Enable Oryx build-on-deploy** so Azure runs `npm install && npm run
   build` server-side against the whole workspace (avoids hand-packaging the
   npm-workspaces symlinked `node_modules`):
   ```powershell
   az webapp config appsettings set -g rg-mastermind -n mastermind \
     --settings SCM_DO_BUILD_DURING_DEPLOYMENT=true
   ```
   > **Gotcha hit + fixed:** Oryx's `npm install` only installed 111 packages
   > and the build failed with `sh: 1: tsc: not found` — modern npm (v9+
   > removed the old `--production` flag) defaults its `omit` config to
   > `dev` automatically whenever `NODE_ENV=production` is set (needed at
   > runtime, see §5), skipping `devDependencies` (where `typescript`,
   > `vite`, `tsx` live) during Oryx's build-time `npm install`.
   > `NPM_CONFIG_PRODUCTION=false` does **not** fix this — that config key no
   > longer exists in npm 9+ and is silently ignored. The correct override is
   > `--include=dev`, set via:
   > ```powershell
   > az webapp config appsettings set -g rg-mastermind -n mastermind \
   >   --settings NPM_CONFIG_INCLUDE=dev
   > ```
   > `include` takes precedence over the `NODE_ENV`-driven `omit` default,
   > forcing dev dependencies to install regardless.
7. **Set the Startup Command** (Portal → Configuration → General settings, or
   `az webapp config set -g rg-mastermind -n mastermind --startup-file
   "node apps/server/dist/index.js"`).

This still depends on step 1 above (server serving `apps/web/dist`) being
implemented before a deploy will actually serve a working app.

**CI gotcha hit + fixed:** the CI build step failed with
`Cannot find native binding ... @rolldown/binding-linux-x64-gnu` — a known npm
bug ([npm/cli#4828](https://github.com/npm/cli/issues/4828)) where a
lockfile committed on Windows can be missing another OS's platform-specific
optional dependency (here, Vite's Rolldown bundler native binding). `npm ci`
and even a plain `npm install` both still trust the existing lockfile's
resolution and hit the same error. Fixed by deleting `package-lock.json`
before `npm install` in the workflow, forcing a full fresh resolve against
the runner's actual platform (safe in CI since every run starts from a clean
checkout anyway).

### 7. Monitoring & cost — ⏳ Not started

- Enable Application Insights for logs/traces.
- Set a spending alert on the subscription before deploying (Basic B1 tier is
  cheap but not free).

## Alternative: split hosting

If the frontend and backend should be independently deployable/scalable
later, use **Azure Static Web Apps** for `apps/web` (free tier, built-in CDN,
GitHub Actions auto-configured) + a separate App Service for `apps/server`.
This needs CORS configured (`@fastify/cors` origin = the Static Web App's
domain) and the client's `VITE_SERVER_URL` (see §5 above) set at build time to
the API's App Service URL. More moving parts, but decouples frontend deploys
from backend deploys.
