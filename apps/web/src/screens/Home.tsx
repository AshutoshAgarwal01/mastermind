import { useMultiplayer } from '../state/useMultiplayer';

export function Home() {
  const { actions } = useMultiplayer();

  return (
    <section className="screen screen--home">
      <h1>Mastermind</h1>
      <div className="home-actions">
        <button type="button" className="btn btn--primary" onClick={() => actions.goTo('create')}>
          Create Game
        </button>
        <button type="button" className="btn" onClick={() => actions.goTo('join')}>
          Join Game
        </button>
        <button type="button" className="btn" onClick={() => actions.goTo('how-to')}>
          How to Play
        </button>
      </div>
      <button
        type="button"
        className="icon-btn settings-entry"
        aria-label="Settings"
        onClick={() => actions.goTo('settings')}
      >
        ⚙
      </button>
    </section>
  );
}
