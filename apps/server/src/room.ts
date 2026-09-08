import type { GameSettings, GameStatus, PegColorId, Role, RoundEntry } from '@mastermind/shared';
import {
  DIFFICULTIES,
  generateSecretCode,
  pickBotName,
  resolveTimedOutGuess,
  scoreGuess,
} from '@mastermind/shared';
import type { PlayerPublic, RoomStateView } from '@mastermind/shared';
import { randomUUID } from 'node:crypto';

const ROLE_VOTE_SECONDS = 15;
const MAX_HUMANS = 4;

interface PlayerInternal {
  id: string;
  name: string;
  isBot: boolean;
  isHost: boolean;
  role: Role | null;
  connected: boolean;
  sessionToken: string;
  socketId: string | null;
  history: RoundEntry[];
  submittedThisRound: boolean;
  submittedAt: number | null;
}

export class RoomError extends Error {}

export class Room {
  readonly roomCode: string;
  readonly settings: GameSettings;
  hostId: string;
  status: GameStatus = 'lobby';
  round = 1;
  timeLeft = 0;
  roleVoteDeadline: number | null = null;
  secretCode: PegColorId[] | null = null;
  winners: { playerId: string; name: string; round: number; submittedAt: number }[] = [];

  private players = new Map<string, PlayerInternal>();
  private roleVotes = new Map<string, Role>();
  private tickHandle: NodeJS.Timeout | null = null;
  private roleVoteHandle: NodeJS.Timeout | null = null;
  private readonly broadcast: () => void;

  constructor(roomCode: string, settings: GameSettings, broadcast: () => void) {
    this.roomCode = roomCode;
    this.settings = settings;
    this.broadcast = broadcast;
    this.hostId = '';
  }

  get playerList(): PlayerInternal[] {
    return Array.from(this.players.values());
  }

  addPlayer(name: string, socketId: string): PlayerInternal {
    if (this.status !== 'lobby') {
      throw new RoomError('This game has already started.');
    }
    const humanCount = this.playerList.filter((p) => !p.isBot).length;
    if (humanCount >= MAX_HUMANS) {
      throw new RoomError('This room is full.');
    }
    if (this.playerList.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      throw new RoomError('That name is already taken in this room.');
    }
    const player: PlayerInternal = {
      id: randomUUID(),
      name,
      isBot: false,
      isHost: this.players.size === 0,
      role: null,
      connected: true,
      sessionToken: randomUUID(),
      socketId,
      history: [],
      submittedThisRound: false,
      submittedAt: null,
    };
    if (player.isHost) this.hostId = player.id;
    this.players.set(player.id, player);
    return player;
  }

  reconnect(sessionToken: string, socketId: string): PlayerInternal | null {
    const player = this.playerList.find((p) => p.sessionToken === sessionToken);
    if (!player) return null;
    player.connected = true;
    player.socketId = socketId;
    return player;
  }

  getPlayerBySocket(socketId: string): PlayerInternal | undefined {
    return this.playerList.find((p) => p.socketId === socketId);
  }

  markDisconnected(socketId: string): void {
    const player = this.getPlayerBySocket(socketId);
    if (player) {
      player.connected = false;
      player.socketId = null;
    }
  }

  kickPlayer(requesterId: string, targetId: string): void {
    if (requesterId !== this.hostId) throw new RoomError('Only the host can kick players.');
    if (this.status !== 'lobby') throw new RoomError('Cannot kick players after the game has started.');
    this.players.delete(targetId);
  }

  startGame(requesterId: string): void {
    if (requesterId !== this.hostId) throw new RoomError('Only the host can start the game.');
    if (this.status !== 'lobby') throw new RoomError('The game has already started.');

    const humans = this.playerList.filter((p) => !p.isBot);
    if (humans.length === 0) throw new RoomError('Need at least one player to start.');

    if (humans.length === 1) {
      // Solo: the lone human is always Decoder, bot auto-added as Coder.
      humans[0].role = 'decoder';
      this.addBotCoder();
      this.secretCode = generateSecretCode(this.settings.pegCount);
      this.beginRound();
      return;
    }

    this.status = 'role-vote';
    this.roleVoteDeadline = Date.now() + ROLE_VOTE_SECONDS * 1000;
    this.roleVoteHandle = setTimeout(() => this.resolveRoleVote(), ROLE_VOTE_SECONDS * 1000);
    this.broadcast();
  }

