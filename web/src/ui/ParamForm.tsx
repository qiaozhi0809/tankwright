import { useState } from 'react';
import type { TankParams } from '../model/types';
import { clampParams } from '../model/validate';

type Field = {
  key: keyof TankParams;
  label: string;
  step?: number;
  /** 该字段的物理单位，仅用于提示 */
  unit?: string;
};

/**
 * 数值字段按规格 §1 的顺序排列：先外形三边，再玻璃厚度，最后工艺参数。
 * 材质是枚举，单独渲染。
 */
const FIELDS: Field[] = [
  { key: 'L', label: '长度', unit: 'mm' },
  { key: 'W', label: '宽度', unit: 'mm' },
  { key: 'H', label: '高度', unit: 'mm' },
  { key: 'sideT', label: '侧板厚', unit: 'mm' },
  { key: 'bottomT', label: '底板厚', unit: 'mm' },
  { key: 'baffleT', label: '隔板厚', unit: 'mm' },
  { key: 'gap', label: '胶缝', unit: 'mm' },
  { key: 'baffleCount', label: '隔板数量', unit: '段' },
  { key: 'baffleCut', label: '隔板切口', unit: 'mm' },
  { key: 'overflowW', label: '溢流宽度', unit: 'mm' },
  { key: 'sandW', label: '沙缸宽度', unit: 'mm' },
  { key: 'pumpW', label: '泵仓宽度', unit: 'mm' },
  { key: 'braceW', label: '拉筋宽度', unit: 'mm' },
];

const MATERIALS: { value: TankParams['material']; label: string }[] = [
  { value: 0, label: '全浮法' },
  { value: 1, label: '底背超白' },
  { value: 2, label: '正面超白' },
  { value: 3, label: '全超白' },
];

export interface ParamFormProps {
  value: TankParams;
  onChange: (next: TankParams) => void;
}

/**
 * 受控参数表单。
 *
 * 每次改动先过 `clampParams`：接受则上抛夹紧后的值，拒绝则**保留旧值**并把
 * `reason` 显示在 `role="alert"` 的节点里。拒绝不是静默失败——用户必须看到
 * 为什么这个尺寸立不住。
 */
export function ParamForm({ value, onChange }: ParamFormProps) {
  const [reason, setReason] = useState<string>('');
  const baseId = 'eng';

  function commit(key: keyof TankParams, raw: string) {
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      setReason('请输入数字');
      return;
    }
    const next = { ...value, [key]: n } as TankParams;
    const r = clampParams(next);
    if (!r.ok) {
      setReason(r.reason);
      return;
    }
    setReason('');
    onChange(r.value);
  }

  return (
    <form className="eng-form" onSubmit={(e) => e.preventDefault()}>
      <div className="eng-grid">
        {FIELDS.map((f) => {
          const id = `${baseId}-${f.key}`;
          return (
            <div className="eng-field" key={f.key}>
              <label htmlFor={id}>{f.label}</label>
              <input
                id={id}
                type="number"
                step={f.step ?? 1}
                value={String(value[f.key])}
                onChange={(e) => commit(f.key, e.target.value)}
              />
              {f.unit ? <span className="eng-unit">{f.unit}</span> : null}
            </div>
          );
        })}
        <div className="eng-field">
          <label htmlFor={`${baseId}-material`}>玻璃等级</label>
          <select
            id={`${baseId}-material`}
            value={String(value.material)}
            onChange={(e) => commit('material', e.target.value)}
          >
            {MATERIALS.map((m) => (
              <option key={m.value} value={String(m.value)}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="eng-alert" role="alert">
        {reason}
      </p>
    </form>
  );
}
