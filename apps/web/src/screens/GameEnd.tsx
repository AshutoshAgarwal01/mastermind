import { GuessRow } from '../components/GuessRow';
import { PegSlot } from '../components/PegSlot';
import { useMultiplayer } from '../state/useMultiplayer';

export function GameEnd() {
  const { state, actions } = useMultiplayer();
  const room = state.room;
  if (!room || !room.secretCode) return null;

  const me = room.players.find((p) => p.id === room.viewerId);
  const isHost = me?.id === room.hostId;
  const decoders = room.players.filter((p) => p.role === 'decoder');
  const cracked = room.winners.length > 0;

  return (
    <section className="screen screen--game-end">
      <h1>{cracked ? 'Code Cracked!' : 'Out of rounds'}</h1>

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
              #{i + 1} {w.name} — cracked it on round {w.round}
            </li>
          ))}
        </ol>
      ) : (
        <p>Nobody cracked the code in time — the Coder wins.</p>
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
