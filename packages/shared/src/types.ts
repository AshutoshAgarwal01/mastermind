export type Difficulty = 'easy' | 'moderate' | 'impossible';

export type PegColorId = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'orange';

export type PegCount = 4 | 5 | 6;

export interface GameSettings {
  difficulty: Difficulty;
  pegCount: PegCount;
}

export interface RoundEntry {
  round: number;
  guess: (PegColorId | null)[];
  exact: number;
  colorOnly: number;
  /** True when the round's timer ran out before this player submitted anything usable — the
   * guess shown is carried over from a previous round (or blank on round 1). */
  carriedOver: boolean;
  /** True when the round's timer ran out but the player had already fully filled in their
   * current draft — that draft was auto-submitted on their behalf, not carried over. */
  autoSubmitted: boolean;
}

export type GameStatus = 'lobby' | 'role-vote' | 'setting-code' | 'playing' | 'ended';

export type Role = 'coder' | 'decoder';
