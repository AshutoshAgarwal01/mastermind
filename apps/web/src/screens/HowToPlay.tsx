import { DIFFICULTIES, PEG_COLORS } from '@mastermind/shared';
import type { Difficulty, PegColorId } from '@mastermind/shared';
import { PegSlot } from '../components/PegSlot';
import { useMultiplayer } from '../state/useMultiplayer';

const DIFFICULTY_OPTIONS: Difficulty[] = ['easy', 'moderate', 'impossible'];

const STEPS: { icon: string; title: string; body: string }[] = [
  {
    icon: '🏠',
    title: '1. Create or join a game',
    body: 'Start a new room (pick a difficulty and peg count) or join a friend\u2019s room with their room code.',
  },
  {
    icon: '👥',
    title: '2. Wait in the lobby',
    body: 'Players trickle in and appear in the list. The host kicks anyone if needed, then explicitly starts the game — nothing begins automatically.',
  },
  {
    icon: '🗳️',
    title: '3. Choose your role',
    body: 'With 2+ players, everyone votes Coder or Decoder within 15 seconds. Solo play skips straight to a bot Coder.',
  },
  {
    icon: '🔑',
    title: '4. The Coder sets the secret code',
    body: 'A human Coder picks a color for every peg slot. The round timer only starts once they submit — a bot Coder does this instantly.',
  },
  {
    icon: '🎯',
    title: '5. Decoders guess, round after round',
    body: 'Every Decoder submits one guess per round and immediately sees feedback on it. Miss the timer and your previous guess carries over.',
  },
  {
    icon: '🏆',
    title: '6. The game ends & winners are ranked',
    body: 'The instant someone cracks the code, or the round limit is hit. Crackers are ranked by who submitted first — if nobody cracks it, the Coder wins.',
  },
];

const EXAMPLE_GUESS: PegColorId[] = ['red', 'blue', 'green', 'yellow'];
const EXAMPLE_EXACT = 2;
const EXAMPLE_COLOR_ONLY = 1;

export function HowToPlay() {
  const { actions } = useMultiplayer();
  const exampleEmpty = EXAMPLE_GUESS.length - EXAMPLE_EXACT - EXAMPLE_COLOR_ONLY;

  return (
    <section className="screen screen--how-to">
      <h1>How to Play</h1>
      <p>
        One player is the <strong>Coder</strong> and sets a secret sequence of colored pegs at the
        start of the game. Everyone else is a <strong>Decoder</strong>, trying to crack that code.
      </p>

      <h2>How a game works</h2>
      <ol className="how-to-steps">
        {STEPS.map((step) => (
          <li key={step.title} className="how-to-step">
            <span className="how-to-step__icon" aria-hidden="true">
              {step.icon}
            </span>
            <div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <h2>Picking peg colors</h2>
      <p>
        Tap a color in the drawer at the bottom to select it (it'll highlight), then tap one or
        more empty slots to fill them. There are {PEG_COLORS.length} colors to choose from — the
        same colors are used whether you're the Coder setting the code or a Decoder guessing it.
      </p>
      <div className="peg-swatch-row">
        {PEG_COLORS.map((color) => (
          <div key={color.id} className="peg-swatch">
            <PegSlot colorId={color.id} size="small" />
            <span>{color.label}</span>
          </div>
        ))}
      </div>

      <h2>Reading the feedback</h2>
      <p>
        After you submit a guess, you'll see one feedback dot per peg: <strong>green</strong> means
        a peg is the right color <em>and</em> in the right position; <strong>yellow</strong> means
        the color is somewhere in the code but in the wrong position; a plain dot means no match at
        all. Here's a 4-peg example guess and its feedback:
      </p>
      <div className="example-guess" style={{ '--peg-count': EXAMPLE_GUESS.length } as React.CSSProperties}>
        <div className="guess-row__pegs">
          {EXAMPLE_GUESS.map((color, i) => (
            <PegSlot key={i} colorId={color} />
          ))}
        </div>
        <div
          className="guess-row__feedback"
          aria-label={`${EXAMPLE_EXACT} correct position, ${EXAMPLE_COLOR_ONLY} correct color`}
        >
          {Array.from({ length: EXAMPLE_EXACT }).map((_, i) => (
            <span key={`exact-${i}`} className="feedback-dot feedback-dot--exact" />
          ))}
          {Array.from({ length: EXAMPLE_COLOR_ONLY }).map((_, i) => (
            <span key={`color-${i}`} className="feedback-dot feedback-dot--color" />
          ))}
          {Array.from({ length: exampleEmpty }).map((_, i) => (
            <span key={`empty-${i}`} className="feedback-dot" />
          ))}
        </div>
      </div>
      <div className="feedback-legend">
        <span>
          <span className="feedback-dot feedback-dot--exact" /> correct color &amp; position
        </span>
        <span>
          <span className="feedback-dot feedback-dot--color" /> correct color, wrong position
        </span>
        <span>
          <span className="feedback-dot" /> no match
        </span>
      </div>
      <p>
        You always see your own guesses and feedback in full. For other Decoders you only ever see
        their feedback dot counts — never the actual colors they guessed.
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

      <h2>Good to know</h2>
      <ul className="tips-list">
        <li>
          <span aria-hidden="true">⏱️</span> The round timer never pauses. If every peg is filled
          in when time runs out, that guess is auto-submitted for you; otherwise your previous
          guess carries over instead. Either way, it still counts as a timeout — only submitting
          manually avoids that.
        </li>
        <li>
          <span aria-hidden="true">💡</span> Each Decoder gets one hint per game — tap the bulb
          icon next to the round timer, then tap any peg slot to instantly reveal its correct
          color.
        </li>
        <li>
          <span aria-hidden="true">🔌</span> Lost connection? Your seat is held — reconnect anytime
          with the same room code and name tag to pick up right where you left off.
        </li>
        <li>
          <span aria-hidden="true">🎨</span> Turn on color-blind mode in Settings to add a unique
          shape symbol to every peg color.
        </li>
      </ul>

      <button type="button" className="btn" onClick={() => actions.goTo('home')}>
        Back
      </button>
    </section>
  );
}
