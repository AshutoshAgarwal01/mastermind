# Telemetry (Azure Application Insights)

> Reference for every custom telemetry item the app emits, where it's raised in code, and a
> sample Kusto (Log Analytics) query to pull it back out of Application Insights. See
> [deployment.md](./deployment.md) §7 for how to wire up the connection strings that turn this
> from a no-op into live data. For durable, long-lived usage metrics (games played, completed,
> returning users) that shouldn't depend on Application Insights' retention window, see the
> planned approach in [analytics.md](./analytics.md).

## How it's wired

- **Server** — [apps/server/src/telemetry.ts](../apps/server/src/telemetry.ts) wraps the
  `applicationinsights` Node SDK (classic v2 API, custom events only — auto-collected
  request/dependency/performance/console telemetry is disabled). No-ops unless
  `APPLICATIONINSIGHTS_CONNECTION_STRING` is set. Cloud role name: `mastermind-server`.
- **Client** — [apps/web/src/state/telemetry.ts](../apps/web/src/state/telemetry.ts) wraps
  `@microsoft/applicationinsights-web`. No-ops unless `VITE_APPINSIGHTS_CONNECTION_STRING` was set
  at Vite **build** time (baked into the bundle — see deploy.yml). Ajax/fetch auto-tracking and
  auto route tracking are disabled (the app has its own screen router, not real browser routes).
- Every event on both sides carries a common `environment` property: `"development"` or
  `"production"`.
- Server events use `roomCode` as the natural correlation ID across a whole game session.
- **Testing locally:** set the connection string via a git-ignored `.env.local` file instead of a
  terminal env var — see [local-development.md](./local-development.md) "Local secrets via
  `.env.local` files".

## Table cheat sheet

| SDK call | Application Insights table | Notes |
| --- | --- | --- |
| `trackEvent(name, properties)` | `customEvents` | properties land in `customDimensions` (all values stored as strings — cast with `todouble()`/`toint()`/`tobool()` as needed) |
| `trackPageView(name)` | `pageViews` | client-only, one per screen/room-status transition |
| `trackException(err, properties)` | `exceptions` | properties land in `customDimensions`; message is under `outerMessage`/`details` |

All queries below assume the default Application Insights Logs view (KQL). Add
`| where timestamp > ago(1d)` (or similar) to scope the time range.

---

## Server-side events

