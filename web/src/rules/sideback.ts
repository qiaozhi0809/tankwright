import type { PartRule, TankSpec } from './types';
import { plateDims } from './dimension';
import { gradeFor } from './materials';
import { floorRule, frontBackRule, leftRightRule } from './base';
import { braceRule } from './brace';
import { overflowRule } from './overflow';
import { baffleRule } from './baffle';

/** 没有溢流仓时，背侧滤默认占用的腔深 */
const DEFAULT_BAY = 120;

/**
 * 背仓隔断：靠后的一整块竖板，把后侧隔成背滤仓。
 *
 * **与溢流仓互斥**（规格 §7）：`overflowW` 达标时溢流仓本身就是背仓，
 * 再生成一块独立背仓隔板会和溢流板在同一段深度里打架——实测
 * `overflowW = 80` 时背仓板落在溢流板之后 40mm 并把它整个罩住，
 * `= 120` 时两板完全重合，`> 120` 时关系反转、背仓退到溢流板之前。
 * 门控放在规则里而不是各个 spec 里，任何用到它的缸型都自动继承这条排他。
 */
export const rearBayRule: PartRule = {
  name: 'rearBay',
  parts(g) {
    if (g.hasOverflow) return [];
    return [{
      rule: 'rearBay',
      label: '背仓隔板',
      l: g.innerL,
      w: g.innerH,
      h: g.baffleT,
      x: 0,
      y: g.bottomT + g.innerH / 2,
      z: -g.innerW / 2 + DEFAULT_BAY + g.baffleT / 2,
      material: gradeFor(g, 'rearBay', 'side'),
    }];
  },
  dims(_g, parts) {
    return plateDims(parts);
  },
};

/**
 * 背侧滤缸：缸体 + 背仓隔断。
 */
export const sidebackSpec: TankSpec = {
  kind: 'sideback',
  label: '背侧滤缸',
  rules: [floorRule, frontBackRule, leftRightRule, braceRule, overflowRule, baffleRule, rearBayRule],
};
