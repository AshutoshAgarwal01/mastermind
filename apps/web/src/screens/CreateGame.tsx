import { useState } from 'react';
import { DIFFICULTIES } from '@mastermind/shared';
import type { Difficulty, PegCount } from '@mastermind/shared';
import { useMultiplayer } from '../state/useMultiplayer';

const DIFFICULTY_OPTIONS: Difficulty[] = ['easy', 'moderate', 'impossible'];
const PEG_OPTIONS: PegCount[] = [4, 5, 6];

export function CreateGame() {
  const { state, actions } = useMultiplayer();
  const [name, setName] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('moderate');
  const [pegCount, setPegCount] = useState<PegCount>(4);

  async function handleCreate() {
    if (!name.trim()) return;
    await actions.createRoom(name.trim(), difficulty, pegCount);
  }

  return (
    <section className="screen screen--create">
      <h1>Create Game</h1>

      <label className="field">
        Your name tag
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} />
      </label>

      <fieldset>
        <legend className="legend-with-info">
          Difficulty
          <button
            type="button"
            className="info-btn"
            onClick={() => actions.goTo('how-to')}
            aria-label="What do the difficulty levels mean? Opens How to Play"
            title="What do the difficulty levels mean?"
          >
            ⓘ
          </button>
        </legend>
        <div className="pill-row">
          {DIFFICULTY_OPTIONS.map((d) => (
            <button
              key={d}
              type="button"
              className={`btn${difficulty === d ? ' btn--primary' : ''}`}
              onClick={() => setDifficulty(d)}
            >
              {DIFFICULTIES[d].label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Peg Count</legend>
        <div className="pill-row">
          {PEG_OPTIONS.map((p) => (
            <button
              key={p}
              type="button"
              className={`peg-count-option${pegCount === p ? ' peg-count-option--selected' : ''}`}
              onClick={() => setPegCount(p)}
              aria-label={`${p} pegs`}
              aria-pressed={pegCount === p}
            >
              <span className="peg-count-option__number">{p}</span>
              <span className="peg-count-option__caption">pegs</span>
            </button>
          ))}
        </div>
      </fieldset>

      {state.joinError ? <p className="inline-message">{state.joinError}</p> : null}

      <div className="screen-actions">
        <button type="button" className="btn" onClick={() => actions.goTo('home')}>
          Back
        </button>
        <button type="button" className="btn btn--primary" disabled={!name.trim() || state.connecting} onClick={handleCreate}>
          Create
        </button>
      </div>
    </section>
  );
}
