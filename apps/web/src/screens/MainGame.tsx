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
  const me = room?.players.find((p) => p.id === room.viewerId);
  // Derived up here (before the hooks below) so the peg-tap-timer cleanup effect can depend on
  // it directly — this flips true the instant THIS player's own guess is recorded, even in a
  // multiplayer round where other Decoders are still playing and room.round/status haven't
  // changed yet.
  const alreadySubmitted = !!(me?.history?.length && me.history[me.history.length - 1].round === room?.round);
  const [selectedColor, setSelectedColor] = useState<PegColorId>(PEG_COLORS[0].id);
  const [hintMode, setHintMode] = useState(false);
  const [hintedPegIndex, setHintedPegIndex] = useState<number | null>(null);
  const [showLegend, setShowLegend] = useState(false);
  const [previewAllRounds, setPreviewAllRounds] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const leaveDialogRef = useRef<HTMLDivElement>(null);
  const restoreLeaveFocusRef = useRef(true);
  const tickTimeRef = useRef(0);
  const prevHintRoundRef = useRef<number | null>(null);
  // Tracks pending single-tap recolors on filled pegs, keyed by peg index, so a second tap on
  // THAT SAME peg within the window can cancel it and toggle the lock instead (see
  // handlePegClick). Per-index (not a single shared ref) so rapid taps on two DIFFERENT filled
  // pegs each get their own independent timer instead of the second tap cancelling the first's.
  const pegTapTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const [preciseSeconds, setPreciseSeconds] = useState(0);
  const leaveConfirmOpen = room?.status !== 'ended' && showLeaveConfirm;

  useEffect(() => {
    // Scroll the last real row into view rather than to the container's raw scrollHeight —
    // keeps the newest round visible even when the board needs to scroll.
    boardRef.current?.lastElementChild?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [room?.round]);

  // A new round means a fresh draft guess — any hint-mode/glow state from the last round is
  // stale, the color selection resets back to the first swatch, and the dev-only round-layout
  // preview (which replaces the real board entirely) must not survive a real round transition.
  useEffect(() => {
    if (room?.round !== undefined && room.round !== prevHintRoundRef.current) {
      prevHintRoundRef.current = room.round;
      setHintMode(false);
      setHintedPegIndex(null);
      setSelectedColor(PEG_COLORS[0].id);
      setPreviewAllRounds(false);
    }
  }, [room?.round]);

  useEffect(() => {
    tickTimeRef.current = Date.now();
  }, [room?.timeLeft]);

  // Cancel any pending single-tap-recolor timers whenever the round/status changes, or as soon
  // as THIS player's own submission is accepted (MainGame stays mounted across rounds, and in a
  // multiplayer round with several Decoders, this player's submit can leave room.round/status
  // unchanged while others are still playing — without reacting to alreadySubmitted too, a
  // pending timer could still fire post-submit and recolor an already-submitted, possibly
  // locked, peg) or on unmount.
  useEffect(() => {
    const timers = pegTapTimersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, [room?.round, room?.status, alreadySubmitted]);

  useEffect(() => {
    if (!leaveConfirmOpen || !leaveDialogRef.current) return;

    const dialog = leaveDialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const buttons = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
    buttons[0]?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setShowLeaveConfirm(false);
      } else if (event.key === 'Tab' && buttons.length > 0) {
        const firstButton = buttons[0];
        const lastButton = buttons[buttons.length - 1];
        if (!dialog.contains(document.activeElement)) {
          event.preventDefault();
          (event.shiftKey ? lastButton : firstButton).focus();
        } else if (event.shiftKey && document.activeElement === firstButton) {
          event.preventDefault();
          lastButton.focus();
        } else if (!event.shiftKey && document.activeElement === lastButton) {
          event.preventDefault();
          firstButton.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      if (restoreLeaveFocusRef.current && previousFocus?.isConnected) previousFocus.focus();
    };
  }, [leaveConfirmOpen]);

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
  if (!me) return null;

  // Reached via the GameEnd screen's "Review Game" button once the room is 'ended' — read-only,
  // no timer/submitting/hints, just the board as it was left.
  const isReview = room.status === 'ended';
  const isCoder = me.role === 'coder';
  const canSubmit =
    state.currentGuess.length === room.settings.pegCount && state.currentGuess.every((slot) => slot !== null);
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

    const timers = pegTapTimersRef.current;
    const pendingTimer = timers.get(index);
    if (pendingTimer) {
      // Second tap within the window on THIS peg — treat as a double-tap: cancel the pending
      // recolor from the first tap and toggle the lock instead.
      clearTimeout(pendingTimer);
      timers.delete(index);
      actions.toggleLockedPeg(index);
      return;
    }

    const timer = setTimeout(() => {
      actions.setPeg(index, selectedColor);
      timers.delete(index);
    }, 300);
    timers.set(index, timer);
  }

  function handleSubmit() {
    // Don't wait for the server room_update/alreadySubmitted flip to cancel pending timers —
    // if the request takes longer than the 300ms window, a stale timer could still fire after
    // the old guess was already recorded, mutating currentGuess (and, for a locked peg, the
    // value the next round's carry-over reads) out from under the just-submitted guess.
    const timers = pegTapTimersRef.current;
    timers.forEach((timer) => clearTimeout(timer));
    timers.clear();
    actions.submitGuess();
  }

  function handleLeave() {
    if (isReview) {
      actions.exitGameReview();
      return;
    }
    // window.confirm() is a blocking native dialog that can be unreliable/unresponsive in
    // embedded webviews and PWA contexts — use an in-app confirm instead.
    restoreLeaveFocusRef.current = true;
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
                  onClick={handleSubmit}
                >
                  {alreadySubmitted ? 'Waiting…' : 'Submit'}
                </button>
              </div>

              <ColorPalette selectedColor={selectedColor} onSelectColor={handleSelectColor} />
            </>
          ) : null}
        </>
      )}

      {leaveConfirmOpen ? (
        <div className="confirm-dialog-backdrop" onClick={() => setShowLeaveConfirm(false)}>
          <div
            ref={leaveDialogRef}
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
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  restoreLeaveFocusRef.current = false;
                  actions.leaveRoom();
                }}
              >
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
