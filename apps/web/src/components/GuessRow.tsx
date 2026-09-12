import type { RoundEntry } from '@mastermind/shared';
import { PegSlot } from './PegSlot';

interface GuessRowProps {
  entry: RoundEntry;
}

export function GuessRow({ entry }: GuessRowProps) {
  const pegCount = entry.guess.length;
  const empty = pegCount - entry.exact - entry.colorOnly;
  const carriedLabel = entry.carriedOver
    ? 'Carried over (round timed out)'
    : entry.autoSubmitted
      ? 'Auto-submitted when time ran out'
      : null;

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
        {/* Always reserve the icon's slot (visibility, not mount) so rows without a
            carried-over/auto-submitted icon don't end up with wider pegs than rows that have one. */}
        <span
          className="guess-row__carried"
          style={carriedLabel ? undefined : { visibility: 'hidden' }}
          role={carriedLabel ? 'img' : undefined}
          aria-hidden={carriedLabel ? undefined : true}
          aria-label={carriedLabel ?? undefined}
          title={carriedLabel ?? undefined}
        >
          ⏱
        </span>
      </div>
    </div>
  );
}
