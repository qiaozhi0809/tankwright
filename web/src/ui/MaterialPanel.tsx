import type { TankParams } from '../model/types';

/**
 * 场景外观设置。三个字段都直接对应底座 `tank.js` 的公开方法，不是摆设：
 * `setBackground(id)` / `setLampColor(id)` / `light.intensity = 3.2 * lamp`。
 */
export interface SceneSettings {
  background: 'white' | 'black' | 'blue' | 'none';
  lampColor: 'white' | 'warm' | 'rgb' | 'blue';
  /** 灯光强度，0..1；1 对应底座默认的 3.2 */
  lamp: number;
}

export const DEFAULT_SCENE: SceneSettings = {
  background: 'white',
  lampColor: 'white',
  lamp: 1,
};

const MATERIALS: { value: TankParams['material']; label: string }[] = [
  { value: 0, label: '全浮法' },
  { value: 1, label: '底背超白' },
  { value: 2, label: '正面超白' },
  { value: 3, label: '全超白' },
];

const BACKGROUNDS: { value: SceneSettings['background']; label: string }[] = [
  { value: 'white', label: '白色背光' },
  { value: 'black', label: '黑色' },
  { value: 'blue', label: '蓝色渐变' },
  { value: 'none', label: '无（显示房间）' },
];

const LAMP_COLORS: { value: SceneSettings['lampColor']; label: string }[] = [
  { value: 'white', label: '白光' },
  { value: 'warm', label: '暖光' },
  { value: 'rgb', label: 'RGB 水草灯' },
  { value: 'blue', label: '冷蓝' },
];

export interface MaterialPanelProps {
  material: TankParams['material'];
  onMaterial: (m: TankParams['material']) => void;
  scene: SceneSettings;
  onScene: (s: SceneSettings) => void;
}

/**
 * 材质与环境面板。
 *
 * 玻璃等级与 `ParamForm` 里那个下拉框改的是**同一份状态**（挂在 `params.material` 上），
 * 两处都受控于同一个值，因此不会出现一个显示超白、另一个显示浮法的情况。
 */
export function MaterialPanel({ material, onMaterial, scene, onScene }: MaterialPanelProps) {
  return (
    <section className="eng-material" aria-label="材质与环境">
      <h3>材质与环境</h3>

      <div className="eng-field">
        <label htmlFor="eng-mat-grade">玻璃等级</label>
        <select
          id="eng-mat-grade"
          value={String(material)}
          onChange={(e) => onMaterial(Number(e.target.value) as TankParams['material'])}
        >
          {MATERIALS.map((m) => (
            <option key={m.value} value={String(m.value)}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <div className="eng-field">
        <label htmlFor="eng-mat-bg">背景</label>
        <select
          id="eng-mat-bg"
          value={scene.background}
          onChange={(e) =>
            onScene({ ...scene, background: e.target.value as SceneSettings['background'] })
          }
        >
          {BACKGROUNDS.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>
      </div>

      <div className="eng-field">
        <label htmlFor="eng-mat-lamp-color">灯色</label>
        <select
          id="eng-mat-lamp-color"
          value={scene.lampColor}
          onChange={(e) =>
            onScene({ ...scene, lampColor: e.target.value as SceneSettings['lampColor'] })
          }
        >
          {LAMP_COLORS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="eng-field">
        <label htmlFor="eng-mat-lamp">灯光强度</label>
        <input
          id="eng-mat-lamp"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={String(scene.lamp)}
          onChange={(e) => onScene({ ...scene, lamp: Number(e.target.value) })}
        />
        <output htmlFor="eng-mat-lamp">{Math.round(scene.lamp * 100)}%</output>
      </div>
    </section>
  );
}
