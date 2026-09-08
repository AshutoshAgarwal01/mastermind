import { useEffect, useState } from 'react';
import type { Role } from '@mastermind/shared';
import { TimerBar } from '../components/TimerBar';
import { useMultiplayer } from '../state/useMultiplayer';

// Must match ROLE_VOTE_SECONDS in apps/server/src/room.ts.
const ROLE_VOTE_SECONDS = 15;

export function RoleVote() {
  const { state, actions } = useMultiplayer();
  const room = state.room;
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!room?.roleVoteDeadline) return;
    const id = setInterval(() => {
      setSecondsLeft(Math.max(0, Math.ceil((room.roleVoteDeadline! - Date.now()) / 1000)));
    }, 200);
    return () => clearInterval(id);
  }, [room?.roleVoteDeadline]);

  if (!room) return null;

  function handleVote(role: Role) {
    actions.voteRole(role);
  }

  return (
    <section className="screen screen--role-vote">
      <h1>Choose Your Role</h1>
      <TimerBar secondsLeft={secondsLeft} totalSeconds={ROLE_VOTE_SECONDS} label="Time left to vote" />
      <p>
        Pick <strong>Coder</strong> to set the secret code and watch, or <strong>Decoder</strong> to
        guess it. Not voting defaults to Decoder.
      </p>
      <div className="screen-actions">
        <button
          type="button"
          className={`btn${state.roleVoteChoice === 'coder' ? ' btn--primary' : ''}`}
          onClick={() => handleVote('coder')}
        >
          Coder
        </button>
        <button
          type="button"
          className={`btn${state.roleVoteChoice === 'decoder' ? ' btn--primary' : ''}`}
          onClick={() => handleVote('decoder')}
        >
          Decoder
        </button>
      </div>
      {state.roleVoteChoice ? <p className="lobby-note">You voted: {state.roleVoteChoice}</p> : null}
    </section>
  );
}
