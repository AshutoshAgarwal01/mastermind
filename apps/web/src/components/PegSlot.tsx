import { PEG_COLORS } from '@mastermind/shared';
import type { PegColorId } from '@mastermind/shared';
import { useMultiplayer } from '../state/useMultiplayer';

interface PegSlotProps {
  colorId: PegColorId | null;
  onClick?: () => void;
  size?: 'small' | 'medium' | 'large';
  glow?: boolean;
  locked?: boolean;
}

export function PegSlot({ colorId, onClick, size = 'medium', glow = false, locked = false }: PegSlotProps) {
  const { state } = useMultiplayer();
  const color = PEG_COLORS.find((c) => c.id === colorId);

  const peg = (
    <button
      type="button"
      className={`peg-slot peg-slot--${size}${onClick ? ' peg-slot--interactive' : ''}${glow ? ' peg-slot--hint-glow' : ''}${!color ? ' peg-slot--empty' : ''}`}
      style={{ backgroundColor: color?.hex ?? 'transparent' }}
      onClick={onClick}
      disabled={!onClick}
      aria-label={color ? `${color.label}${locked ? ' (locked)' : ''}` : 'Empty slot'}
    >
      {color && state.colorBlind ? <span aria-hidden="true">{color.symbol}</span> : null}
    </button>
  );

  // The lock badge is a pure visual indicator now (toggling happens via double-tapping the peg
  // itself, handled by the caller's onClick) — only rendered, and only wrapped in a positioning
  // frame, when actually locked, so every other PegSlot usage stays a bare button.
  if (!locked || !color) return peg;

  return (
    <div className="peg-slot-frame">
      {peg}
      <span className="peg-slot__lock" aria-hidden="true">
        🔒
      </span>
    </div>
  );
}
