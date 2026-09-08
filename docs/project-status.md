# Mastermind — Project Status

> Living reference for picking this project back up in a new session (bug
> fixes, features, etc.). Update this file whenever the structure, stack, or
> status materially changes. See [game-rules.md](./game-rules.md),
> [ux-layout.md](./ux-layout.md), and [tech-stack.md](./tech-stack.md) for the
> original requirements/design docs this implementation follows, and
> [deployment.md](./deployment.md) for the recommended Azure hosting approach.

## 1. Repository Structure

```text
docs/                    Product/design/status docs (this file, rules, UX, stack)
packages/
  shared/                 @mastermind/shared — game types, engine, room/event contracts
    src/
      types.ts             Difficulty, PegColorId, PegCount, GameSettings, RoundEntry, GameStatus, Role
      engine.ts             DIFFICULTIES, PEG_COLORS, generateSecretCode, scoreGuess,
                            resolveTimedOutGuess, pickBotName, generateRoomCode
      room.ts               RoomStateView / PlayerPublic (per-viewer room snapshot),
                            CreateRoomRequest / JoinRoomRequest / JoinRoomResponse / ErrorResponse
      socket-events.ts      ClientToServerEvents / ServerToClientEvents (typed Socket.IO contract)
      index.ts               barrel export
apps/
  server/                 Fastify + Socket.IO backend (authoritative game state, in-memory)
    src/
      index.ts             Fastify app + Socket.IO wiring, per-socket event handlers
      room.ts              Room class: players, role vote, round timer, scoring, win/loss
      rooms.ts             RoomManager (room-code -> Room lookup/creation)
  web/                    React + TypeScript + Vite frontend
    src/
      App.tsx              Screen router: pre-room screens by local state, in-room screens by
                            room.status (lobby/role-vote/playing/ended)
      App.css / index.css  Styles + theme tokens (unchanged from earlier solo-only pass)
      state/
        socketClient.ts     Lazily-created singleton Socket.IO client (VITE_SERVER_URL)
        MultiplayerContext.tsx  Provider: holds room snapshot + local UI state (screen, draft
                            guess, theme, colorblind), wraps every socket action in a promise
        useMultiplayer.ts   Context object + hook + shared state/action types (split out for
                            react-refresh/only-export-components, same pattern as before)
      components/          PegSlot, ColorPalette, GuessRow — unchanged, now import types from
                            @mastermind/shared instead of a local game/ module. TimerBar NEW —
                            shared countdown bar (fill %, red "low time" state under 25%, optional
                            sub-second precision) used by both RoleVote (15s vote) and MainGame
                            (round timer) for a consistent look.
      screens/
        Home, CreateGame, JoinGame, HowToPlay, SettingsScreen — pre-room screens (CreateGame
                            shows difficulty as plain label pills with an ⓘ icon linking to
                            HowToPlay for the round-seconds/max-rounds definitions, and peg count
                            as pill buttons with a big number + small "PEGS" caption instead of
                            "N pegs" radio text)
        Lobby               Real player list, room code, host-only Start Game + Kick
        RoleVote            NEW — shown when room.status==='role-vote' (2+ humans): TimerBar
                            countdown, Coder/Decoder vote buttons
        RoleReveal          Client-only transitional screen; now auto-advances after 3s since
                            the round timer is already running server-side (see §3 gotcha)
        SetSecretCode       NEW — shown when room.status==='setting-code': peg-input UI for a
                            human Coder to choose the code, or a "waiting…" message + animated
                            random-fill peg row (WaitingPegAnimation) for everyone else; round
                            timer only starts once submitted
        MainGame            Branches Decoder view (own board + other-Decoders feedback sidebar)
                            vs. Coder view (grid of every Decoder's board, spectator-only, with
                            a blinking round badge on any Decoder still mid-round)
        GameEnd             Secret code, ranked winners list, every Decoder's final guess+feedback
root package.json          npm workspaces ("apps/*", "packages/*")
```

