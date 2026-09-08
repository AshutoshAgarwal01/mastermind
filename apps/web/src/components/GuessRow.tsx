import type { RoundEntry } from '@mastermind/shared';
import { PegSlot } from './PegSlot';

interface GuessRowProps {
  entry: RoundEntry;
}

export function GuessRow({ entry }: GuessRowProps) {
  const pegCount = entry.guess.length;
  const empty = pegCount - entry.exact - entry.colorOnly;

  return (
    <div className="guess-row" style={{ '--peg-count': pegCount } as React.CSSProperties}>
      <div className="guess-row__main">
        <span className="guess-row__round" aria-label={`Round ${entry.round}`}>{entry.round}</span>
        <div className="guess-row__pegs">
          {entry.guess.map((color, i) => (
            <PegSlot key={i} colorId={color} />
          ))}
        </div>
      </div>
      <div className="guess-row__meta">
        <div className="guess-row__feedback" aria-label={`${entry.exact} correct position, ${entry.colorOnly} correct color`}>
          {Array.from({ length: entry.exact }).map((_, i) => (
            <span key={`exact-${i}`} className="feedback-dot feedback-dot--exact" />
          ))}
          {Array.from({ length: entry.colorOnly }).map((_, i) => (
            <span key={`color-${i}`} className="feedback-dot feedback-dot--color" />
          ))}
          {Array.from({ length: empty }).map((_, i) => (
            <span key={`empty-${i}`} className="feedback-dot feedback-dot--empty" />
          ))}
        </div>
        {entry.carriedOver ? (
          <span
            className="guess-row__carried"
            role="img"
            aria-label="Carried over (round timed out)"
            title="Carried over (round timed out)"
          >
            ⏱
          </span>
        ) : null}
      </div>
    </div>
  );
}
