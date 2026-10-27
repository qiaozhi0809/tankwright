import type { PartRule } from './types';
import { gradeFor } from './materials';
import { plateDims } from './dimension';

/**
 * 规格 §3.7 沙缸隔断：在右侧隔出宽度 `sandW` 的沙缸区。
 * 宽度为 0 时 `hasSand` 为 false，不生成。
 * 跨腔深读 `usableW`、落位读 `usableZ`，有溢流仓时不得穿过去。
 */
export const sandDividerRule: PartRule = {
  name: 'sandDivider',
  parts(g) {
    if (!g.hasSand) return [];

    return [{
      rule: 'sandDivider',
      label: '沙缸隔断',
      l: g.usableW,
      w: g.innerH,
      h: g.baffleT,
      x: g.L / 2 - g.sandW - g.baffleT / 2,
      y: g.bottomT + g.innerH / 2,
      z: g.usableZ,
      // 隔断横跨缸深：长边落在 Z 轴，厚度落在 X 轴
      ry: 2,
      material: gradeFor(g, 'sandDivider', 'side'),
    }];
  },
  dims(_g, parts) {
    return plateDims(parts);
  },
};

/**
 * 规格 §3.8 泵仓隔断：在左侧隔出宽度 `pumpW` 的泵仓，与沙缸隔断互斥加宽。
 */
export const pumpDividerRule: PartRule = {
  name: 'pumpDivider',
  parts(g) {
    if (!g.hasPump) return [];

    return [{
      rule: 'pumpDivider',
      label: '泵仓隔断',
      l: g.usableW,
      w: g.innerH,
      h: g.baffleT,
      x: -g.L / 2 + g.pumpW + g.baffleT / 2,
      y: g.bottomT + g.innerH / 2,
      z: g.usableZ,
      // 隔断横跨缸深：长边落在 Z 轴，厚度落在 X 轴
      ry: 2,
      material: gradeFor(g, 'pumpDivider', 'side'),
    }];
  },
  dims(_g, parts) {
    return plateDims(parts);
  },
};
