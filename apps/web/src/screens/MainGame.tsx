import { useEffect, useRef, useState } from 'react';
import { PEG_COLORS } from '@mastermind/shared';
import type { PegColorId, PlayerPublic } from '@mastermind/shared';
import { GuessRow } from '../components/GuessRow';
import { PegSlot } from '../components/PegSlot';
import { ColorPalette } from '../components/ColorPalette';
import { TimerBar } from '../components/TimerBar';
import { useMultiplayer } from '../state/useMultiplayer';

export function MainGame() {
  const { state, actions } = useMultiplayer();
  const room = state.room;
  const [selectedColor, setSelectedColor] = useState<PegColorId>(PEG_COLORS[0].id);
  const [hintMode, setHintMode] = useState(false);
  const [hintedPegIndex, setHintedPegIndex] = useState<number | null>(null);
  const [showLegend, setShowLegend] = useState(false);
  const [previewAllRounds, setPreviewAllRounds] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const tickTimeRef = useRef(0);
  const prevHintRoundRef = useRef<number | null>(null);
  // Tracks a pending single-tap recolor on a filled peg, so a second tap on the same peg
  // within the window can cancel it and toggle the lock instead (see handlePegClick).
  const pegTapRef = useRef<{ index: number | null; timer: ReturnType<typeof setTimeout> | null }>({
    index: null,
    timer: null,
  });
  const [preciseSeconds, setPreciseSeconds] = useState(0);

  useEffect(() => {
    // Scroll the last real row into view rather than to the container's raw scrollHeight —
    // keeps the newest round visible even when the board needs to scroll.
    boardRef.current?.lastElementChild?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [room?.round]);

  // A new round means a fresh draft guess — any hint-mode/glow state from the last round is
  // stale, and the color selection resets back to the first swatch.
  useEffect(() => {
    if (room?.round !== undefined && room.round !== prevHintRoundRef.current) {
      prevHintRoundRef.current = room.round;
      setHintMode(false);
      setHintedPegIndex(null);
      setSelectedColor(PEG_COLORS[0].id);
    }
  }, [room?.round]);

  useEffect(() => {
    tickTimeRef.current = Date.now();
  }, [room?.timeLeft]);

  // Cancel any pending single-tap-recolor timer on unmount so it never fires after the
  // component (or the whole game) is gone.
  useEffect(() => {
    return () => {
      if (pegTapRef.current.timer) clearTimeout(pegTapRef.current.timer);
    };
  }, []);

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

  // Reached via the GameEnd screen's "Review Game" button once the room is 'ended' — read-only,
  // no timer/submitting/hints, just the board as it was left.
  const isReview = room.status === 'ended';
  const isCoder = me.role === 'coder';
  const canSubmit =
    state.currentGuess.length === room.settings.pegCount && state.currentGuess.every((slot) => slot !== null);
  const alreadySubmitted = me.history?.[me.history.length - 1]?.round === room.round;
  const hintUsedByMe = !!me.hintUsed;
  const showHintIcon = !isReview && !isCoder && (hintUsedByMe || !alreadySubmitted);
  const hintClickable = !isCoder && !hintUsedByMe && !alreadySubmitted;

  function handleSelectColor(color: PegColorId) {
    setSelectedColor(color);
  }

  function handlePegClick(index: number) {
    if (hintMode) {
      setHintMode(false);
      actions.requestHint(index).then((color) => {
        if (color) setHintedPegIndex(index);
      });
      return;
    }

    // Locking only applies to already-filled pegs, and only via a double-tap — a plain single
    // tap on an empty slot should recolor it immediately, no disambiguation needed.
    if (state.currentGuess[index] === null) {
      actions.setPeg(index, selectedColor);
      return;
    }

    const pending = pegTapRef.current;
    if (pending.index === index && pending.timer) {
      // Second tap within the window on the same peg — treat as a double-tap: cancel the
      // pending recolor from the first tap and toggle the lock instead.
      clearTimeout(pending.timer);
      pegTapRef.current = { index: null, timer: null };
      actions.toggleLockedPeg(index);
      return;
    }

    if (pending.timer) clearTimeout(pending.timer);
    const timer = setTimeout(() => {
      actions.setPeg(index, selectedColor);
      pegTapRef.current = { index: null, timer: null };
    }, 300);
    pegTapRef.current = { index, timer };
  }

  function handleLeave() {
    if (isReview) {
      actions.exitGameReview();
      return;
    }
    // window.confirm() is a blocking native dialog that can be unreliable/unresponsive in
    // embedded webviews and PWA contexts — use an in-app confirm instead.
    setShowLeaveConfirm(true);
  }

  return (
    <section className="screen screen--game">
      <header className="game-header">
        <span className="round-indicator" aria-label={`Round ${room.round} of ${room.maxRounds}`}>
          <span className="round-indicator__badge">{room.round}</span>
          <span className="round-indicator__total">/{room.maxRounds}</span>
        </span>
        <div className="game-header__actions">
          {!isCoder ? (
            <button
              type="button"
              className="info-btn"
              onClick={() => setShowLegend((prev) => !prev)}
              aria-pressed={showLegend}
              aria-label={showLegend ? 'Hide feedback legend' : 'Show feedback legend'}
              title={showLegend ? 'Hide feedback legend' : 'Show feedback legend'}
            >
              ⓘ
            </button>
          ) : null}
          {import.meta.env.DEV && !isCoder && !isReview ? (
            <button
              type="button"
              className="info-btn"
              onClick={() => setPreviewAllRounds((prev) => !prev)}
              aria-pressed={previewAllRounds}
              aria-label={previewAllRounds ? 'Exit round-layout preview' : 'Preview all rounds (testing)'}
              title={previewAllRounds ? 'Exit round-layout preview' : 'Preview all rounds (testing)'}
            >
              🧪
            </button>
          ) : null}
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
            className={`icon-btn btn--leave${isReview ? ' btn--back' : ''}`}
            onClick={handleLeave}
            aria-label={isReview ? 'Back to Results' : 'Leave Game'}
            title={isReview ? 'Back to Results' : 'Leave Game'}
          >
            {isReview ? '➜' : '❌'}
          </button>
        </div>
      </header>

      {!isReview ? (
        <TimerBar
          secondsLeft={room.timeLeft}
          totalSeconds={room.roundSeconds}
          label="Round time remaining"
          preciseSeconds={preciseSeconds}
        />
      ) : null}

      {isCoder ? (
        <CoderBoards players={room.players} round={room.round} pegCount={room.settings.pegCount} />
      ) : (
        <>
          <div className="guess-board" ref={boardRef}>
            {previewAllRounds && !isReview ? (
              Array.from({ length: room.maxRounds }).map((_, i) => (
                <div key={i} className="guess-row guess-row--current" style={{ '--peg-count': room.settings.pegCount } as React.CSSProperties}>
                  <div className="guess-row__main">
                    <span className="guess-row__round" aria-label={`Round ${i + 1}`}>
                      {i + 1}
                    </span>
                    <div className="guess-row__pegs">
                      {Array.from({ length: room.settings.pegCount }).map((_, j) => (
                        <PegSlot key={j} colorId={null} />
                      ))}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <>
                {(me.history ?? []).map((entry, i, history) => (
                  <GuessRow
                    key={entry.round}
                    entry={entry}
                    lockedPegs={isReview && i === history.length - 1 ? state.lockedPegs : undefined}
                  />
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
                            locked={!!state.lockedPegs[i]}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>

          <DecoderSidebar players={room.players} viewerId={room.viewerId} />

          {showLegend ? (
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
              <span>🔒 Double tap to lock/unlock</span>
            </div>
          ) : null}

          {!isReview ? (
            <>
              <div className="screen-actions">
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={!canSubmit || alreadySubmitted}
                  onClick={() => actions.submitGuess()}
                >
                  {alreadySubmitted ? 'Waiting…' : 'Submit'}
                </button>
              </div>

              <ColorPalette selectedColor={selectedColor} onSelectColor={handleSelectColor} />
            </>
          ) : null}
        </>
      )}

      {!isReview && showLeaveConfirm ? (
        <div className="confirm-dialog-backdrop" onClick={() => setShowLeaveConfirm(false)}>
          <div
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-label="Leave the game?"
            onClick={(e) => e.stopPropagation()}
          >
            <p>Leave the game? Your progress will be lost.</p>
            <div className="confirm-dialog__actions">
              <button type="button" className="btn" onClick={() => setShowLeaveConfirm(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn--primary" onClick={() => actions.leaveRoom()}>
                Leave
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
