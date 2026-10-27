import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MaterialPanel, DEFAULT_SCENE, type SceneSettings } from '../../src/ui/MaterialPanel';
import type { TankParams } from '../../src/model/types';

// 与本目录其余 UI 用例同一约定：显式卸载上一个 render 的树。
// `tests/setup.ts` 里也有一道（幂等），这里保留是为了和邻文件写法一致。
afterEach(cleanup);

function mount(over: Partial<{ material: TankParams['material']; scene: SceneSettings }> = {}) {
  const onMaterial = vi.fn();
  const onScene = vi.fn();
  render(
    <MaterialPanel
      material={over.material ?? 0}
      onMaterial={onMaterial}
      scene={over.scene ?? DEFAULT_SCENE}
      onScene={onScene}
    />,
  );
  return { onMaterial, onScene };
}

describe('材质与环境面板', () => {
  it('四个控件都在', () => {
    mount();
    expect(screen.getByLabelText('玻璃等级')).toBeTruthy();
    expect(screen.getByLabelText('背景')).toBeTruthy();
    expect(screen.getByLabelText('灯色')).toBeTruthy();
    expect(screen.getByLabelText('灯光强度')).toBeTruthy();
  });

  it('改玻璃等级上抛材质编号', () => {
    const { onMaterial } = mount();
    fireEvent.change(screen.getByLabelText('玻璃等级'), { target: { value: '3' } });
    expect(onMaterial).toHaveBeenCalledWith(3);
  });

  it('改背景时其余场景字段保持不变', () => {
    const { onScene } = mount({ scene: { ...DEFAULT_SCENE, lampColor: 'warm', lamp: 0.4 } });
    fireEvent.change(screen.getByLabelText('背景'), { target: { value: 'blue' } });
    expect(onScene).toHaveBeenCalledWith({
      background: 'blue',
      lampColor: 'warm',
      lamp: 0.4,
    });
  });

  it('改灯色上抛新的灯色', () => {
    const { onScene } = mount();
    fireEvent.change(screen.getByLabelText('灯色'), { target: { value: 'rgb' } });
    expect(onScene).toHaveBeenCalledWith(expect.objectContaining({ lampColor: 'rgb' }));
  });

  it('拖灯光强度上抛数值而不是字符串', () => {
    const { onScene } = mount();
    fireEvent.change(screen.getByLabelText('灯光强度'), { target: { value: '0.35' } });
    const arg = onScene.mock.calls[0][0] as SceneSettings;
    expect(arg.lamp).toBe(0.35);
    expect(typeof arg.lamp).toBe('number');
  });

  it('强度以百分比显示', () => {
    mount({ scene: { ...DEFAULT_SCENE, lamp: 0.6 } });
    expect(screen.getByText('60%')).toBeTruthy();
  });
});