Source: [apps/server/src/room.ts](../apps/server/src/room.ts) (lifecycle/round events, direct
`trackEvent` calls) and [apps/server/src/index.ts](../apps/server/src/index.ts) (`errorResponse()`
helper, single central `trackException` hook for every socket handler's catch block).

### `game.created`

Fired in the `Room` constructor, when a room is first created.

| Property | Type | Description |
| --- | --- | --- |
| `roomCode` | string | 5-char room code |
| `difficulty` | string | `easy` \| `moderate` \| `impossible` |
| `pegCount` | number | 4 \| 5 \| 6 |

```kusto
customEvents
| where name == "game.created"
| project timestamp, roomCode = customDimensions.roomCode, difficulty = customDimensions.difficulty,
          pegCount = toint(customDimensions.pegCount), environment = customDimensions.environment
| order by timestamp desc
```

### `player.joined`

Fired in `Room.addPlayer()` after a new (non-bot) player is added to the lobby.

| Property | Type | Description |
| --- | --- | --- |
| `roomCode` | string | room code |
| `playerCount` | number | total players in the room after joining |
| `isHost` | boolean | true for the first player in a room |

```kusto
customEvents
| where name == "player.joined"
| summarize joins = count() by roomCode = tostring(customDimensions.roomCode)
| order by joins desc
```

### `player.reconnected`

Fired in `Room.reconnect()` when a disconnected player rejoins via their stored session token.

| Property | Type | Description |
| --- | --- | --- |
| `roomCode` | string | room code |
| `playerId` | string | reconnecting player's internal id |

```kusto
customEvents
| where name == "player.reconnected"
| project timestamp, roomCode = customDimensions.roomCode, playerId = customDimensions.playerId
| order by timestamp desc
```

### `player.disconnected`

Fired in `Room.markDisconnected()` on socket disconnect or explicit leave.

| Property | Type | Description |
| --- | --- | --- |
| `roomCode` | string | room code |
| `playerId` | string | disconnecting player's internal id |

```kusto
customEvents
| where name == "player.disconnected"
| summarize disconnects = count() by bin(timestamp, 1h)
| render timechart
```

### `player.kicked`

Fired in `Room.kickPlayer()` after the host successfully kicks someone from the lobby.

| Property | Type | Description |
| --- | --- | --- |
| `roomCode` | string | room code |
| `kickedPlayerId` | string | id of the removed player |

```kusto
customEvents
| where name == "player.kicked"
| project timestamp, roomCode = customDimensions.roomCode, kickedPlayerId = customDimensions.kickedPlayerId
| order by timestamp desc
```

### `game.started`

Fired in `Room.startGame()` once the host explicitly starts (transition out of `lobby`).

| Property | Type | Description |
| --- | --- | --- |
| `roomCode` | string | room code |
| `difficulty` | string | `easy` \| `moderate` \| `impossible` |
| `pegCount` | number | 4 \| 5 \| 6 |
| `humanCount` | number | number of human players (bots not counted) |

```kusto
customEvents
| where name == "game.started"
| summarize games = count() by difficulty = tostring(customDimensions.difficulty),
            pegCount = toint(customDimensions.pegCount)
| order by games desc
```

### `game.ended`

Fired in `Room.endGame()` (private, called from `resolveRound()`), the single outcome event per
game — matches the "game information" event described in the original ask. Round-level detail
(per-round timeouts/cracks) is intentionally NOT tracked as a separate per-round event — that
would be the single highest-volume event in the whole set (up to `maxRounds` per game, i.e. up to
12x for Easy). Instead, timeouts are accumulated across the whole game and rolled up here as
`totalTimeouts`, keeping this at 1 event per game like everything else.

| Property | Type | Description |
| --- | --- | --- |
| `roomCode` | string | room code |
| `difficulty` | string | `easy` \| `moderate` \| `impossible` |
| `pegCount` | number | 4 \| 5 \| 6 |
| `playerCount` | number | total players (humans + bot) at game end |
| `roundsPlayed` | number | final round number reached |
| `didWin` | boolean | true if at least one Decoder cracked the code |
| `winningRound` | number \| null | round the first cracker won on, `null` if nobody won |
| `durationMs` | number | wall-clock time from `game.started` to `game.ended` |
| `totalTimeouts` | number | sum of Decoder timeouts (carried-over guesses) across every round of the game |
| `hintUsed` | boolean | true if any Decoder used their one-per-game hint during this game |

```kusto
customEvents
| where name == "game.ended"
| extend didWin = tobool(customDimensions.didWin), durationMs = todouble(customDimensions.durationMs),
         roundsPlayed = toint(customDimensions.roundsPlayed), difficulty = tostring(customDimensions.difficulty),
         totalTimeouts = toint(customDimensions.totalTimeouts), hintUsed = tobool(customDimensions.hintUsed)
| summarize games = count(), winRate = avg(iif(didWin, 1.0, 0.0)), avgDurationMs = avg(durationMs),
            avgRoundsPlayed = avg(roundsPlayed), avgTimeouts = avg(totalTimeouts),
            hintRate = avg(iif(hintUsed, 1.0, 0.0)) by difficulty
| order by difficulty asc
```

### `game.restarted`

Fired in `Room.playAgain()` when the host starts a new game in the same room (`ended` → `lobby`).

| Property | Type | Description |
| --- | --- | --- |
| `roomCode` | string | room code |

```kusto
customEvents
| where name == "game.restarted"
| summarize restarts = count() by roomCode = tostring(customDimensions.roomCode)
| order by restarts desc
```

### `error.server` (exceptions)

Every socket handler's catch block funnels through `errorResponse()` in `index.ts`, which calls
`trackException` — covers both expected `RoomError` validation failures (e.g. "Room not found",
"You already submitted this round") and any unexpected error.

| Property | Type | Description |
| --- | --- | --- |
| `roomCode` | string (when known) | room code, if the error occurred inside a room context |
| `playerId` | string (when known) | acting player's id, if resolvable |
| (exception message/type) | — | standard `exceptions` table columns (`outerMessage`, `type`) |

```kusto
exceptions
| where cloud_RoleName == "mastermind-server"
| summarize errors = count() by outerMessage, roomCode = tostring(customDimensions.roomCode)
| order by errors desc
```

---

## Client-side events

Source: [apps/web/src/state/MultiplayerContext.tsx](../apps/web/src/state/MultiplayerContext.tsx).

### `screen.viewed` (page views)

A `useEffect` watching `room?.status` / `screen` calls `trackPageView` on every screen transition,
in-room or pre-room.

| `name` value | When |
| --- | --- |
| `pre-room:home` \| `pre-room:create` \| `pre-room:join` \| `pre-room:how-to` \| `pre-room:settings` | before joining/creating a room |
| `room:lobby` \| `room:role-vote` \| `room:setting-code` \| `room:playing` \| `room:ended` | once in a room, keyed by `room.status` |

```kusto
pageViews
| summarize views = count() by name
| order by views desc
```

```kusto
// Funnel: how many sessions reach each in-room stage
pageViews
| where name startswith "room:"
| summarize sessions = dcount(session_Id) by name
| order by name asc
```

### `error.client` (custom event)

Fired from `createRoom`/`joinRoom` when the server rejects the request (invalid name, room full,
room not found, etc.).

| Property | Type | Description |
| --- | --- | --- |
| `context` | string | `"create_room"` \| `"join_room"` |
| `message` | string | server-provided error message |

```kusto
customEvents
| where name == "error.client"
| summarize count() by context = tostring(customDimensions.context), message = tostring(customDimensions.message)
| order by count_ desc
```

> `trackException` is also exported from `apps/web/src/state/telemetry.ts` for future use (e.g. a
> React error boundary) but has no call site yet — nothing currently reports client-side
> exceptions.

---

## Common queries

```kusto
// All telemetry for one room, across both server and client, ordered chronologically
union customEvents, pageViews, exceptions
| where customDimensions.roomCode == "<ROOMCODE>" or tostring(customDimensions.roomCode) == "<ROOMCODE>"
| project timestamp, itemType, name, customDimensions
| order by timestamp asc
```

```kusto
// Split every custom event by environment (dev vs prod)
customEvents
| summarize count() by name, environment = tostring(customDimensions.environment)
| order by name asc
```
