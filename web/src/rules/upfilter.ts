import type { PartRule, TankSpec } from './types';
import { plateDims } from './dimension';
import { gradeFor } from './materials';
import { floorRule, frontBackRule, leftRightRule } from './base';
import { braceRule } from './brace';
import { overflowRule } from './overflow';
import { baffleRule } from './baffle';

/** 上滤槽内深（Z 方向） */
const TROUGH_D = 120;
/** 上滤槽板厚 */
const TROUGH_T = 8;
/** 槽体比缸长每边缩进，避免与缸口拉筋打架 */
const TROUGH_INSET = 20;

/**
 * 上滤槽：架在缸口上方的浅槽，槽底 + 四周壁共五块。
 *
 * 取舍：只做单层敞口槽。滤材隔板、溢流管、回水管都不生成——它们是管路件，
 * 由现场配件决定；这一层只要给出能焊/粘的槽体。
 * 整个槽在 `y = H` 之上，属于缸体外的附属结构。
 */
export const troughRule: PartRule = {
  name: 'trough',
  parts(g) {
    const l = g.L - TROUGH_INSET * 2;
    const yBottom = g.H + TROUGH_T / 2;
    const yWall = g.H + TROUGH_D / 2;
    const zc = TROUGH_D / 2 - TROUGH_T / 2;   // 前后壁中心到槽中线
    const xc = l / 2 - TROUGH_T / 2;
    const material = gradeFor(g, 'trough', 'side');

    const plate = (label: string, L: number, W: number, H: number, x: number, y: number, z: number) => ({
      rule: 'trough', label, l: L, w: W, h: H, x, y, z,
      material, envelope: 'extern' as const,
    });

    return [
      plate('上滤槽底', l, TROUGH_T, TROUGH_D, 0, yBottom, 0),
      plate('上滤槽壁', l, TROUGH_D, TROUGH_T, 0, yWall, zc),
      plate('上滤槽壁', l, TROUGH_D, TROUGH_T, 0, yWall, -zc),
      plate('上滤槽壁', TROUGH_T, TROUGH_D, TROUGH_D - TROUGH_T * 2, xc, yWall, 0),
      plate('上滤槽壁', TROUGH_T, TROUGH_D, TROUGH_D - TROUGH_T * 2, -xc, yWall, 0),
    ];
  },
  dims(_g, parts) {
    return plateDims(parts);
  },
};

/**
 * 上滤缸：缸体 + 顶部过滤槽。
 */
export const upfilterSpec: TankSpec = {
  kind: 'upfilter',
  label: '上滤缸',
  rules: [floorRule, frontBackRule, leftRightRule, braceRule, overflowRule, baffleRule, troughRule],
};
