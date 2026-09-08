import { useEffect, useState } from 'react';
import { PEG_COLORS } from '@mastermind/shared';
import type { PegColorId } from '@mastermind/shared';
import { PegSlot } from '../components/PegSlot';
import { ColorPalette } from '../components/ColorPalette';
import { useMultiplayer } from '../state/useMultiplayer';

export function SetSecretCode() {
  const { state, actions } = useMultiplayer();
  const room = state.room;
  const [openSlot, setOpenSlot] = useState<number | null>(null);

  if (!room) return null;
  const me = room.players.find((p) => p.id === room.viewerId);
  const isCoder = me?.role === 'coder';

  if (!isCoder) {
    return (
      <section className="screen screen--setting-code">
        <h1>Setting the Secret Code</h1>
        <p>Waiting for the Coder to choose the secret code…</p>
        <WaitingPegAnimation pegCount={room.settings.pegCount} />
      </section>
    );
  }

  const canSubmit =
    state.currentGuess.length === room.settings.pegCount && state.currentGuess.every((slot) => slot !== null);

  function handleSelect(color: PegColorId) {
    if (openSlot === null) return;
    actions.setPeg(openSlot, color);
    setOpenSlot(null);
  }

  return (
    <section className="screen screen--setting-code">
      <h1>Set the Secret Code</h1>
      <p>
        Choose {room.settings.pegCount} pegs — this is what everyone else will try to crack. Take
        your time; the round timer only starts once you submit.
      </p>

      <div className="guess-row__pegs" style={{ '--peg-count': room.settings.pegCount } as React.CSSProperties}>
        {state.currentGuess.map((color, i) => (
          <PegSlot key={i} colorId={color} onClick={() => setOpenSlot(i)} />
        ))}
      </div>

      <div className="screen-actions">
        <button type="button" className="btn" onClick={() => actions.clearGuess()}>
          Clear
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={!canSubmit}
          onClick={() => actions.submitSecretCode()}
        >
          Set Code
        </button>
      </div>

      {openSlot !== null ? <ColorPalette onSelect={handleSelect} onClose={() => setOpenSlot(null)} /> : null}
    </section>
  );
}

function WaitingPegAnimation({ pegCount }: { pegCount: number }) {
  const [pegs, setPegs] = useState<(PegColorId | null)[]>(new Array(pegCount).fill(null));

  useEffect(() => {
    const id = setInterval(() => {
      setPegs((prev) => {
        const next = [...prev];
        const slot = Math.floor(Math.random() * next.length);
        const isFilled = next[slot] !== null;
        next[slot] = isFilled ? null : PEG_COLORS[Math.floor(Math.random() * PEG_COLORS.length)].id;
        return next;
      });
    }, 400);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="guess-row__pegs waiting-pegs"
      aria-hidden="true"
      style={{ '--peg-count': pegCount } as React.CSSProperties}
    >
      {pegs.map((color, i) => (
        <PegSlot key={i} colorId={color} />
      ))}
    </div>
  );
}