  voteRole(playerId: string, role: Role): void {
    if (this.status !== 'role-vote') return;
    this.roleVotes.set(playerId, role);
  }

  private resolveRoleVote(): void {
    if (this.roleVoteHandle) clearTimeout(this.roleVoteHandle);
    this.roleVoteHandle = null;
    this.roleVoteDeadline = null;

    const humans = this.playerList.filter((p) => !p.isBot);
    const wantCoder = humans.filter((p) => this.roleVotes.get(p.id) === 'coder');

    let coder: PlayerInternal | null = null;
    if (wantCoder.length === 1) {
      coder = wantCoder[0];
    } else if (wantCoder.length > 1) {
      coder = wantCoder[Math.floor(Math.random() * wantCoder.length)];
    }

    for (const p of humans) {
      p.role = p.id === coder?.id ? 'coder' : 'decoder';
    }
    this.roleVotes.clear();

    if (!coder) {
      this.addBotCoder();
      this.secretCode = generateSecretCode(this.settings.pegCount);
      this.beginRound();
      return;
    }

    // Human Coder: wait for them to choose the secret code before the round timer starts.
    this.status = 'setting-code';
    this.broadcast();
  }

  setSecretCode(playerId: string, code: PegColorId[]): void {
    if (this.status !== 'setting-code') throw new RoomError('Not waiting on a secret code right now.');
    const player = this.players.get(playerId);
    if (!player || player.role !== 'coder') throw new RoomError('Only the Coder sets the secret code.');
    if (code.length !== this.settings.pegCount) throw new RoomError('Secret code must fill every peg slot.');
    this.secretCode = code;
    this.beginRound();
  }

  private addBotCoder(): void {
    const bot: PlayerInternal = {
      id: randomUUID(),
      name: pickBotName(this.playerList.map((p) => p.name)),
      isBot: true,
      isHost: false,
      role: 'coder',
      connected: true,
      sessionToken: '',
      socketId: null,
      history: [],
      submittedThisRound: false,
      submittedAt: null,
    };
    this.players.set(bot.id, bot);
  }

  private beginRound(): void {
    this.status = 'playing';
    this.round = 1;
    this.startRoundTimer();
    this.broadcast();
  }

  private startRoundTimer(): void {
    this.timeLeft = DIFFICULTIES[this.settings.difficulty].roundSeconds;
    for (const p of this.playerList) {
      p.submittedThisRound = false;
    }
    if (this.tickHandle) clearInterval(this.tickHandle);
    this.tickHandle = setInterval(() => this.tick(), 1000);
  }

  private tick(): void {
    this.timeLeft -= 1;
    if (this.timeLeft <= 0) {
      this.resolveRound();
    } else {
      this.broadcast();
    }
  }

  submitGuess(playerId: string, guess: (PegColorId | null)[]): void {
    if (this.status !== 'playing') throw new RoomError('No round in progress.');
    const player = this.players.get(playerId);
    if (!player || player.role !== 'decoder') throw new RoomError('Only Decoders submit guesses.');
    if (player.submittedThisRound) throw new RoomError('You already submitted this round.');
    if (guess.some((c) => c === null) || guess.length !== this.settings.pegCount) {
      throw new RoomError('Guess must fill every peg slot.');
    }
    this.recordSubmission(player, guess as PegColorId[], false);
    this.broadcast();

    const decoders = this.playerList.filter((p) => p.role === 'decoder');
    if (decoders.every((p) => p.submittedThisRound)) {
      this.resolveRound();
    }
  }

