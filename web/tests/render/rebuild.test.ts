import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { mountStructure, unmountStructure } from '../../src/render/tankBridge';
import type { BuildResult, Part } from '../../src/model/types';

/**
 * 这两个函数合起来描述 main.js 的一次完整重建。
 * 关键事实：底座的 tank.build() 会 pop 掉两个组的全部子节点，但**只 dispose
 * 几何**，材质没人管。所以顺序必须是
 *      unmountStructure → 底座重建 → mountStructure
 * 反过来的话，我们的材质会在每次重建时被悄悄遗弃。
 */

function fakeTank() {
  return {
    glassGroup: new THREE.Group(),
    group: new THREE.Group(),
    def: { w: 0.9, d: 0.45, h: 0.45, glass: 0.01 },
  };
}

/** 复刻 tank.js::build() 第 92 行：清空两组建，只处理几何 */
function baseBuildWipe(t: ReturnType<typeof fakeTank>) {
  for (const grp of [t.group, t.glassGroup]) {
    while (grp.children.length) {
      const c = grp.children.pop() as THREE.Mesh;
      c.geometry?.dispose();
    }
  }
}

const parts: Part[] = [
  { rule: 'floor', label: '底板', l: 878, w: 428, h: 10, x: 0, y: 5, z: 0, rx: 2, material: 'float' },
  { rule: 'frontBack', label: '前后', l: 900, w: 450, h: 10, x: 0, y: 225, z: 220, material: 'ultra' },
  { rule: 'cabinet', label: '柜体', l: 900, w: 750, h: 18, x: 0, y: -375, z: 0, material: 'float', envelope: 'extern' },
];

const result: BuildResult = { kind: 'whole', parts, dims: [], volumeL: 165 };

function collectMaterials(t: ReturnType<typeof fakeTank>): THREE.Material[] {
  const out: THREE.Material[] = [];
  for (const grp of [t.group, t.glassGroup]) {
    for (const c of grp.children) {
      const m = (c as THREE.Mesh).material;
      if (Array.isArray(m)) out.push(...m);
      else if (m) out.push(m);
    }
  }
  return out;
}

describe('重建顺序：先释放我们的材质，再让底座清空', () => {
  it('正确顺序下，上一轮的材质全部被 dispose', () => {
    const t = fakeTank();
    mountStructure(t, result);
    const first = collectMaterials(t);
    expect(first.length).toBe(parts.length);

    const spies = first.map((m) => vi.spyOn(m, 'dispose'));

    unmountStructure(t);   // 我们的
    baseBuildWipe(t);      // 底座的
    mountStructure(t, result);

    for (const s of spies) expect(s).toHaveBeenCalled();
    expect(t.glassGroup.children.length + t.group.children.length).toBe(parts.length);
  });

  it('反例：先让底座清空，材质就没机会释放（这条证明顺序是承重的）', () => {
    const t = fakeTank();
    mountStructure(t, result);
    const first = collectMaterials(t);
    const spies = first.map((m) => vi.spyOn(m, 'dispose'));

    baseBuildWipe(t);      // 顺序颠倒
    unmountStructure(t);   // 此时组里已经空了，扫不到东西

    for (const s of spies) expect(s).not.toHaveBeenCalled();
  });

  it('连续重建三次，材质不累积', () => {
    const t = fakeTank();
    const seen: THREE.Material[] = [];
    for (let i = 0; i < 3; i++) {
      unmountStructure(t);
      baseBuildWipe(t);
      mountStructure(t, result);
      const now = collectMaterials(t);
      expect(now.length).toBe(parts.length);
      for (const m of now) expect(seen).not.toContain(m);
      seen.push(...now);
    }
  });
});
