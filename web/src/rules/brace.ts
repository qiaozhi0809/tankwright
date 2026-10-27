import type { PartRule } from './types';
import { gradeFor } from './materials';
import { plateDims } from './dimension';

/**
 * 规格 §3.4 拉筋：四壁上缘内侧的横向加固，抵消满水侧压。
 * 切口不足两倍玻璃厚时 `hasBrace` 为 false，一根都不生成。
 *
 * 走向约定（决定旋转与 w/h 谁是谁）：
 * - 左右拉筋沿缸深（Z）跑，外廓 = braceW × sideT × innerW → 用 `ry`
 * - 前后拉筋沿缸长（X）跑，外廓 = innerL × sideT × braceW → 用 `rx`
 * 两条都让 `sideT` 落在竖直方向，拉筋才有厚度去抗弯。
 */
export const braceRule: PartRule = {
  name: 'brace',
  parts(g) {
    if (!g.hasBrace) return [];

    const y = g.H - g.bottomT - g.sideT;
    // 外缘贴内腔壁面，留一个胶缝：内腔半宽 − 拉筋半宽
    const xo = (g.innerL - g.braceW) / 2;
    const zo = (g.innerW - g.braceW) / 2;
    const material = gradeFor(g, 'brace', 'side');

    return [
      { rule: 'brace', label: '拉筋', l: g.innerW, w: g.sideT, h: g.braceW, x: xo, y, z: 0, ry: 2, material },
      { rule: 'brace', label: '拉筋', l: g.innerW, w: g.sideT, h: g.braceW, x: -xo, y, z: 0, ry: 2, material },
      { rule: 'brace', label: '拉筋', l: g.innerL, w: g.braceW, h: g.sideT, x: 0, y, z: zo, rx: 2, material },
      { rule: 'brace', label: '拉筋', l: g.innerL, w: g.braceW, h: g.sideT, x: 0, y, z: -zo, rx: 2, material },
    ];
  },
  dims(_g, parts) {
    return plateDims(parts);
  },
};