## 2. Tech Stack

**Implemented:**
- **Frontend:** React 19 + TypeScript + Vite (unchanged from the solo-only pass). Plain CSS,
  `data-theme`/`data-colorblind` attributes on `<html>`. `localStorage` persists theme +
  colorblind only; `sessionStorage` persists a per-room session token
  (`mastermind:session:<ROOMCODE>`) used for reconnect-by-token.
- **Shared package:** `@mastermind/shared`, consumed as raw TypeScript source by both Vite (web)
  and `tsx` (server) — no separate build step is required for dev; `npm run build` in that
  package runs `tsc -b` for a standalone type-check/dist output.
- **Backend:** Fastify 5 + `@fastify/cors` + Socket.IO 4, run via `tsx watch` in dev. All game
  state is in-memory (`Map` inside `RoomManager`/`Room`) — restarting the server drops all rooms.
- **Realtime contract:** `ClientToServerEvents` / `ServerToClientEvents` in
  `packages/shared/src/socket-events.ts`, imported by both sides so the socket API is fully typed
  end-to-end (no `any`).
- Icons: still just the ⚙/✕ characters; `lucide-react` has not been added.

**Planned but NOT yet implemented:** Zod runtime validation of socket payloads (currently only
TypeScript compile-time typing — a malicious/buggy client could send an invalid payload shape),
Redis (single in-memory Node process only, no horizontal scaling or restart-persistence),
Vitest/RTL unit tests, Azure App Service deployment. See [tech-stack.md](./tech-stack.md) for the
full intended design. (Playwright E2E tests now exist — see §3.1.)

## 3. Current Functional Status

**Fully working, real multiplayer over the network (verified with two concurrent browser
sessions in this session):**
- Create Game now also collects the host's name tag, then creates a real room via
  `create_room` — server returns a room code + a session token (stored in `sessionStorage`).
- Join Game validates the room code + name against the live server (`join_room`), rejects
  duplicate names / full rooms / already-started rooms with the server's real error message.
- Lobby shows the live player list (host badge, bot badge), updates in real time via
  `room_update` broadcasts as players join/leave, host-only Kick button (emits `kicked` to the
  removed player's own socket).
- Solo (1 human) auto-skips straight to a bot Coder, matching game-rules.md §3, exactly as before.
- 2+ humans get a **real 15-second role vote** (`RoleVote` screen, live countdown from
  `room.roleVoteDeadline`): single Coder pick wins outright, multiple Coder picks resolve to a
  random one of them server-side, zero Coder picks add a bot Coder — verified all three branches
  behave per game-rules.md §3.
- Server-authoritative round timer (`setInterval` per room) broadcasts `timeLeft` every second;
  a round resolves early the instant every Decoder has submitted, or on timeout via
  `resolveTimedOutGuess` (blank first-round carry-over, or the real previous guess in later
  rounds) — verified both paths live.
- Per-viewer visibility is enforced server-side in `Room.toView()`: a Decoder only ever receives
  their own full guess history plus other Decoders' `latestFeedback` (exact/colorOnly counts,
  never colors); the Coder (and everyone once `status==='ended'`) receives every player's full
  history.
- Game End shows the secret code, a ranked winners list (`room.winners`, sorted by earliest
  submission timestamp), and **every Decoder's final guess + feedback row** (not just the
  viewer's own), per the multiplayer requirement documented in ux-layout.md §5.
- Disconnection: `markDisconnected` flips `connected: false` on the player without pausing/ending
  the round (matches game-rules.md §9); reconnection is supported via `sessionToken` matching in
  `join_room`, restoring the same player id/history.
