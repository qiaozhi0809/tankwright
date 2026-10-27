import type { PartRule } from './types';
import type { TankSpec } from './types';
import { plateDims } from './dimension';
import { gradeFor } from './materials';
import { floorRule, frontBackRule, leftRightRule } from './base';
import { braceRule } from './brace';
import { overflowRule } from './overflow';
import { baffleRule } from './baffle';

/** 铝型材截面边长（40×40 标准型材），单位 mm */
const PROFILE = 40;
/** 铝架总高：行业常用的 750 柜高 */
const FRAME_H = 750;

/**
 * 铝架：四柱 + 顶部围框，架顶与缸底齐平（y = 0），向下延伸 FRAME_H。
 *
 * 取舍：只画受力必需的四根立柱和托住缸底的顶框，不画斜撑、层板、背拉。
 * 加工方拿到「4 柱 + 4 梁 + 截面 40」就能下料，多画的部分不会让铝架更好造。
 */
export const rackRule: PartRule = {
  name: 'rack',
  parts(g) {
    const yTop = -PROFILE / 2;              // 顶框中心：占 −40…0，正好托住 y=0 的缸底
    const yCol = -FRAME_H / 2;              // 立柱中心
    const px = g.L / 2 - PROFILE / 2;       // 柱心到缸体中线
    const pz = g.W / 2 - PROFILE / 2;
    const material = gradeFor(g, 'rack', 'side');

    const col = (x: number, z: number) => ({
      rule: 'rack', label: '铝架立柱',
      l: PROFILE, w: FRAME_H, h: PROFILE,
      x, y: yCol, z,
      material, envelope: 'extern' as const,
    });

    const beamX = (z: number) => ({          // 沿缸长的横梁
      rule: 'rack', label: '铝架横梁',
      l: g.L, w: PROFILE, h: PROFILE,
      x: 0, y: yTop, z,
      material, envelope: 'extern' as const,
    });

    const beamZ = (x: number) => ({          // 沿缸深的横梁
      rule: 'rack', label: '铝架横梁',
      l: PROFILE, w: PROFILE, h: g.W - PROFILE * 2,
      x, y: yTop, z: 0,
      material, envelope: 'extern' as const,
    });

    return [
      col(px, pz), col(-px, pz), col(px, -pz), col(-px, -pz),
      beamX(pz), beamX(-pz), beamZ(px), beamZ(-px),
    ];
  },
  dims(_g, parts) {
    return plateDims(parts);
  },
};

/**
 * 铝架缸：缸体本身与标准鱼缸完全一致，只是把柜体换成铝型材框架。
 */
export const rackSpec: TankSpec = {
  kind: 'rack',
  label: '铝架缸',
  rules: [floorRule, frontBackRule, leftRightRule, braceRule, overflowRule, baffleRule, rackRule],
};