  private recordSubmission(player: PlayerInternal, guess: (PegColorId | null)[], carriedOver: boolean): void {
    const finalGuess = resolveTimedOutGuess(this.settings.pegCount, player.history, guess);
    const isBlank = finalGuess.every((c) => c === null);
    const { exact, colorOnly } = isBlank
      ? { exact: 0, colorOnly: 0 }
      : scoreGuess(this.secretCode as PegColorId[], finalGuess as PegColorId[]);
    player.history.push({
      round: this.round,
      guess: finalGuess,
      exact,
      colorOnly,
      carriedOver,
    });
    player.submittedThisRound = true;
    player.submittedAt = Date.now();
  }

  private resolveRound(): void {
    if (this.tickHandle) clearInterval(this.tickHandle);
    this.tickHandle = null;

    const decoders = this.playerList.filter((p) => p.role === 'decoder');
    for (const p of decoders) {
      if (!p.submittedThisRound) {
        this.recordSubmission(p, new Array(this.settings.pegCount).fill(null), true);
      }
    }

    const maxRounds = DIFFICULTIES[this.settings.difficulty].maxRounds;
    const crackers = decoders.filter((p) => p.history[p.history.length - 1]?.exact === this.settings.pegCount);

    if (crackers.length > 0) {
      this.winners = crackers
        .map((p) => ({
          playerId: p.id,
          name: p.name,
          round: this.round,
          submittedAt: p.submittedAt ?? Date.now(),
        }))
        .sort((a, b) => a.submittedAt - b.submittedAt);
      this.endGame();
      return;
    }

    if (this.round >= maxRounds) {
      this.endGame();
      return;
    }

    this.round += 1;
    this.startRoundTimer();
    this.broadcast();
  }

  private endGame(): void {
    this.status = 'ended';
    if (this.tickHandle) clearInterval(this.tickHandle);
    this.tickHandle = null;
    this.broadcast();
  }

  playAgain(requesterId: string): void {
    if (requesterId !== this.hostId) throw new RoomError('Only the host can start a new game.');
    if (this.status !== 'ended') throw new RoomError('The current game has not ended yet.');
    for (const p of Array.from(this.players.values())) {
      if (p.isBot) {
        this.players.delete(p.id);
      } else {
        p.role = null;
        p.history = [];
        p.submittedThisRound = false;
        p.submittedAt = null;
      }
    }
    this.status = 'lobby';
    this.round = 1;
    this.timeLeft = 0;
    this.roleVoteDeadline = null;
    this.secretCode = null;
    this.winners = [];
    this.broadcast();
  }

  destroy(): void {
    if (this.tickHandle) clearInterval(this.tickHandle);
    if (this.roleVoteHandle) clearTimeout(this.roleVoteHandle);
  }

  toView(viewerId: string): RoomStateView {
    const viewer = this.players.get(viewerId);
    const isCoder = viewer?.role === 'coder';

    const players: PlayerPublic[] = this.playerList.map((p) => {
      const base: PlayerPublic = {
        id: p.id,
        name: p.name,
        isBot: p.isBot,
        isHost: p.id === this.hostId,
        role: p.role,
        connected: p.connected,
      };
      const revealAll = this.status === 'ended' || isCoder;
      const isSelf = p.id === viewerId;
      if (revealAll || isSelf) {
        base.history = p.history;
      } else if (p.role === 'decoder') {
        const last = p.history[p.history.length - 1];
        base.latestFeedback = last ? { exact: last.exact, colorOnly: last.colorOnly } : null;
      }
      return base;
    });

    return {
      roomCode: this.roomCode,
      status: this.status,
      settings: this.settings,
      players,
      hostId: this.hostId,
      round: this.round,
      maxRounds: DIFFICULTIES[this.settings.difficulty].maxRounds,
      roundSeconds: DIFFICULTIES[this.settings.difficulty].roundSeconds,
      timeLeft: this.timeLeft,
      roleVoteDeadline: this.roleVoteDeadline,
      secretCode: this.status === 'ended' ? this.secretCode : null,
      winners: this.winners,
      viewerId,
    };
  }
}
