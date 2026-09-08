import { PEG_COLORS } from '@mastermind/shared';
import type { PegColorId } from '@mastermind/shared';
import { useMultiplayer } from '../state/useMultiplayer';

interface ColorPaletteProps {
  onSelect: (color: PegColorId) => void;
  onClose: () => void;
}

export function ColorPalette({ onSelect, onClose }: ColorPaletteProps) {
  const { state } = useMultiplayer();

  return (
    <div className="color-palette-backdrop" onClick={onClose}>
      <div className="color-palette" onClick={(e) => e.stopPropagation()}>
        {PEG_COLORS.map((color) => (
          <button
            key={color.id}
            type="button"
            className="color-swatch"
            style={{ backgroundColor: color.hex }}
            onClick={() => onSelect(color.id)}
            aria-label={color.label}
          >
            {state.colorBlind ? <span aria-hidden="true">{color.symbol}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