- **Human Coders now actually choose their own secret code.** A new `setting-code` room status
  sits between role resolution and `playing`: if the resolved Coder is a bot, the server still
  auto-generates the code and starts the round immediately (unchanged). If the resolved Coder is
  human, the round timer does **not** start until they submit one via the new `SetSecretCode`
  screen (`set_secret_code` socket event, server-validated in `Room.setSecretCode`) — verified
  live that the timer starts fresh (full `roundSeconds`) only once submitted, and that Decoder
  guesses score correctly against the human-chosen code. Everyone else sees a "Waiting for the
  Coder to choose the secret code…" screen with a `WaitingPegAnimation` — a row of pegs that
  randomly fills/empties with random colors every 400ms (fade transition) to show something is
  happening; it reuses `PegSlot`, so it automatically respects color-blind mode (shape symbols)
  too.
- On the Coder's spectator board (`CoderBoards` in `MainGame.tsx`), each Decoder who hasn't
  submitted yet for the current round gets an empty-peg placeholder row (instead of nothing) with
  a **blinking round-number badge** (`guess-row__round--live`, CSS `@keyframes` pulse between
  accent-filled and outlined every 1.2s) to make it obvious which round is in progress.

**Known gap found + fixed during live testing:** the round timer starts server-side the instant
roles resolve, but `RoleReveal` used to require a manual "Continue" click — any delay there
silently burned into round 1's time budget. Fixed by auto-advancing `RoleReveal` after 3 seconds
(the manual button still works for anyone who clicks sooner). This is a UI-only mitigation; the
underlying "timer never pauses for anyone" behavior is intentional per game-rules.md. This same
auto-advance also covers the transition into the new `setting-code` phase.

