import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  CreateRoomRequest,
  ErrorResponse,
  JoinRoomRequest,
  JoinRoomResponse,
  ServerToClientEvents,
  SetSecretCodeRequest,
  SubmitGuessRequest,
  VoteRoleRequest,
} from '@mastermind/shared';
import { RoomManager } from './rooms.js';
import { Room, RoomError } from './room.js';
import { trackException } from './telemetry.js';

const PORT = Number(process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? '0.0.0.0';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const app = Fastify({ logger: true });
await app.register(cors, { origin: process.env.CORS_ORIGIN ?? true });

app.get('/health', async () => ({ ok: true }));

if (IS_PRODUCTION) {
  // Serves the built apps/web SPA from the same origin as the API/Socket.IO server.
  const dirname = path.dirname(fileURLToPath(import.meta.url));
  const webDistDir = path.join(dirname, '../../web/dist');
  const indexHtml = readFileSync(path.join(webDistDir, 'index.html'));

  await app.register(fastifyStatic, { root: webDistDir });

  app.setNotFoundHandler((request, reply) => {
    // Client-side routing fallback — never intercept Socket.IO's own transport requests.
    if (request.method === 'GET' && !request.url.startsWith('/socket.io')) {
      reply.type('text/html').send(indexHtml);
    } else {
      reply.code(404).send({ error: 'Not found' });
    }
  });
}

const address = await app.listen({ port: PORT, host: HOST });
app.log.info(`Fastify listening on ${address}`);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(app.server, {
  cors: { origin: process.env.CORS_ORIGIN ?? '*' },
});

const rooms = new RoomManager();
const socketLocation = new Map<string, { roomCode: string; playerId: string }>();

function broadcastRoom(roomCode: string): void {
  const room = rooms.get(roomCode);
  if (!room) return;
  for (const player of room.playerList) {
    if (player.socketId) {
      io.to(player.socketId).emit('room_update', room.toView(player.id));
    }
  }
}

io.on('connection', (socket) => {
  socket.on('create_room', (req: CreateRoomRequest, cb) => {
    try {
      if (!req.name?.trim()) throw new RoomError('Name tag is required.');
      const room = rooms.create({ difficulty: req.difficulty, pegCount: req.pegCount }, broadcastRoom);
      const player = room.addPlayer(req.name.trim(), socket.id);
      socketLocation.set(socket.id, { roomCode: room.roomCode, playerId: player.id });
      socket.join(room.roomCode);
      const res: JoinRoomResponse = { ok: true, sessionToken: player.sessionToken, room: room.toView(player.id) };
      cb(res);
    } catch (err) {
      cb(errorResponse(err));
    }
  });

  socket.on('join_room', (req: JoinRoomRequest, cb) => {
    try {
      const room = rooms.get(req.roomCode);
      if (!room) throw new RoomError('Room not found.');

      if (req.sessionToken) {
        const player = room.reconnect(req.sessionToken, socket.id);
        if (player) {
          socketLocation.set(socket.id, { roomCode: room.roomCode, playerId: player.id });
          socket.join(room.roomCode);
          const res: JoinRoomResponse = { ok: true, sessionToken: player.sessionToken, room: room.toView(player.id) };
          cb(res);
          broadcastRoom(room.roomCode);
          return;
        }
      }

      if (!req.name?.trim()) throw new RoomError('Name tag is required.');
      const player = room.addPlayer(req.name.trim(), socket.id);
      socketLocation.set(socket.id, { roomCode: room.roomCode, playerId: player.id });
      socket.join(room.roomCode);
      const res: JoinRoomResponse = { ok: true, sessionToken: player.sessionToken, room: room.toView(player.id) };
      cb(res);
      broadcastRoom(room.roomCode);
    } catch (err) {
      cb(errorResponse(err, { roomCode: req.roomCode }));
    }
  });

  socket.on('start_game', (cb) => {
    withRoom(socket.id, cb, (room, playerId) => {
      room.startGame(playerId);
      cb({ ok: true });
    });
  });

  socket.on('kick_player', (req, cb) => {
    withRoom(socket.id, cb, (room, playerId) => {
      const target = room.playerList.find((p) => p.id === req.playerId);
      room.kickPlayer(playerId, req.playerId);
      cb({ ok: true });
      if (target?.socketId) {
        io.to(target.socketId).emit('kicked');
        socketLocation.delete(target.socketId);
      }
      broadcastRoom(room.roomCode);
    });
  });

  socket.on('vote_role', (req: VoteRoleRequest) => {
    const loc = socketLocation.get(socket.id);
    if (!loc) return;
    const room = rooms.get(loc.roomCode);
    room?.voteRole(loc.playerId, req.role);
  });

  socket.on('set_secret_code', (req: SetSecretCodeRequest, cb) => {
    withRoom(socket.id, cb, (room, playerId) => {
      room.setSecretCode(playerId, req.code);
      cb({ ok: true });
    });
  });

  socket.on('submit_guess', (req: SubmitGuessRequest, cb) => {
    withRoom(socket.id, cb, (room, playerId) => {
      room.submitGuess(playerId, req.guess);
      cb({ ok: true });
    });
  });

  socket.on('play_again', (cb) => {
    withRoom(socket.id, cb, (room, playerId) => {
      room.playAgain(playerId);
      cb({ ok: true });
    });
  });

  socket.on('leave_room', () => {
    const loc = socketLocation.get(socket.id);
    if (!loc) return;
    rooms.get(loc.roomCode)?.markDisconnected(socket.id);
    broadcastRoom(loc.roomCode);
    socketLocation.delete(socket.id);
  });

  socket.on('disconnect', () => {
    const loc = socketLocation.get(socket.id);
    if (!loc) return;
    rooms.get(loc.roomCode)?.markDisconnected(socket.id);
    broadcastRoom(loc.roomCode);
    socketLocation.delete(socket.id);
  });

  function withRoom(
    socketId: string,
    cb: (res: { ok: true } | ErrorResponse) => void,
    fn: (room: Room, playerId: string) => void,
  ): void {
    const loc = socketLocation.get(socketId);
    if (!loc) {
      cb({ ok: false, message: 'Not in a room.' });
      return;
    }
    const room = rooms.get(loc.roomCode);
    if (!room) {
      cb({ ok: false, message: 'Room no longer exists.' });
      return;
    }
    try {
      fn(room, loc.playerId);
    } catch (err) {
      cb(errorResponse(err, { roomCode: loc.roomCode, playerId: loc.playerId }));
    }
  }
});

function errorResponse(err: unknown, context: Record<string, string> = {}): ErrorResponse {
  const message = err instanceof Error ? err.message : 'Unexpected error.';
  trackException(err, context);
  return { ok: false, message };
}
