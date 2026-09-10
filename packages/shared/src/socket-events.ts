import type {
  CreateRoomRequest,
  ErrorResponse,
  HintResponse,
  JoinRoomRequest,
  JoinRoomResponse,
  RequestHintRequest,
  RoomStateView,
  SetSecretCodeRequest,
  SubmitGuessRequest,
  UpdateDraftRequest,
  VoteRoleRequest,
} from './room.js';

/** Client -> server events. */
export interface ClientToServerEvents {
  create_room: (req: CreateRoomRequest, cb: (res: JoinRoomResponse | ErrorResponse) => void) => void;
  join_room: (req: JoinRoomRequest, cb: (res: JoinRoomResponse | ErrorResponse) => void) => void;
  start_game: (cb: (res: { ok: true } | ErrorResponse) => void) => void;
  kick_player: (req: { playerId: string }, cb: (res: { ok: true } | ErrorResponse) => void) => void;
  vote_role: (req: VoteRoleRequest) => void;
  set_secret_code: (req: SetSecretCodeRequest, cb: (res: { ok: true } | ErrorResponse) => void) => void;
  submit_guess: (req: SubmitGuessRequest, cb: (res: { ok: true } | ErrorResponse) => void) => void;
  update_draft: (req: UpdateDraftRequest) => void;
  request_hint: (req: RequestHintRequest, cb: (res: HintResponse | ErrorResponse) => void) => void;
  play_again: (cb: (res: { ok: true } | ErrorResponse) => void) => void;
  leave_room: () => void;
}

/** Server -> client events. */
export interface ServerToClientEvents {
  room_update: (room: RoomStateView) => void;
  error: (message: string) => void;
  kicked: () => void;
}
