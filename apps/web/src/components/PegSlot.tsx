import { PEG_COLORS } from '@mastermind/shared';
import type { PegColorId } from '@mastermind/shared';
import { useMultiplayer } from '../state/useMultiplayer';

interface PegSlotProps {
  colorId: PegColorId | null;
  onClick?: () => void;
  size?: 'small' | 'medium' | 'large';
}

export function PegSlot({ colorId, onClick, size = 'medium' }: PegSlotProps) {
  const { state } = useMultiplayer();
  const color = PEG_COLORS.find((c) => c.id === colorId);

  return (
    <button
      type="button"
      className={`peg-slot peg-slot--${size}${onClick ? ' peg-slot--interactive' : ''}`}
      style={{ backgroundColor: color?.hex ?? 'transparent' }}
      onClick={onClick}
      disabled={!onClick}
      aria-label={color ? color.label : 'Empty slot'}
    >
      {color && state.colorBlind ? <span aria-hidden="true">{color.symbol}</span> : null}
    </button>
  );
}
