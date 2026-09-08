interface TimerBarProps {
  secondsLeft: number;
  totalSeconds: number;
  label: string;
  /** Sub-second countdown to display once time is low (falls back to whole `secondsLeft`). */
  preciseSeconds?: number;
}

export function TimerBar({ secondsLeft, totalSeconds, label, preciseSeconds }: TimerBarProps) {
  const pct = totalSeconds > 0 ? Math.max(0, Math.min(100, (secondsLeft / totalSeconds) * 100)) : 0;
  const low = totalSeconds > 0 && secondsLeft <= totalSeconds * 0.25;
  const display = low && preciseSeconds !== undefined ? preciseSeconds.toFixed(2) : secondsLeft;

  return (
    <div className="timer-row">
      <div
        className="timer-bar"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={totalSeconds}
        aria-valuenow={secondsLeft}
      >
        <div className={`timer-bar__fill${low ? ' timer-bar__fill--low' : ''}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`timer${low ? ' timer--low' : ''}`}>{display}s</span>
    </div>
  );
}
