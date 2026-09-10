import { useState } from 'react';
import type { RoundEntry } from '@mastermind/shared';
import { GuessRow } from '../components/GuessRow';
import { PegSlot } from '../components/PegSlot';
import { useMultiplayer } from '../state/useMultiplayer';

// Picks the closest-miss icon/text for a Decoder who didn't crack it — 3 exact matches or every
// color present (just not all in place) reads as "so close"; 1 or fewer exact reads as a rough
// round; anything else is a solid middle-ground effort. Coders have no guess to grade, so they
// always get the neutral fallback.
function getLossResult(myFinalGuess: RoundEntry | undefined, pegCount: number, isCoder: boolean) {
  if (isCoder || !myFinalGuess) {
    return { icon: '🌟', text: 'Nice try — they cracked your code this time!' };
  }
  const { exact, colorOnly } = myFinalGuess;
  if (exact === 3 || exact + colorOnly === pegCount) {
    return { icon: '😅', text: 'So close! You had the colors — just not quite in the right spots.' };
  }
  if (exact <= 1) {
    return { icon: '👏', text: 'Good effort — that was a tough code to crack!' };
  }
  return { icon: '🌟', text: 'Nice work — you were on the right track!' };
}

export function GameEnd() {
  const { state, actions } = useMultiplayer();
  const room = state.room;
  // Stable per-mount pick so it doesn't change on every re-render while this screen is shown.
  const [crackedEmoji] = useState(() => (Math.random() < 0.5 ? '🎉' : '🎊'));
  if (!room || !room.secretCode) return null;

  const me = room.players.find((p) => p.id === room.viewerId);
  const isHost = me?.id === room.hostId;
  const decoders = room.players.filter((p) => p.role === 'decoder');
  const coder = room.players.find((p) => p.role === 'coder');
  const cracked = room.winners.length > 0;
  const didIWin = me ? (cracked ? room.winners.some((w) => w.playerId === me.id) : me.role === 'coder') : false;
  const myFinalGuess = me?.role === 'decoder' ? me.history?.[me.history.length - 1] : undefined;
  const loseResult = getLossResult(myFinalGuess, room.settings.pegCount, me?.role === 'coder');

  return (
    <section className="screen screen--game-end">
      <h1>{cracked ? `${crackedEmoji} Code Cracked!` : '🔐 Out of rounds'}</h1>

      <div className="result-banner" role="img" aria-label={didIWin ? 'You won!' : loseResult.text}>
        {didIWin ? '🥇' : loseResult.icon}
      </div>
      <p className="result-banner__text">{didIWin ? 'You won!' : loseResult.text}</p>

      <p>Secret code:</p>
      <div className="guess-row__pegs" style={{ '--peg-count': room.secretCode.length } as React.CSSProperties}>
        {room.secretCode.map((color, i) => (
          <PegSlot key={i} colorId={color} />
        ))}
      </div>

      {cracked ? (
        <ol className="winners-list">
          {room.winners.map((w, i) => (
            <li key={w.playerId}>
              <span aria-hidden="true">🥇</span> #{i + 1} {w.name} — cracked it on round {w.round}
            </li>
          ))}
        </ol>
      ) : (
        <p>
          <span aria-hidden="true">🥇</span> {coder?.name ?? 'The Coder'} wins — nobody cracked the code in time.
        </p>
      )}

      <p>Final guesses:</p>
      {decoders.map((p) => {
        const finalGuess = p.history?.[p.history.length - 1];
        if (!finalGuess) return null;
        return (
          <div key={p.id} className="final-guess-row">
            <span className="final-guess-row__name">{p.name}</span>
            <GuessRow entry={finalGuess} />
          </div>
        );
      })}

      <div className="screen-actions">
        {isHost ? (
          <button type="button" className="btn" onClick={() => actions.playAgain()}>
            Play Again
          </button>
        ) : null}
        <button type="button" className="btn btn--primary" onClick={() => actions.leaveRoom()}>
          Return to Home
        </button>
      </div>
    </section>
  );
}
