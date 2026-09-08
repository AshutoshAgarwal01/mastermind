import { useEffect } from 'react';
import { useMultiplayer } from '../state/useMultiplayer';

const AUTO_ADVANCE_MS = 3000;

export function RoleReveal() {
  const { state, actions } = useMultiplayer();
  const room = state.room;

  // Round timer is already running server-side, so don't let this screen linger indefinitely.
  useEffect(() => {
    const id = setTimeout(() => actions.acknowledgeRoleReveal(), AUTO_ADVANCE_MS);
    return () => clearTimeout(id);
  }, [actions]);

  if (!room) return null;

  const me = room.players.find((p) => p.id === room.viewerId);
  const coder = room.players.find((p) => p.role === 'coder');
  const amCoder = me?.role === 'coder';
  const codeAlreadySet = room.status === 'playing';

  return (
    <section className="screen screen--role-reveal">
      <h1>Roles Assigned</h1>
      <p>
        You are the <strong>{amCoder ? 'Coder' : 'Decoder'}</strong>.
      </p>
      {!amCoder && coder ? (
        <p>
          <strong>{coder.name}</strong>
          {coder.isBot ? ' (bot)' : ''} is the <strong>Coder</strong>
          {codeAlreadySet ? ' and has set the secret code.' : ' and is about to set the secret code.'}
        </p>
      ) : null}
      {amCoder ? (
        <p>
          {codeAlreadySet
            ? "You've set the secret code — everyone else will now try to crack it."
            : "Next you'll choose the secret code everyone else will try to crack."}
        </p>
      ) : null}
      <button type="button" className="btn btn--primary" onClick={() => actions.acknowledgeRoleReveal()}>
        Continue
      </button>
    </section>
  );
}
