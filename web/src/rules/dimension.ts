import type { Part, Dimension } from '../model/types';
import { sizeText } from '../model/size';

/**
 * 板件尺寸标注：`长x宽x厚`，小写 x、无空格。
 *
 * 格式由 `model/size.ts` 单点拥有，与下料清单共用同一个函数 —— 这里不再自己拼字符串，
 * 否则两处一旦各自改动就会悄悄分叉（Task 11 复审指出的问题）。
 */
export function plateDims(parts: Part[]): Dimension[] {
  return parts.map((p) => ({
    text: sizeText(p),
    x: p.x,
    y: p.y,
    z: p.z,
  }));
}
