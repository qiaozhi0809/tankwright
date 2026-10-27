import type { PartRule } from './types';
import { gradeFor } from './materials';
import { plateDims } from './dimension';

/**
 * 规格 §3.1 底板。
 * 夹在四壁内侧，绕 X 轴转 90° 使厚度落在 Y 方向，中心高度为板厚的一半。
 */
export const floorRule: PartRule = {
  name: 'floor',
  parts(g) {
    return [{
      rule: 'floor',
      label: '底板',
      l: g.outerL - 2 * g.gap,
      w: g.outerW - 2 * g.gap,
      h: g.bottomT,
      x: 0,
      y: g.floorY,
      z: 0,
      rx: 2,
      material: gradeFor(g, 'floor', 'floor'),
    }];
  },
  dims(_g, parts) {
    return plateDims(parts);
  },
};

/**
 * 规格 §3.2 前后板，两块，横跨整个标称长度。
 * 正 z 侧为正面（观察面），负 z 侧为背面。
 */
export const frontBackRule: PartRule = {
  name: 'frontBack',
  parts(g) {
    const z = (g.W - g.sideT) / 2;
    const common = {
      rule: 'frontBack',
      label: '前后',
      l: g.L,
      w: g.H,
      h: g.sideT,
      y: g.H / 2,
    } as const;
    return [
      { ...common, x: 0, z: z, material: gradeFor(g, 'frontBack', 'front') },
      { ...common, x: 0, z: -z, material: gradeFor(g, 'frontBack', 'back') },
    ];
  },
  dims(_g, parts) {
    return plateDims(parts);
  },
};

/**
 * 规格 §3.3 左右板，两块，长度取内跨减胶缝，夹在前后板之间。
 */
export const leftRightRule: PartRule = {
  name: 'leftRight',
  parts(g) {
    const x = (g.L - g.sideT) / 2;
    const common = {
      rule: 'leftRight',
      label: '左右',
      l: g.outerW - 2 * g.gap,
      w: g.H,
      h: g.sideT,
      y: g.H / 2,
      ry: 2,
    } as const;
    const material = gradeFor(g, 'leftRight', 'side');
    return [
      { ...common, x: x, z: 0, material },
      { ...common, x: -x, z: 0, material },
    ];
  },
  dims(_g, parts) {
    return plateDims(parts);
  },
};
