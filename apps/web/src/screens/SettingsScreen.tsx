import { PEG_COLORS } from '@mastermind/shared';
import { PegSlot } from '../components/PegSlot';
import { useMultiplayer } from '../state/useMultiplayer';
import type { PegStyle } from '../state/useMultiplayer';

const PEG_STYLE_OPTIONS: { id: PegStyle; label: string }[] = [
  { id: 'classic', label: 'Classic' },
  { id: 'flat', label: 'Minimal' },
  { id: 'glossy', label: 'Glossy' },
  { id: 'bordered', label: 'Bold' },
];

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

      <fieldset className="peg-style-picker">
        <legend>Peg style</legend>
        {PEG_STYLE_OPTIONS.map((option) => (
          <label key={option.id} className="option-row">
            <input
              type="radio"
              name="pegStyle"
              checked={state.pegStyle === option.id}
              onChange={() => actions.setPegStyle(option.id)}
            />
            {option.label}
          </label>
        ))}
        <div className="peg-style-picker__preview">
          {PEG_COLORS.map((color) => (
            <PegSlot key={color.id} colorId={color.id} size="small" />
          ))}
        </div>
      </fieldset>

      <button type="button" className="btn" onClick={() => actions.goTo('home')}>
        Back
      </button>
    </section>
  );
}
