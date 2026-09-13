# Mastermind Online — Agent Instructions

Multiplayer web Mastermind game. npm workspaces monorepo: `packages/shared` (types/engine/socket
contracts), `apps/server` (Fastify 5 + Socket.IO 4), `apps/web` (React 19 + Vite).

**Before making changes**, read [docs/project-status.md](../docs/project-status.md) — it's the
living reference for current implementation status, repo structure, and next steps. Also see
[docs/game-rules.md](../docs/game-rules.md) and [docs/ux-layout.md](../docs/ux-layout.md) for the
original requirements/design this implementation follows.

## Build, lint, test

- `npm run build` (root) — builds `packages/shared` → `apps/web` → `apps/server` in order.
  Always use the root command, not a per-workspace one, when `packages/shared`'s types changed.
- `npm run lint --workspace apps/web` — ESLint.
- `npm run test:e2e` (root) — Playwright E2E, auto-starts both dev servers. `e2e/single-user.spec.ts`
  and `e2e/multi-user.spec.ts`, helpers in `e2e/helpers.ts`.
- `npm run dev:server` / `npm run dev:web` — dev servers on :8080 / :5173.
- Standard verification loop after any change: build → lint → test:e2e, plus a browser check for
  UI changes.

## Environment gotchas (Windows)

- Node isn't on PATH by default in a fresh terminal — check `node -v` first; if missing, prepend
  once: `$env:PATH = "<node-dir>;" + $env:PATH`. Do NOT re-prepend on every command in the same
  terminal — causes PATH bloat that breaks nested npm workspace builds (`'tsc' is not recognized`).
- git is at `C:\Program Files\Git\cmd` if not already on PATH.
- Kill stale dev servers on 5173/8080 before restarting
  (`Get-NetTCPConnection -LocalPort 5173,8080 -State Listen`).

## Testing gotchas

- E2E helpers (`e2e/helpers.ts`) depend on exact CSS selectors/tag names (e.g. `getRoomCode`
  selects `.room-code__value`). Any markup change to a screen used by both spec files can silently
  break the OTHER file's tests — always run the FULL `test:e2e` suite after markup changes, not
  just the spec you think is relevant.
- A generic "Test timeout exceeded" with no specific assertion failure usually means a locator
  matched zero elements with no explicit timeout (retries silently for the whole test budget) —
  not a real app hang. Bisect with temporary `console.log` breadcrumbs between `await` steps.
- Playwright's non-`exact` `getByRole` name matching is substring-based (e.g. `{name: 'Play'}`
  can match "Play Solo" AND "...Opens How to Play") — use `exact: true` to disambiguate.

## Conventions

- `eslint-plugin-react-hooks` rejects mutating refs during render (even writes) — sync a ref via
  `useEffect`, not a plain render-body assignment.
- Effects managing per-round-scoped state (timers, refs) in components that stay mounted across
  rounds (`MainGame.tsx`) must include `room.round`/`room.status` in their dependency array, not
  rely on unmount-only cleanup.
- Emoji are used as icons throughout (no icon library yet). Astral-plane emoji (e.g. 🔗 🪄) can get
  corrupted by string-replace edits — always re-read the file after inserting one to confirm.
- This repo currently has two remotes of interest: `main` (deploy-relevant, CI runs
  `on: push: branches: [main]`) and `feature/cosmetics` (active work). CI does not run on other
  branches automatically.
