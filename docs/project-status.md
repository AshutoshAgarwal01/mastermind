# Mastermind — Project Status

> Living reference for picking this project back up in a new session (bug
> fixes, features, etc.). Update this file whenever the structure, stack, or
> status materially changes. See [game-rules.md](./game-rules.md),
> [ux-layout.md](./ux-layout.md), and [tech-stack.md](./tech-stack.md) for the
> original requirements/design docs this implementation follows,
> [local-development.md](./local-development.md) for running this on your own
> machine, and [deployment.md](./deployment.md) for the recommended Azure
> hosting approach.

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
      components/          PegSlot, ColorPalette, GuessRow — ColorPalette is now an always-visible
                            bottom drawer (not a popup/modal): tap a color to select/highlight it,
                            then tap one or more pegs to fill them with that color. TimerBar NEW —
                            shared countdown bar (fill %, red "low time" state under 25%, optional
                            sub-second precision) used by both RoleVote (15s vote) and MainGame
                            (round timer) for a consistent look.
      screens/
        Home, CreateGame, JoinGame, HowToPlay, SettingsScreen — pre-room screens (CreateGame
                            shows difficulty as plain label pills with an ⓘ icon linking to
                            HowToPlay for the round-seconds/max-rounds definitions, and peg count
                            as pill buttons with a big number + small "PEGS" caption instead of
                            "N pegs" radio text). SettingsScreen also has a **Peg style** picker
                            (Classic / Minimal / Glossy / Bold radio options, default Bold) with a
                            live 6-color preview row, persisted to localStorage
                            (`mastermind:pegstyle`) and mirrored onto `document.documentElement`
                            as `data-peg-style` — CSS keyed off that attribute reskins both
                            `.peg-slot` and `.color-swatch` consistently everywhere pegs appear.
        HowToPlay           Enriched with a 6-step numbered "How a game works" list (emoji icon +
                            title/body card per step, reuses .how-to-step styles), a peg-color
                            swatch row (PegSlot small size per DIFFICULTIES/PEG_COLORS entry) for
                            "Picking peg colors", a live example-guess mockup (4 colored PegSlots +
                            feedback dots matching a real 2-exact/1-color-only/1-miss result,
                            reusing GuessRow's .feedback-dot/.guess-row__* CSS) with a legend, and
                            a "Good to know" tips list (timeout carry-over, peg locking, reconnection,
                            colorblind
                            mode). No screenshots — the VS Code embedded browser can't reliably
                            emulate a phone viewport (see §4 environment note), so illustration
                            relies on colored circles/icons instead.
        Lobby               Real player list, room code, host-only Start Game + Kick
        RoleVote            NEW — shown when room.status==='role-vote' (2+ humans): TimerBar
                            countdown, Coder/Decoder vote buttons
        RoleReveal          Client-only transitional screen; now auto-advances after 3s since
                            the round timer is already running server-side (see §3 gotcha)
        SetSecretCode       NEW — shown when room.status==='setting-code': peg-input UI for a
                            human Coder to choose the code, or a "waiting…" message + animated
                            random-fill peg row (WaitingPegAnimation) for everyone else; round
                            timer only starts once submitted
        MainGame            Branches Decoder view (own board + other-Decoders feedback sidebar,
                            one-hint-per-game 💡 bulb icon in the header) vs. Coder view (grid of
                            every Decoder's board, spectator-only, with a blinking round badge on
                            any Decoder still mid-round). Decoders can **double-tap any filled peg
                            in the current round to lock it** (a 🔒 badge appears on its corner) so
                            that color repeats automatically every following round instead of
                            needing to be re-picked — double-tap again to unlock. Locking is a
                            purely client-side convenience (`lockedPegs` boolean array in
                            `MultiplayerContext`, never sent to the server) that resets on every
                            new game. This same component is reused, in a read-only **review
                            mode**, when a finished game's "Review Game" button is pressed (see
                            GameEnd below) — `room.status === 'ended'` hides the timer, hints,
                            Submit button, and color palette, and swaps the ❌ Leave icon for a
                            ➜ "Back to Results" arrow that returns to GameEnd without leaving the
                            room.
        GameEnd             Secret code shown in a compact icon pill (🔑, no text label). Winners
                            and every Decoder's final guess are merged into ONE leaderboard
                            (avoids repeating names twice): each row is a rank medal (🥇🥈🥉🏅,
                            inline before the name) + name on one line, then that player's final
                            guess + feedback on the line below, column-aligned via matching CSS
                            grids so the round-number badge lines up under the section's 🎯 icon
                            and the peg row lines up under the name. A large per-viewer result
                            icon/message sits above the pills: 🥇 "You won!" for a winner, or one
                            of 😅/👏/🌟 for a loser depending on how close their final guess was; a
                            🤖 badge appears next to a bot Coder's name in the "nobody cracked it"
                            sentence. Actions row: **Play Again**
                            (host only) / **Review Game** (navigates into MainGame's read-only
                            review mode, see above) / **Return to Home**, all plain text buttons
                            in one row (not icon-only — tried and reverted per feedback).
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
- **Telemetry:** Azure Application Insights custom events, fully optional/no-op unless a
  connection string is configured (safe for local dev/CI with nothing set). Server
  (`apps/server/src/telemetry.ts`, `applicationinsights` v2 classic API, reads
  `APPLICATIONINSIGHTS_CONNECTION_STRING`) is the authoritative source for game/round lifecycle +
  errors, called directly from `Room` (`game.created`, `player.joined`/`reconnected`/
  `disconnected`/`kicked`, `game.started`, `game.ended` (with a rolled-up `totalTimeouts` count —
  no separate per-round event, to keep volume/cost down), `game.restarted`) and from `index.ts`'s
  central `errorResponse()` helper (`error.server`
  exceptions via `trackException`). Client (`apps/web/src/state/telemetry.ts`,
  `@microsoft/applicationinsights-web`, reads build-time `VITE_APPINSIGHTS_CONNECTION_STRING`)
  tracks page views for every screen/room-status transition plus `error.client` for join/create
  failures — wired into `MultiplayerContext.tsx`. Every event on both sides carries a common
  `environment: development|production` property. See [deployment.md](./deployment.md) §7 for the
  App Setting / repo secret still needed to actually enable it, and
  [telemetry.md](./telemetry.md) for the full event list + sample Application Insights queries.
