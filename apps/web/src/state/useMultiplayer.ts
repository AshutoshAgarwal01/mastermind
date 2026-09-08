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

export interface MultiplayerState {
  screen: UiScreen;
  theme: Theme;
  colorBlind: boolean;
  playerName: string;
  room: RoomStateView | null;
  joinError: string | null;
  currentGuess: (PegColorId | null)[];
  roleVoteChoice: Role | null;
  showRoleReveal: boolean;
  connecting: boolean;
}

export interface MultiplayerActions {
  goTo: (screen: UiScreen) => void;
  setTheme: (theme: Theme) => void;
  toggleColorBlind: () => void;
  setPlayerName: (name: string) => void;
  createRoom: (name: string, difficulty: Difficulty, pegCount: PegCount) => Promise<void>;
  joinRoom: (roomCode: string, name: string) => Promise<void>;
  startGame: () => Promise<void>;
  kickPlayer: (playerId: string) => Promise<void>;
  voteRole: (role: Role) => void;
  setPeg: (index: number, color: PegColorId) => void;
  clearGuess: () => void;
  submitGuess: () => Promise<void>;
  submitSecretCode: () => Promise<void>;
  acknowledgeRoleReveal: () => void;
  playAgain: () => Promise<void>;
  leaveRoom: () => void;
}

export const MultiplayerContext = createContext<{ state: MultiplayerState; actions: MultiplayerActions } | null>(
  null,
);

export function useMultiplayer() {
  const ctx = useContext(MultiplayerContext);
  if (!ctx) throw new Error('useMultiplayer must be used within a MultiplayerProvider');
  return ctx;
}
