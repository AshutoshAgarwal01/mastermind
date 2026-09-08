import { DIFFICULTIES } from '@mastermind/shared';
import { useMultiplayer } from '../state/useMultiplayer';

export function Lobby() {
  const { state, actions } = useMultiplayer();
  const room = state.room;
  if (!room) return null;

  const diff = DIFFICULTIES[room.settings.difficulty];
  const me = room.players.find((p) => p.id === room.viewerId);
  const isHost = me?.id === room.hostId;

  return (
    <section className="screen screen--lobby">
      <h1>Lobby</h1>
      <p className="room-code">
        Room code: <strong>{room.roomCode}</strong>
      </p>
      <p>
        Difficulty: <strong>{diff.label}</strong> ({diff.roundSeconds}s / round, {diff.maxRounds} rounds
        max) &middot; Pegs: <strong>{room.settings.pegCount}</strong>
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

      {room.players.filter((p) => !p.isBot).length === 1 ? (
        <p className="lobby-note">
          Only one human player has joined — a bot Coder will automatically take the Coder role, and
          you'll be the Decoder.
        </p>
      ) : null}

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
          <p>Waiting for the host to start the game…</p>
        )}
      </div>
    </section>
  );
}
