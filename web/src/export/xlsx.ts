import * as XLSX from 'xlsx';
import type { BomRow, ExternRow } from '../quote/bom';
import type { Quote } from '../quote/pricing';
import type { GlassGrade } from '../model/types';

const GRADE_LABEL: Record<GlassGrade, string> = { ultra: '超白', float: '浮法' };

interface GradeTotal {
  grade: GlassGrade;
  count: number;
  areaM2: number;
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** 按材质汇总，顺序固定为 超白 → 浮法，空档也保留，便于对照 */
function byGrade(rows: BomRow[]): GradeTotal[] {
  const out: GradeTotal[] = [
    { grade: 'ultra', count: 0, areaM2: 0 },
    { grade: 'float', count: 0, areaM2: 0 },
  ];
  for (const r of rows) {
    const t = out.find((x) => x.grade === r.grade);
    if (!t) continue;
    t.count += r.count;
    t.areaM2 += r.areaM2;
  }
  for (const t of out) t.areaM2 = round4(t.areaM2);
  return out;
}

/**
 * 生成下料工作簿。
 *
 * 两张表：
 * - **缸体清单**：逐行玻璃 + 缸外结构 + 报价汇总。缸外结构（柜体、铝架、顶滤槽、保温层）
 *   与玻璃**分段放置**且不带面积列 —— 它们不是按平方米卖的玻璃，混进玻璃行会被误计价。
 * - **玻璃统计**：按材质汇总面积与件数，供采购直接用。
 */
export function buildWorkbook(
  rows: BomRow[],
  externRows: ExternRow[],
  quote: Quote,
): XLSX.WorkBook {
  const totalCount = rows.reduce((s, r) => s + r.count, 0);
  const totalArea = round4(rows.reduce((s, r) => s + r.areaM2, 0));

  const sheet1: (string | number)[][] = [
    ['材质', '尺寸 mm', '数量', '面积 m²'],
    ...rows.map((r): (string | number)[] => [
      GRADE_LABEL[r.grade] ?? r.grade,
      r.size,
      r.count,
      r.areaM2,
    ]),
    ['玻璃合计', '', totalCount, totalArea],
    [],
  ];

  if (externRows.length > 0) {
    sheet1.push(['缸外结构', '尺寸 mm', '数量']);
    for (const e of externRows) sheet1.push([e.label, e.size, e.count]);
    sheet1.push([]);
  }

  sheet1.push(
    ['报价', '金额 元'],
    ['玻璃', quote.glass],
    ['切割', quote.cut],
    ['打胶', quote.glue],
    ['合计', quote.total],
  );

  const totals = byGrade(rows);
  const sheet2: (string | number)[][] = [
    ['材质', '面积 m²', '件数'],
    ...totals.map((t): (string | number)[] => [GRADE_LABEL[t.grade], t.areaM2, t.count]),
    ['合计', totalArea, totalCount],
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet1), '缸体清单');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet2), '玻璃统计');
  return wb;
}

/** 打包成 .xlsx 二进制。文件名由调用方决定 */
export async function exportXlsx(
  rows: BomRow[],
  externRows: ExternRow[],
  quote: Quote,
): Promise<Blob> {
  const wb = buildWorkbook(rows, externRows, quote);
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