- **Hints:** each Decoder gets exactly one hint per game. Tapping the 💡 bulb icon in the
  `MainGame` header arms "hint mode" (every peg in the current draft glows); tapping any peg then
  asks the server (`request_hint` socket event, server-validated in `Room.requestHint()`) for the
  secret color at that index and fills it in, after which only that peg keeps the glow and the
  bulb becomes permanently disabled + struck-through for the rest of the game.
- **Timeout handling:** if the round timer expires while a Decoder's current draft is fully
  filled in (even though they never pressed Submit), the server auto-submits that real draft
  instead of discarding it — the client mirrors the in-progress draft to the server via a
  fire-and-forget `update_draft` event so the server-authoritative timeout resolution can tell
  the two cases apart. A still-incomplete draft continues to carry over the previous round's
  guess, unchanged from the original behavior. Both cases show the same ⏱ icon in the guess
  history (recolored as an amber "warning", not the original dim gray) since, from the player's
  perspective, either way still counts as a timeout.
- **Game End result icons:** the viewer's own outcome is shown as a large icon + message — 🥇
  "You won!" if they won; otherwise one of 😅/👏/🌟 depending on how close their final guess was
  (`getLossResult()` in `GameEnd.tsx`). The "Code Cracked!" heading gets a random 🎉/🎊 prefix;
  the "Out of rounds" heading gets a 🔐 prefix. Winners (and the Coder, when nobody cracks it) are
  marked with 🥇 in the results list/summary line.
