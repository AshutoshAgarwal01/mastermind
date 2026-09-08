import { DIFFICULTIES } from '@mastermind/shared';
import type { Difficulty } from '@mastermind/shared';
import { useMultiplayer } from '../state/useMultiplayer';

const DIFFICULTY_OPTIONS: Difficulty[] = ['easy', 'moderate', 'impossible'];

export function HowToPlay() {
  const { actions } = useMultiplayer();

  return (
    <section className="screen screen--how-to">
      <h1>How to Play</h1>
      <p>
        One player is the <strong>Coder</strong> and sets a secret sequence of colored pegs at the
        start of the game. Everyone else is a <strong>Decoder</strong>, trying to crack that code.
      </p>
      <p>
        Each round, every Decoder submits one guess. After guessing, you'll see feedback: how many
        pegs are the right color in the right position, and how many are the right color but the
        wrong position. You can see your own guesses and feedback, and other players' feedback
        counts — but never their actual guessed colors.
      </p>
      <p>
        If you don't submit a guess before the round timer runs out, your previous guess carries
        over automatically.
      </p>
      <p>
        The game ends when someone cracks the code, or the maximum number of rounds is reached.
        Crackers are ranked by how early they submitted the winning guess. If nobody cracks it, the
        Coder wins.
      </p>

      <h2>Difficulty Levels</h2>
      <ul className="difficulty-list">
        {DIFFICULTY_OPTIONS.map((d) => (
          <li key={d}>
            <strong>{DIFFICULTIES[d].label}</strong> — {DIFFICULTIES[d].roundSeconds}s per round,{' '}
            {DIFFICULTIES[d].maxRounds} rounds max
          </li>
        ))}
      </ul>

      <button type="button" className="btn" onClick={() => actions.goTo('home')}>
        Back
      </button>
    </section>
  );
}
