import type { PartRule } from './types';
import { gradeFor } from './materials';
import { plateDims } from './dimension';

/** 溢流板顶部让出的水路高度：低于此值水面无法翻越，溢流失效 */
export const OVERFLOW_LIP = 10;

/**
 * 规格 §3.5 溢流板：在后侧隔出一条溢流仓。
 * `overflowW` 低于阈值时 `hasOverflow` 为 false，不生成（这是设计，不是缺陷）。
 *
 * z 以内腔后壁为基准距出 `overflowW`，不是以标称外宽为基准——
 * 用外宽会让实际仓宽被侧壁厚吃掉两倍。
 */
export const overflowRule: PartRule = {
  name: 'overflow',
  parts(g) {
    if (!g.hasOverflow) return [];

    return [{
      rule: 'overflow',
      label: '溢流板',
      l: g.innerL,
      w: g.innerH - OVERFLOW_LIP,
      h: g.baffleT,
      x: 0,
      y: g.bottomT / 2 + g.innerH / 2,
      z: -g.innerW / 2 + g.overflowW + g.baffleT / 2,
      material: gradeFor(g, 'overflow', 'side'),
    }];
  },
  dims(_g, parts) {
    return plateDims(parts);
  },
};