- **Peg locking:** in `MainGame.tsx`, double-tapping an already-filled peg in the current round
  toggles a lock on it (🔒 badge, no background chip, drop-shadow only, overlapping the peg's own
  corner) — a locked peg's color repeats automatically in every subsequent round until unlocked
  (same gesture) or a new game starts. A single tap on a filled peg still recolors it normally; a
  short (~300ms) tap-disambiguation window in `handlePegClick` distinguishes a genuine single tap
  from the first half of a double-tap so recoloring and locking never fight each other. Purely
  client-side (`lockedPegs` state in `MultiplayerContext`, `toggleLockedPeg` action) — the server
  has no concept of locks. When reviewing a finished game, the LAST historical round shows the
  lock badge for whatever was still locked when the game ended (earlier rounds show none, since
  there's no historical record of past lock state).
- **Peg style:** a Settings option (Classic / Minimal / Glossy / Bold, default **Bold**) that
  reskins every `.peg-slot` and `.color-swatch` via a `data-peg-style` attribute on `<html>` —
  Classic keeps the original gray-bordered circle; Minimal drops the border; Glossy adds a subtle
  radial-gradient highlight; Bold adds a self-shading inset ring + drop shadow (approximates a
  "tone-matched border" without needing each peg's actual hex value in CSS). Persisted to
  `localStorage` like theme/colorblind.
- **Review Game:** from GameEnd, decoders can navigate into a read-only version of `MainGame`
  (`showGameReview` client state, `reviewGame()`/`exitGameReview()` actions) to see their full
  round-by-round board again — no timer, hints, Submit, or color palette, with a ➜ "Back to
  Results" button replacing ❌ Leave. Resets automatically the moment a new game starts.
- Icons: still mostly emoji characters (⚙/✕/💡/🥇/etc.), not `lucide-react` — still not added.

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
  tie-breaking, timeout carry-over, or the Impossible/6-peg variants yet.
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

Two Playwright spec files live in `e2e/` at the repo root (5 tests total), added/extended after
manually validating each flow live in the browser:

- `e2e/single-user.spec.ts` (4 tests) — solo game: Create Game -> Lobby (solo note) -> Start Game
  -> auto-assigned bot Coder -> submits a guess in round 1 -> asserts a real exact/color-only
  score appears -> Leave Game back to Home; leaving mid-round (unsubmitted draft) clears that
  draft for the next game instead of leaking it in filled-in; peg circle size stays visually
  consistent across historical rows regardless of the ⏱ timeout icon (6-peg Impossible game, a
  real 20s timeout); double-tapping a filled peg locks it (color repeats next round, other slots
  reset) and double-tapping again unlocks it.
- `e2e/multi-user.spec.ts` (1 test) — two humans in separate browser contexts (Alice host + Bob guest):
  create/join by room code -> real 15s role vote (Alice votes Coder, Bob votes Decoder) -> Alice
  sets the secret code via `SetSecretCode` -> Bob submits the exact code -> asserts a perfect
  "4 correct position, 0 correct color" score and the shared "Code Cracked!" Game End screen on
  both pages -> asserts only the host sees "Play Again" and the merged leaderboard shows Bob's
  rank-1 medal.
- `e2e/helpers.ts` — shared helpers: `fillPegs` (taps a color in the always-visible color drawer,
  then an empty peg slot, per color), `getRoomCode` (reads the Lobby's room code),
  `dismissRoleReveal` (clicks Continue on RoleReveal, tolerating the 3s auto-advance already
  having fired).
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

See [local-development.md](./local-development.md) for the full walkthrough (prereqs, env vars,
running a production build locally, troubleshooting).

Per-workspace equivalents also work, e.g. `npm run dev --workspace apps/server`,
`npm run lint --workspace apps/web`.

## 6. Suggested Next Steps

1. Add Zod validation on every inbound socket event payload (server currently trusts TS types
   only — a real security/robustness gap before any public deployment).
2. Client-side auto-reconnect: on load, if a `sessionToken` exists in `sessionStorage` for a
   room code carried in the URL (or last-known room), automatically call `join_room` with it
   before falling back to Home.
3. Add Vitest unit tests for `packages/shared/src/engine.ts` (scoreGuess edge cases with
   duplicate colors, carry-over, blank-round-1 case) and for `apps/server/src/room.ts`'s role
   vote / round resolution branches (including the hint and auto-submit-on-timeout paths).
4. Azure App Service deployment: Dockerfile or App Service config for `apps/server`, static
   hosting or same-origin serving for the built `apps/web` bundle, WebSockets enabled.
5. Add `lucide-react` if/when real (non-emoji) icons are wanted.
6. Permanent usage analytics (games played/completed, returning users) via a durable ledger
   decoupled from Application Insights' retention window — design captured in
   [analytics.md](./analytics.md), not yet implemented.
7. Ship to Android + iOS app stores via Capacitor (wraps the existing `apps/web` build, no UI
   rewrite) — decision, native-feature plan, graphics ceiling, and required infrastructure
   captured in [mobile-platform.md](./mobile-platform.md), not yet implemented.
