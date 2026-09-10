import { PEG_COLORS } from '@mastermind/shared';
import type { PegColorId } from '@mastermind/shared';
import { useMultiplayer } from '../state/useMultiplayer';

interface ColorPaletteProps {
  selectedColor: PegColorId | null;
  onSelectColor: (color: PegColorId) => void;
}

export function ColorPalette({ selectedColor, onSelectColor }: ColorPaletteProps) {
  const { state } = useMultiplayer();

  return (
    <div className="color-palette">
      {PEG_COLORS.map((color) => (
        <button
          key={color.id}
          type="button"
          className={`color-swatch${selectedColor === color.id ? ' color-swatch--selected' : ''}`}
          style={{ backgroundColor: color.hex }}
          onClick={() => onSelectColor(color.id)}
          aria-label={color.label}
          aria-pressed={selectedColor === color.id}
        >
          {state.colorBlind ? <span aria-hidden="true">{color.symbol}</span> : null}
        </button>
      ))}
    </div>
  );
}
