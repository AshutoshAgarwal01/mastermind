import type { Difficulty, GameSettings, GameStatus, PegColorId, PegCount, Role, RoundEntry } from './types.js';

export interface PlayerPublic {
  id: string;
  name: string;
  isBot: boolean;
  isHost: boolean;
  role: Role | null;
  connected: boolean;
  /** Only ever populated for the viewer's own player or, for the Coder, every player. */
  history?: RoundEntry[];
  /** Latest round's exact/colorOnly only — sent to other Decoders instead of full history. */
  latestFeedback?: { exact: number; colorOnly: number } | null;
}

export interface RoomStateView {
  roomCode: string;
  status: GameStatus;
  settings: GameSettings;
  players: PlayerPublic[];
  hostId: string;
  round: number;
  maxRounds: number;
  roundSeconds: number;
  timeLeft: number;
  roleVoteDeadline: number | null;
  secretCode: PegColorId[] | null; // only ever sent when status is 'ended'
  winners: { playerId: string; name: string; round: number; submittedAt: number }[];
  /** The viewer's own player id, so the client knows which entry is "me". */
  viewerId: string;
}

export interface CreateRoomRequest {
  name: string;
  difficulty: Difficulty;
  pegCount: PegCount;
}

export interface JoinRoomRequest {
  roomCode: string;
  name: string;
  /** Present when attempting to reconnect to a seat already held under this name. */
  sessionToken?: string;
}

export interface JoinRoomResponse {
  ok: true;
  sessionToken: string;
  room: RoomStateView;
}

export interface ErrorResponse {
  ok: false;
  message: string;
}

export interface SubmitGuessRequest {
  guess: PegColorId[];
}

export interface SetSecretCodeRequest {
  code: PegColorId[];
}

export interface VoteRoleRequest {
  role: Role;
}
