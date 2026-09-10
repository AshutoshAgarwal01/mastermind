import { useEffect, useRef, useState } from 'react';
import type { PegColorId, PlayerPublic } from '@mastermind/shared';
import { GuessRow } from '../components/GuessRow';
import { PegSlot } from '../components/PegSlot';
import { ColorPalette } from '../components/ColorPalette';
import { TimerBar } from '../components/TimerBar';
import { useMultiplayer } from '../state/useMultiplayer';

export function MainGame() {
  const { state, actions } = useMultiplayer();
  const room = state.room;
  const [openSlot, setOpenSlot] = useState<number | null>(null);
  const [hintMode, setHintMode] = useState(false);
  const [hintedPegIndex, setHintedPegIndex] = useState<number | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const tickTimeRef = useRef(0);
  const prevHintRoundRef = useRef<number | null>(null);
  const [preciseSeconds, setPreciseSeconds] = useState(0);

  useEffect(() => {
    boardRef.current?.scrollTo({ top: boardRef.current.scrollHeight, behavior: 'smooth' });
  }, [room?.round]);

  // A new round means a fresh draft guess — any hint-mode/glow state (and any color palette left
  // open when the previous round timed out) from the last round is stale.
  useEffect(() => {
    if (room?.round !== undefined && room.round !== prevHintRoundRef.current) {
      prevHintRoundRef.current = room.round;
      setHintMode(false);
      setHintedPegIndex(null);
      setOpenSlot(null);
    }
  }, [room?.round]);

  useEffect(() => {
    tickTimeRef.current = Date.now();
  }, [room?.timeLeft]);

  useEffect(() => {
    if (!room) return;
    if (room.timeLeft > room.roundSeconds * 0.25) return;
    const id = setInterval(() => {
      const elapsed = (Date.now() - tickTimeRef.current) / 1000;
      setPreciseSeconds(Math.max(0, room.timeLeft - elapsed));
    }, 33);
    return () => clearInterval(id);
  }, [room]);

  if (!room) return null;
  const me = room.players.find((p) => p.id === room.viewerId);
  if (!me) return null;

  const isCoder = me.role === 'coder';
  const canSubmit =
    state.currentGuess.length === room.settings.pegCount && state.currentGuess.every((slot) => slot !== null);
  const alreadySubmitted = me.history?.[me.history.length - 1]?.round === room.round;
  const hintUsedByMe = !!me.hintUsed;
  const showHintIcon = !isCoder && (hintUsedByMe || !alreadySubmitted);
  const hintClickable = !isCoder && !hintUsedByMe && !alreadySubmitted;

  function handleSelect(color: PegColorId) {
    if (openSlot === null) return;
    actions.setPeg(openSlot, color);
    setOpenSlot(null);
  }

  function handlePegClick(index: number) {
    if (hintMode) {
      setHintMode(false);
      actions.requestHint(index).then((color) => {
        if (color) setHintedPegIndex(index);
      });
      return;
    }
    setOpenSlot(index);
  }

  function handleLeave() {
    if (window.confirm('Leave the game? Your progress will be lost.')) {
      actions.leaveRoom();
    }
  }

  return (
    <section className="screen screen--game">
      <header className="game-header">
        <span className="round-indicator" aria-label={`Round ${room.round} of ${room.maxRounds}`}>
          <span className="round-indicator__badge">{room.round}</span>
          <span className="round-indicator__total">/{room.maxRounds}</span>
        </span>
        <div className="game-header__actions">
          {showHintIcon ? (
            <button
              type="button"
              className={`icon-btn${hintMode ? ' icon-btn--active' : ''}${hintUsedByMe ? ' icon-btn--used' : ''}`}
              onClick={hintClickable ? () => setHintMode((prev) => !prev) : undefined}
              disabled={!hintClickable}
              aria-label={hintUsedByMe ? 'Hint already used' : hintMode ? 'Cancel hint' : 'Use hint'}
              title={hintUsedByMe ? 'Hint already used' : hintMode ? 'Cancel hint' : 'Use hint'}
            >
              💡
            </button>
          ) : null}
          <button
            type="button"
            className="icon-btn btn--leave"
            onClick={handleLeave}
            aria-label="Leave Game"
            title="Leave Game"
          >
            ✕
          </button>
        </div>
      </header>

      <TimerBar
        secondsLeft={room.timeLeft}
        totalSeconds={room.roundSeconds}
        label="Round time remaining"
        preciseSeconds={preciseSeconds}
      />

      {isCoder ? (
        <CoderBoards players={room.players} round={room.round} pegCount={room.settings.pegCount} />
      ) : (
        <>
          <div className="guess-board" ref={boardRef}>
            {(me.history ?? []).map((entry) => (
              <GuessRow key={entry.round} entry={entry} />
            ))}

            {!alreadySubmitted ? (
              <div
                className="guess-row guess-row--current"
                style={{ '--peg-count': state.currentGuess.length } as React.CSSProperties}
              >
                <div className="guess-row__main">
                  <span className="guess-row__round" aria-label={`Round ${room.round}`}>
                    {room.round}
                  </span>
                  <div className="guess-row__pegs">
                    {state.currentGuess.map((color, i) => (
                      <PegSlot
                        key={i}
                        colorId={color}
                        onClick={() => handlePegClick(i)}
                        glow={hintMode || hintedPegIndex === i}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <DecoderSidebar players={room.players} viewerId={room.viewerId} />

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

          <div className="screen-actions">
            <button
              type="button"
              className="btn btn--primary"
              disabled={!canSubmit || alreadySubmitted}
              onClick={() => actions.submitGuess()}
            >
              {alreadySubmitted ? 'Submitted — waiting…' : 'Submit'}
            </button>
          </div>

          {openSlot !== null ? <ColorPalette onSelect={handleSelect} onClose={() => setOpenSlot(null)} /> : null}
        </>
      )}
    </section>
  );
}

function DecoderSidebar({ players, viewerId }: { players: PlayerPublic[]; viewerId: string }) {
  const others = players.filter((p) => p.id !== viewerId && p.role === 'decoder');
  if (others.length === 0) return null;
  return (
    <div className="decoder-sidebar">
      {others.map((p) => (
        <div key={p.id} className="decoder-sidebar__row">
          <span>
            {p.name}
            {!p.connected ? ' (disconnected)' : ''}
          </span>
          <span
            className="decoder-sidebar__feedback"
            aria-label={
              p.latestFeedback
                ? `${p.latestFeedback.exact} correct position, ${p.latestFeedback.colorOnly} correct color`
                : 'no guess yet'
            }
          >
            {p.latestFeedback ? (
              <>
                {Array.from({ length: p.latestFeedback.exact }).map((_, i) => (
                  <span key={`exact-${i}`} className="feedback-dot feedback-dot--exact" />
                ))}
                {Array.from({ length: p.latestFeedback.colorOnly }).map((_, i) => (
                  <span key={`color-${i}`} className="feedback-dot feedback-dot--color" />
                ))}
              </>
            ) : (
              'no guess yet'
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

function CoderBoards({
  players,
  round,
  pegCount,
}: {
  players: PlayerPublic[];
  round: number;
  pegCount: number;
}) {
  const decoders = players.filter((p) => p.role === 'decoder');
  return (
    <div className="coder-grid">
      {decoders.map((p) => {
        const alreadySubmitted = p.history?.[p.history.length - 1]?.round === round;
        return (
          <div key={p.id} className="coder-grid__board">
            <h3>
              {p.name}
              {!p.connected ? ' (disconnected)' : ''}
            </h3>
            <div className="guess-board">
              {(p.history ?? []).map((entry) => (
                <GuessRow key={entry.round} entry={entry} />
              ))}

              {!alreadySubmitted ? (
                <div
                  className="guess-row guess-row--current"
                  style={{ '--peg-count': pegCount } as React.CSSProperties}
                >
                  <div className="guess-row__main">
                    <span
                      className={`guess-row__round${!alreadySubmitted ? ' guess-row__round--live' : ''}`}
                      aria-label={`Round ${round} (in progress)`}
                    >
                      {round}
                    </span>
                    <div className="guess-row__pegs">
                      {Array.from({ length: pegCount }).map((_, i) => (
                        <PegSlot key={i} colorId={null} />
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
