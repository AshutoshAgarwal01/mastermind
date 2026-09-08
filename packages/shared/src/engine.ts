import type { Difficulty, PegColorId, RoundEntry } from './types.js';

export const DIFFICULTIES: Record<Difficulty, { label: string; roundSeconds: number; maxRounds: number }> = {
  easy: { label: 'Easy', roundSeconds: 60, maxRounds: 12 },
  moderate: { label: 'Moderate', roundSeconds: 45, maxRounds: 10 },
  impossible: { label: 'Impossible', roundSeconds: 20, maxRounds: 8 },
};

export const PEG_COLORS: { id: PegColorId; label: string; hex: string; symbol: string }[] = [
  { id: 'red', label: 'Red', hex: '#e5484d', symbol: '●' },
  { id: 'blue', label: 'Blue', hex: '#3b82f6', symbol: '■' },
  { id: 'green', label: 'Green', hex: '#22c55e', symbol: '▲' },
  { id: 'yellow', label: 'Yellow', hex: '#eab308', symbol: '◆' },
  { id: 'purple', label: 'Purple', hex: '#a855f7', symbol: '★' },
  { id: 'orange', label: 'Orange', hex: '#f97316', symbol: '✚' },
];

export const BOT_NAMES = ['Bob', 'Jeff', 'Smith', 'Adam'];

export function pickBotName(exclude: string[] = []): string {
  const available = BOT_NAMES.filter((n) => !exclude.includes(n));
  const pool = available.length > 0 ? available : BOT_NAMES;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function generateSecretCode(pegCount: number): PegColorId[] {
  const code: PegColorId[] = [];
  for (let i = 0; i < pegCount; i += 1) {
    code.push(PEG_COLORS[Math.floor(Math.random() * PEG_COLORS.length)].id);
  }
  return code;
}

/** Classic Mastermind scoring: exact = right color+position, colorOnly = right color, wrong position. */
export function scoreGuess(secret: PegColorId[], guess: PegColorId[]): { exact: number; colorOnly: number } {
  const secretRemaining: PegColorId[] = [];
  const guessRemaining: PegColorId[] = [];
  let exact = 0;

  for (let i = 0; i < secret.length; i += 1) {
    if (guess[i] === secret[i]) {
      exact += 1;
    } else {
      secretRemaining.push(secret[i]);
      guessRemaining.push(guess[i]);
    }
  }

  let colorOnly = 0;
  const used = new Array(secretRemaining.length).fill(false);
  for (const g of guessRemaining) {
    const idx = secretRemaining.findIndex((s, i) => !used[i] && s === g);
    if (idx !== -1) {
      used[idx] = true;
      colorOnly += 1;
    }
  }

  return { exact, colorOnly };
}

export function resolveTimedOutGuess(
  pegCount: number,
  history: RoundEntry[],
  currentGuess: (PegColorId | null)[],
): (PegColorId | null)[] {
  const isComplete = currentGuess.every((slot) => slot !== null);
  if (isComplete) {
    return currentGuess as PegColorId[];
  }
  const previous = history[history.length - 1];
  // No previous round to carry over (round 1 timed out untouched): show a blank guess, not a fabricated one.
  return previous ? previous.guess : new Array(pegCount).fill(null);
}

export function generateRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // avoid ambiguous chars (I,O,0,1)
  let code = '';
  for (let i = 0; i < 5; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}
