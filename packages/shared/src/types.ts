export type Difficulty = 'easy' | 'moderate' | 'impossible';

export type PegColorId = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'orange';

export type PegCount = 4 | 6 | 8;

export interface GameSettings {
  difficulty: Difficulty;
  pegCount: PegCount;
}

export interface RoundEntry {
  round: number;
  guess: (PegColorId | null)[];
  exact: number;
  colorOnly: number;
  carriedOver: boolean;
}

export type GameStatus = 'lobby' | 'role-vote' | 'setting-code' | 'playing' | 'ended';

export type Role = 'coder' | 'decoder';
