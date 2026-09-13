import { DIFFICULTIES } from '@mastermind/shared';
import { useMultiplayer } from '../state/useMultiplayer';

export function Lobby() {
  const { state, actions } = useMultiplayer();
  const room = state.room;
  if (!room) return null;

  const diff = DIFFICULTIES[room.settings.difficulty];
  const me = room.players.find((p) => p.id === room.viewerId);
  const isHost = me?.id === room.hostId;
  const soloSoFar = room.players.filter((p) => !p.isBot).length === 1;

  return (
    <section className="screen screen--lobby">
      <h1>Lobby 🛎️</h1>

      <div className="room-code">
        <span className="room-code__label">Room code</span>
        <span className="room-code__value">{room.roomCode}</span>
      </div>

      <p className="lobby-meta">
        {diff.label} · {room.settings.pegCount} pegs
      </p>

      <ul className="player-list">
        {room.players.map((p) => (
          <li key={p.id} className="player-list__row">
            <span>
              {p.name}
              {p.id === room.hostId ? ' (Host)' : ''}
              {p.isBot ? ' (Bot)' : ''}
            </span>
            {isHost && p.id !== me?.id ? (
              <button type="button" className="btn btn--kick" onClick={() => actions.kickPlayer(p.id)}>
                Kick
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      {soloSoFar ? <p className="lobby-note">🤖 Solo so far — a bot Coder joins automatically.</p> : null}

      {state.joinError ? <p className="inline-message">{state.joinError}</p> : null}

      <div className="screen-actions">
        <button type="button" className="btn" onClick={() => actions.leaveRoom()}>
          Leave
        </button>
        {isHost ? (
          <button type="button" className="btn btn--primary" onClick={() => actions.startGame()}>
            Start Game
          </button>
        ) : (
          <p>Waiting for host…</p>
        )}
      </div>
    </section>
  );
}
