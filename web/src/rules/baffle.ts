import type { PartRule } from './types';
import { gradeFor } from './materials';
import { plateDims } from './dimension';

/**
 * 规格 §3.6 隔板：把内腔沿长度等分成 `baffleCount` 段，段间用隔板分开。
 *
 * **隔板贴底安装，缺口留在上缘** —— 水流从隔板顶端翻到下一段（上过水），
 * 所以板高是 `innerH − baffleCut`，下缘落在 `bottomT`，顶边距缸口正好
 * `baffleCut`。段数为 1 时不产生隔板。
 *
 * 跨越腔深用 `usableW`、落位用 `usableZ`：有溢流仓时隔板止于溢流板，
 * 不会穿过去；无溢流仓时这两个量退化成 innerW / 0。
 */
export const baffleRule: PartRule = {
  name: 'baffle',
  parts(g) {
    const count = g.baffleCount - 1;
    if (count <= 0) return [];

    const material = gradeFor(g, 'baffle', 'side');
    const w = g.innerH - g.baffleCut;
    const y = g.bottomT + w / 2;

    const out = [];
    for (let i = 1; i <= count; i++) {
      out.push({
        rule: 'baffle',
        label: '隔板',
        l: g.usableW,
        w,
        h: g.baffleT,
        x: -g.innerL / 2 + g.baffleSpan * i,
        y,
        z: g.usableZ,
        // 隔断必须横跨缸深：长边落在 Z 轴，厚度落在 X 轴
        ry: 2,
        material,
      });
    }
    return out;
  },
  dims(_g, parts) {
    return plateDims(parts);
  },
};
