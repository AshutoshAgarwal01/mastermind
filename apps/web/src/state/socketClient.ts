import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@mastermind/shared';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// Dev keeps hitting the separate API dev server; a production build defaults to
// same-origin (works once the server serves this build itself). Override either
// way by setting VITE_SERVER_URL at build time (e.g. for split frontend/API hosting).
const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : window.location.origin);

let socket: GameSocket | null = null;

export function getSocket(): GameSocket {
  if (!socket) {
    socket = io(SERVER_URL, { autoConnect: true, transports: ['websocket', 'polling'] });
  }
  return socket;
}
