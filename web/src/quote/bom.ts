import type { Part, GlassGrade } from '../model/types';
import { sizeText } from '../model/size';

// 尺寸格式的唯一实现在 model/size.ts；这里转发一次是为了让既有调用点不必改 import。
export { sizeText };

/** 玻璃下料行：只统计缸体玻璃，`envelope: 'extern'` 的附属结构不进这张表 */
export interface BomRow {
  grade: GlassGrade;
  size: string;
  count: number;
  areaM2: number;
  /**
   * 这一行合并后的**开孔总数**（不是每件的孔数）。
   *
   * 单列一个字段是因为加工费要按孔收：一块打了六个穿板孔的板，
   * 钻孔工时远高于同尺寸的空白板，报价单上必须能区分出来。
   * 合并行时按件累加，`priceBOM` 直接用。
   */
  holes: number;
}

/** 非玻璃结构的清单行。没有面积字段 —— 柜体和铝架不按平方米卖玻璃 */
export interface ExternRow {
  rule: string;
  label: string;
  size: string;
  count: number;
}

const isGlass = (p: Part): boolean => (p.envelope ?? 'tank') !== 'extern';

/**
 * 按 `(材质, 尺寸)` 汇总玻璃板件。
 *
 * `envelope === 'extern'` 的板件在这里被**排除**：它们的 `material` 只是占位，
 * 语义上不是玻璃（铝型材不该按浮法玻璃计价）。这些结构走 `buildExternBOM`，
 * 不会凭空消失。
 */
export function buildBOM(parts: Part[]): BomRow[] {
  const map = new Map<string, BomRow>();

  for (const p of parts) {
    if (!isGlass(p)) continue;
    const size = sizeText(p);
    const key = `${p.material}|${size}`;
    const hit = map.get(key);
    const area = (p.l * p.w) / 1e6; // mm² → m²
    const holes = p.holes?.length ?? 0;
    if (hit) {
      hit.count += 1;
      hit.areaM2 += area;
      hit.holes += holes;
    } else {
      map.set(key, { grade: p.material, size, count: 1, areaM2: area, holes });
    }
  }

  return [...map.values()].map((r) => ({ ...r, areaM2: round4(r.areaM2) }));
}

/** 非玻璃结构的清单，按 `(规则, 尺寸)` 合并 */
export function buildExternBOM(parts: Part[]): ExternRow[] {
  const map = new Map<string, ExternRow>();

  for (const p of parts) {
    if (isGlass(p)) continue;
    const size = sizeText(p);
    const key = `${p.rule}|${size}`;
    const hit = map.get(key);
    if (hit) hit.count += 1;
    else map.set(key, { rule: p.rule, label: p.label, size, count: 1 });
  }

  return [...map.values()];
}

/** 面积累加会带浮点尾巴，四位小数足够定住一张单子 */
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
