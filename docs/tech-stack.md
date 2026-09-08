# Mastermind - Tech Stack

> **Status:** Proposed for the initial implementation. This document describes
> the application stack, project structure, and expected path from a local MVP
> to a deployable multiplayer service.

## 1. Frontend

- **React 19** for the browser UI and screen flow.
- **TypeScript** for type-safe application code.
- **Vite** for local development, production builds, and frontend tooling.
- **CSS Modules and shared CSS design tokens** for component styling, themes,
  responsive layouts, and accessible peg colors.
- **Lucide React** for interface icons.

The frontend will be a responsive single-page application supporting mobile,
tablet, and desktop layouts. Light/dark themes and color-blind symbols will be
implemented through shared design tokens and user preferences.

## 2. Backend

- **Node.js** as the server runtime.
- **TypeScript** for server code and shared contracts.
- **Fastify** for HTTP endpoints, static frontend delivery, and server
  lifecycle management.
- **Socket.IO** for real-time room events, role selection, round timers,
  guesses, feedback, disconnection, and reconnection.

A single Node.js service will initially serve the built frontend and manage
WebSocket connections. This keeps local development and first deployment
straightforward.

## 3. Shared Contracts

- **Zod** for runtime validation of client/server messages.
- A shared TypeScript package for room, player, game, peg, guess, and event
  types.

Client input must be validated by the server. The server remains authoritative
for room membership, role assignment, the secret code, timers, round results,
and rankings.

## 4. Game State and Persistence

The first implementation will use an **in-memory repository** for active rooms
and games. The repository boundary will allow storage to be replaced without
rewriting game rules or transport handlers.

**Redis** is the intended production upgrade when the app requires:

- Active games to survive a server process restart.
- Multiple server instances.
- Shared Socket.IO room and presence state across instances.
- More resilient reconnection support.

A relational database is not required for the initial version because there
are no accounts, permanent profiles, or long-term match history in the current
requirements. PostgreSQL can be introduced later if those features are added.

## 5. Testing

- **Vitest** for shared game-rule and server unit tests.
- **React Testing Library** for component behavior and accessibility tests.
- **Playwright** for complete browser flows across desktop and mobile
  viewports.

Game-rule tests should cover role assignment, duplicate colors, feedback
calculation, carried-over guesses, simultaneous winners, timer expiry, and
reconnection state restoration.

## 6. Project Structure

The repository will use npm workspaces:

```text
apps/
  web/       React and Vite frontend
  server/    Fastify and Socket.IO server
packages/
  shared/    Types, Zod schemas, and shared constants
  game/      Framework-independent game rules and scoring
docs/        Product, UX, and architecture documentation
```

Keeping game rules independent from React, Fastify, and Socket.IO makes them
easier to test and reuse in future native clients.

## 7. Deployment Shape

The initial deployment target is **Microsoft Azure App Service for Linux**.
One Node.js App Service will:

1. Serve the production Vite assets.
2. Expose any required HTTP endpoints.
3. Host the Socket.IO server.
4. Store active rooms in memory.

WebSockets must be enabled in the App Service configuration. The first release
will run as a single instance so all room state and Socket.IO connections stay
in one process. Deployment can use GitHub Actions with Azure deployment
credentials stored as repository secrets.

A later scaled deployment can add an Azure-managed Redis service, the
Socket.IO Redis adapter, and multiple App Service instances. Application
Insights can provide server logs, request tracing, and runtime monitoring.
Azure resource spending alerts should be configured against the subscription
credit before deployment.

## 8. Initial Dependencies

Expected core packages:

```text
Frontend: react, react-dom, lucide-react, socket.io-client, zod
Backend:  fastify, @fastify/static, socket.io, zod
Testing:  vitest, @testing-library/react, playwright
Tooling:  typescript, vite, eslint
```

Package versions will be locked by the generated lockfile when the project is
scaffolded.
