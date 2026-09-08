import { useMultiplayer } from '../state/useMultiplayer';

export function SettingsScreen() {
  const { state, actions } = useMultiplayer();

  return (
    <section className="screen screen--settings">
      <h1>Settings</h1>

      <label className="option-row">
        <input
          type="checkbox"
          checked={state.theme === 'dark'}
          onChange={(e) => actions.setTheme(e.target.checked ? 'dark' : 'light')}
        />
        Dark mode
      </label>

      <label className="option-row">
        <input
          type="checkbox"
          checked={state.colorBlind}
          onChange={() => actions.toggleColorBlind()}
        />
        Color-blind accessibility (shape symbols on pegs)
      </label>

      <button type="button" className="btn" onClick={() => actions.goTo('home')}>
        Back
      </button>
    </section>
  );
}
