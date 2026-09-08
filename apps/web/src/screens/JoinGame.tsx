import { useState } from 'react';
import { useMultiplayer } from '../state/useMultiplayer';

export function JoinGame() {
  const { state, actions } = useMultiplayer();
  const [roomCode, setRoomCode] = useState('');
  const [name, setName] = useState('');
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  async function handleJoin() {
    if (!roomCode.trim() || !name.trim()) {
      setValidationMessage('Enter both a room code and a name tag.');
      return;
    }
    setValidationMessage(null);
    await actions.joinRoom(roomCode, name.trim());
  }

  return (
    <section className="screen screen--join">
      <h1>Join Game</h1>
      <label className="field">
        Room code
        <input value={roomCode} onChange={(e) => setRoomCode(e.target.value)} maxLength={5} />
      </label>
      <label className="field">
        Name tag
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} />
      </label>
      {validationMessage ? <p className="inline-message">{validationMessage}</p> : null}
      {state.joinError ? <p className="inline-message">{state.joinError}</p> : null}
      <div className="screen-actions">
        <button type="button" className="btn" onClick={() => actions.goTo('home')}>
          Back
        </button>
        <button type="button" className="btn btn--primary" disabled={state.connecting} onClick={handleJoin}>
          Join
        </button>
      </div>
    </section>
  );
}