**Explicitly stubbed / not implemented:**
- No Zod (or any) runtime validation of incoming socket payloads — the server trusts the
  TypeScript event types, which a non-TypeScript/malicious client could violate (this now also
  applies to `set_secret_code`'s code array — length is checked, individual color values are not).
- Reconnection only restores server-side state (history, role, connected flag); the client does
  not yet auto-attempt `join_room` with a stored session token on page load/refresh — a refresh
  mid-game currently drops you back to Home with no automatic rejoin flow.
- No unit tests exist yet (Vitest/RTL planned, not set up). E2E coverage exists (see §3.1) but
  only for two happy-path flows — no regression coverage for kick/disconnect/reconnect, role-vote
  tie-breaking, timeout carry-over, or the Impossible/6-8-peg variants yet.
- Azure App Service deployment is now wired up (resources created, server serves the built
  frontend, GitHub Actions + OIDC pipeline in `.github/workflows/deploy.yml`) — see
  [deployment.md](./deployment.md) for full status and the list of CI/runtime gotchas hit and
  fixed along the way. The workflow is split into a `build` job (runs automatically on every push
  to `main`: install/build/lint/E2E/prune/zip, never deploys) and a `deploy` job (only runs on
  manual `workflow_dispatch`, downloads the build artifact and runs `az webapp deploy --clean
  true`). **Live-site verification after the latest fix (pruning devDependencies) is still
  pending** (last observed deploy attempt, before that fix and before this build/deploy split, was
  stuck on "Starting the site..."): next session, manually trigger the workflow and confirm
  `https://mastermind-hggefxb9athnfyfz.westus3-01.azurewebsites.net/` actually loads before
  assuming it's done. Step 7 (Application Insights + spending alert) not started yet.
- No Dockerfile / containerized deployment path — the current approach is a plain Node App
  Service (Oryx build disabled, CI ships a pre-built + pruned artifact instead).

### 3.1 End-to-end tests (Playwright)

Two reusable Playwright specs live in `e2e/` at the repo root, added after manually validating
both flows live in the browser:

- `e2e/single-user.spec.ts` — solo game: Create Game -> Lobby (solo note) -> Start Game ->
  auto-assigned bot Coder -> submits a guess in round 1 -> asserts a real exact/color-only score
  appears -> Leave Game back to Home.
- `e2e/multi-user.spec.ts` — two humans in separate browser contexts (Alice host + Bob guest):
  create/join by room code -> real 15s role vote (Alice votes Coder, Bob votes Decoder) -> Alice
  sets the secret code via `SetSecretCode` -> Bob submits the exact code -> asserts a perfect
  "4 correct position, 0 correct color" score and the shared "Code Cracked!" Game End screen on
  both pages -> asserts only the host sees "Play Again".
- `e2e/helpers.ts` — shared helpers: `fillPegs` (clicks empty peg slots + the color palette
  overlay), `getRoomCode` (reads the Lobby's room code), `dismissRoleReveal` (clicks Continue on
  RoleReveal, tolerating the 3s auto-advance already having fired).
- Config: `playwright.config.ts` at the repo root auto-starts both `apps/server` and `apps/web`
  dev servers (`webServer` array, `reuseExistingServer` outside CI) before running tests against
  `http://localhost:5173`.
- Run with `npm run test:e2e` from the repo root. Chromium browser binaries must be installed
  once via `npx playwright install chromium`.
- Gotcha hit while writing these: the round-indicator badge (`Round N of M`) splits its visible
  text across child `<span>`s ("N" / "/M") and only carries the full "Round N of M" string in an
  `aria-label` on a plain `<span>` (role `generic`) — `getByText()`/`getByRole()` won't see it.
  Assert via `locator('.round-indicator').toHaveAttribute('aria-label', ...)` instead. Same
  applies to `.guess-row__feedback`'s exact/color-only score.

## 4. Known Environment Notes (this machine)

- Node.js was not on PATH; installed via `winget install OpenJS.NodeJS.LTS --scope user` (LTS
  24.19.0). Its actual binary lives under the winget packages folder, e.g.:
  `C:\Users\<user>\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.19.0-win-x64\`
  — prepend this directory to `$env:PATH` in PowerShell before running `npm`/`node` if a fresh
  terminal doesn't have it on PATH.
- The integrated VS Code browser tool used for UI checks does **not** truly emulate a device
  viewport — `setViewportSize` calls are ignored; the page always renders at the actual panel
  width. Use Chrome DevTools' device toolbar, resize the VS Code pane itself, or run
  `npm run dev -- --host` and load the URL from a real phone for genuine mobile testing.
- React's newer `eslint-plugin-react-hooks` purity rules flag `useRef(Date.now())` (impure call
  during render) and `setState` called synchronously in an effect body (not inside a
  callback/interval). Fix pattern used throughout: initialize refs to a plain literal (e.g. `0`)
  and set the real value inside a `useEffect`/interval callback instead.

## 5. Common Commands

From the **repo root** (after `npm install` once to link the workspaces):
- `npm run dev:server` — starts the Fastify/Socket.IO server (`tsx watch`, default port 8080)
- `npm run dev:web` — starts the Vite dev server (default http://localhost:5173/)
- `npm run build` — builds `packages/shared`, then `apps/web`, then `apps/server` in order

Per-workspace equivalents also work, e.g. `npm run dev --workspace apps/server`,
`npm run lint --workspace apps/web`.

## 6. Suggested Next Steps

1. Add Zod validation on every inbound socket event payload (server currently trusts TS types
   only — a real security/robustness gap before any public deployment).
2. Client-side auto-reconnect: on load, if a `sessionToken` exists in `sessionStorage` for a
   room code carried in the URL (or last-known room), automatically call `join_room` with it
   before falling back to Home.
3. Let a human Coder actually type their own secret code (currently always auto-generated),
   if that's still a desired requirement — needs a small new screen/step before spectator mode.
4. Add Vitest unit tests for `packages/shared/src/engine.ts` (scoreGuess edge cases with
   duplicate colors, carry-over, blank-round-1 case) and for `apps/server/src/room.ts`'s role
   vote / round resolution branches.
5. Azure App Service deployment: Dockerfile or App Service config for `apps/server`, static
   hosting or same-origin serving for the built `apps/web` bundle, WebSockets enabled.
6. Add `lucide-react` if/when real icons are wanted (currently just ⚙/✕ characters).
