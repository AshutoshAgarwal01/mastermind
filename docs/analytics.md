# Permanent Usage Analytics (Planned)

> Status: **not yet implemented** — this is a design doc for a future session. See
> [telemetry.md](./telemetry.md) for the diagnostic-focused Application Insights telemetry that
> already exists today.

## Problem

[telemetry.md](./telemetry.md)'s Application Insights events are great for diagnostics, but not a
good fit for permanent business metrics:

- Default retention is 90 days (free); extending it further costs money per GB and scales with
  ingestion volume.
- It's built for "what happened recently and why," not "how many games have ever been played."

Goal: durably answer questions like **games played**, **games completed**, and **returning users**
over the *entire lifetime* of the app, at near-zero ongoing cost.

## Recommendation: a tiny durable ledger, decoupled from App Insights

Keep Application Insights exactly as-is for short-term diagnostics/error tracking (see
[telemetry.md](./telemetry.md)). Separately, add a **minimal permanent data store** that the
server writes one compact row to at the moments it already computes the data — a second write
alongside the existing `trackEvent` calls, not a replacement for them.

### Store choice: Azure Table Storage

- Pennies/month at this scale (~$0.045/GB + ~$0.0004 per 10k transactions) — a hobby project's
  entire lifetime history will cost cents, not dollars.
- No schema migrations; trivial from Node via `@azure/data-tables`.
- Simple enough to query directly for the metrics below (count rows, filter `didWin`, distinct
  `deviceId`) — no need for a full relational database.
- More durable than writing to local disk on App Service (not guaranteed persistent across
  restarts/instances) and cheaper than Cosmos DB or a managed Postgres/MySQL instance.

### Proposed schema — one row per finished game

Written inside `Room.endGame()` (the same spot the existing `game.ended` telemetry event already
fires — see [telemetry.md](./telemetry.md#gameended)):

| Field | Source |
| --- | --- |
| `roomCode` | existing |
| `difficulty` | existing |
| `pegCount` | existing |
| `playerCount` | existing |
| `roundsPlayed` | existing |
| `didWin` | existing |
| `winningRound` | existing |
| `durationMs` | existing |
| `endedAt` | `new Date().toISOString()` |
| `deviceIds` | **new** — see below |

### The one real gap: returning users need a persistent identity

Right now nothing survives a browser restart except a per-room `sessionToken` in
`sessionStorage` (cleared when the tab/session ends). To detect returning players without
building accounts/login, use a lightweight **anonymous device ID**: a UUID generated once and
stored in `localStorage` (survives across sessions, unlike `sessionStorage`), sent up when a
player joins/creates a room. No PII, no login — just a stable anonymous identifier used to
compute "distinct deviceIds seen across multiple days" as the returning-user metric.

## What this gets you

- **Games played** = row count in the ledger table.
- **Games completed** = `didWin == true` filter (or "reached `game.ended`" vs. abandoned rooms, if
  abandonment tracking is added too).
- **Returning users** = distinct `deviceId`s with sightings on more than one calendar day.
- All of it queryable forever, independent of any Application Insights retention window, at
  negligible cost.

## Implementation checklist (future session)

1. Provision (or reuse) an Azure Storage Account with Table Storage enabled.
2. Add `@azure/data-tables` to `apps/server`.
3. Add `apps/server/src/analytics.ts` (parallel to `telemetry.ts`): writes one row per finished
   game, no-op if unconfigured (same pattern as the existing telemetry no-op wiring) — reads a new
   connection string env var (e.g. `ANALYTICS_STORAGE_CONNECTION_STRING`) via the same
   `.env.local` mechanism documented in [local-development.md](./local-development.md).
4. Call it from `Room.endGame()` alongside the existing `trackEvent('game.ended', ...)` call.
5. Client: generate a UUID once, store in `localStorage` (e.g. `mastermind:deviceId`), send it
   with `create_room`/`join_room` requests; thread it through to the `analytics.ts` write.
6. Add a repo secret / App Setting for the connection string (same pattern as
   `APPLICATIONINSIGHTS_CONNECTION_STRING` in [deployment.md](./deployment.md) §7).
7. Document sample queries/scripts for pulling the aggregate numbers (games played, completed,
   returning users) out of the table — likely a small standalone Node script rather than a
   user-facing API endpoint.
8. Update [project-status.md](./project-status.md) and repo memory once implemented.
