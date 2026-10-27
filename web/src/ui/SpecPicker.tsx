import type { TankKind } from '../model/types';
import { TANK_KINDS, SPECS } from '../rules';

export interface SpecPickerProps {
  value: TankKind;
  onChange: (next: TankKind) => void;
}

/** 缸型选择器。顺序即 `TANK_KINDS` 的顺序，与小程序的九宫格一致。 */
export function SpecPicker({ value, onChange }: SpecPickerProps) {
  return (
    <div className="eng-kinds" role="group" aria-label="缸型">
      {TANK_KINDS.map((k) => (
        <button
          key={k}
          type="button"
          className={k === value ? 'eng-kind on' : 'eng-kind'}
          aria-pressed={k === value}
          onClick={() => onChange(k)}
        >
          {SPECS[k].label}
        </button>
      ))}
    </div>
  );
}
