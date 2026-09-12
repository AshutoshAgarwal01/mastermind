import { createContext, useContext } from 'react';
import type {
  Difficulty,
  PegColorId,
  PegCount,
  Role,
  RoomStateView,
} from '@mastermind/shared';

export type UiScreen = 'home' | 'create' | 'join' | 'how-to' | 'settings';
export type Theme = 'light' | 'dark';
// User-selectable peg visual treatment (see SettingsScreen); 'bordered' ("Bold") is the default.
export type PegStyle = 'classic' | 'flat' | 'glossy' | 'bordered';

export interface MultiplayerState {
  screen: UiScreen;
  theme: Theme;
  colorBlind: boolean;
  pegStyle: PegStyle;
  playerName: string;
  room: RoomStateView | null;
  joinError: string | null;
  currentGuess: (PegColorId | null)[];
  roleVoteChoice: Role | null;
  showRoleReveal: boolean;
  showGameReview: boolean;
  connecting: boolean;
}

export interface MultiplayerActions {
  goTo: (screen: UiScreen) => void;
  setTheme: (theme: Theme) => void;
  toggleColorBlind: () => void;
  setPegStyle: (style: PegStyle) => void;
  setPlayerName: (name: string) => void;
  createRoom: (name: string, difficulty: Difficulty, pegCount: PegCount) => Promise<void>;
  joinRoom: (roomCode: string, name: string) => Promise<void>;
  startGame: () => Promise<void>;
  kickPlayer: (playerId: string) => Promise<void>;
  voteRole: (role: Role) => void;
  setPeg: (index: number, color: PegColorId) => void;
  clearGuess: () => void;
  submitGuess: () => Promise<void>;
  requestHint: (pegIndex: number) => Promise<PegColorId | null>;
  submitSecretCode: () => Promise<void>;
  acknowledgeRoleReveal: () => void;
  playAgain: () => Promise<void>;
  leaveRoom: () => void;
  reviewGame: () => void;
  exitGameReview: () => void;
}

export const MultiplayerContext = createContext<{ state: MultiplayerState; actions: MultiplayerActions } | null>(
  null,
);

export function useMultiplayer() {
  const ctx = useContext(MultiplayerContext);
  if (!ctx) throw new Error('useMultiplayer must be used within a MultiplayerProvider');
  return ctx;
}
