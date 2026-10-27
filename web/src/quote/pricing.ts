import type { BomRow } from './bom';

export interface PriceConfig {
  /** 超白玻璃单价，元/m² */
  ultraPerM2: number;
  /** 浮法玻璃单价，元/m² */
  floatPerM2: number;
  /** 每件切割费 */
  cutPerPart: number;
  /**
   * 每个开孔的钻孔费（元/孔），可选。
   *
   * 省略时按 0 计 —— 老的定价配置不必改就能继续用。
   * 一块打了六个穿板孔的板和一块空白板同价，在车间看来是算错了，
   * 所以这个字段迟早要填；不填至少不会算崩溃。
   */
  holesPerPart?: number;
  /** 打胶费，按单收取 */
  glue: number;
}

export interface Quote {
  glass: number;
  cut: number;
  glue: number;
  total: number;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * 按下料清单计价。金额一律保留两位小数，避免 0.1+0.2 这类尾巴出现在报价单上。
 * 空清单不收打胶费 —— 没东西可粘。
 */
export function priceBOM(rows: BomRow[], cfg: PriceConfig): Quote {
  let glass = 0;
  let cut = 0;
  const holesPerPart = cfg.holesPerPart ?? 0;

  for (const r of rows) {
    const perM2 = r.grade === 'ultra' ? cfg.ultraPerM2 : cfg.floatPerM2;
    glass += r.areaM2 * perM2;
    cut += r.count * cfg.cutPerPart;
    // 开孔按孔计，不按板计：一块板挖六个孔的工时是挖一个孔的六倍
    cut += r.holes * holesPerPart;
  }

  glass = round2(glass);
  cut = round2(cut);
  const glue = rows.length > 0 ? round2(cfg.glue) : 0;

  return { glass, cut, glue, total: round2(glass + cut + glue) };
}
