import type { PartRule, TankSpec } from './types';
import type { Geom } from '../model/types';
import { plateDims } from './dimension';
import { gradeFor } from './materials';
import { floorRule, frontBackRule, leftRightRule } from './base';
import { braceRule } from './brace';
import { overflowRule } from './overflow';
import { baffleRule } from './baffle';

/** 柜体板厚（18mm 多层板/颗粒板） */
const CAB_T = 18;
/** 柜体总高 */
const CAB_H = 750;

/**
 * 客厅缸柜体：顶板 + 底板 + 前后各一 + 左右各一。
 *
 * 取舍：只出六块板。柜门、背板、踢脚、内部隔层都不生成——它们不影响缸体承重
 * 与下料主料，却在图纸上制造大量噪音。加工方按柜体外框 + 板厚即可复现。
 */
export const cabinetRule: PartRule = {
  name: 'cabinet',
  parts(g) {
    const yTop = -CAB_T / 2;                       // 顶板上表面贴住缸底 y=0
    const yBot = -CAB_H + CAB_T / 2;
    const ySide = -CAB_H / 2;
    const sideH = CAB_H - CAB_T * 2;
    const material = gradeFor(g, 'cabinet', 'side');

    const plate = (label: string, l: number, w: number, h: number, x: number, y: number, z: number) => ({
      rule: 'cabinet', label, l, w, h, x, y, z,
      material, envelope: 'extern' as const,
    });

    return [
      // 顶板外挑到柜体两侧之外，托住灯架立柱；其余板维持缸体投影尺寸
      plate('柜顶板', cabinetTopSpan(g), CAB_T, g.W, 0, yTop, 0),
      plate('柜底板', g.L, CAB_T, g.W, 0, yBot, 0),
      plate('柜前后板', g.L, sideH, CAB_T, 0, ySide, g.W / 2 - CAB_T / 2),
      plate('柜前后板', g.L, sideH, CAB_T, 0, ySide, -(g.W / 2 - CAB_T / 2)),
      plate('柜侧板', CAB_T, sideH, g.W - CAB_T * 2, g.L / 2 - CAB_T / 2, ySide, 0),
      plate('柜侧板', CAB_T, sideH, g.W - CAB_T * 2, -(g.L / 2 - CAB_T / 2), ySide, 0),
    ];
  },
  dims(_g, parts) {
    return plateDims(parts);
  },
};

/** 灯架立柱截面 */
const POST = 30;
/** 灯架净高（缸口到横梁下缘） */
const CANOPY_H = 380;
/** 柜顶板相对缸体每边多伸出的量，用来托住灯架立柱 */
const CAB_OVERHANG = 10;

/**
 * 柜顶板必须横跨到灯架立柱之外，否则立柱悬空。
 * 两处共读这一个表达式，避免柜体与灯架各自假设缸体外沿在哪。
 */
export function cabinetTopSpan(g: Geom): number {
  return g.L + (POST + CAB_OVERHANG) * 2;
}

/**
 * 灯架：**缸体两侧**两根立柱 + 一根顶部横梁，构成门形。
 *
 * 为什么走两侧而不是后侧：立柱若贴后沿，就必须加深柜体去托它，而柜子比缸深
 * 在正面完全看不出来，等于凭空多出一段要解释的尺寸；走两侧只需柜顶板外挑一块，
 * 是可见的挑檐，几何上诚实。
 *
 * 立柱从柜顶（y = 0）连续升到横梁底面，全程位于 `|x| = L/2 + POST/2`，
 * 即完全在玻璃之外——先移出缸体再做加长，不会拿「悬空」换「穿模」。
 */
export const canopyRule: PartRule = {
  name: 'canopy',
  parts(g) {
    const yBeamBottom = g.H + CANOPY_H;      // 横梁下缘 = 立柱顶
    const yCol = yBeamBottom / 2;            // 立柱自 y=0 起，中心在半高处
    const yBeam = yBeamBottom + POST / 2;    // 横梁坐在柱顶
    const px = g.L / 2 + POST / 2;           // 柱心：贴缸体外壁，不侵入玻璃
    const material = gradeFor(g, 'canopy', 'side');

    return [
      { rule: 'canopy', label: '灯架立柱', l: POST, w: yBeamBottom, h: POST,
        x: px, y: yCol, z: 0, material, envelope: 'extern' },
      { rule: 'canopy', label: '灯架立柱', l: POST, w: yBeamBottom, h: POST,
        x: -px, y: yCol, z: 0, material, envelope: 'extern' },
      { rule: 'canopy', label: '灯架横梁', l: g.L + POST * 2, w: POST, h: POST,
        x: 0, y: yBeam, z: 0, material, envelope: 'extern' },
    ];
  },
  dims(_g, parts) {
    return plateDims(parts);
  },
};

/**
 * 客厅缸：缸体 + 柜体 + 灯架。
 */
export const wholeSpec: TankSpec = {
  kind: 'whole',
  label: '客厅缸',
  rules: [floorRule, frontBackRule, leftRightRule, braceRule, overflowRule, baffleRule, cabinetRule, canopyRule],
};
