import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { buildWorkbook, exportXlsx } from '../../src/export/xlsx';
import type { BomRow, ExternRow } from '../../src/quote/bom';
import type { Quote } from '../../src/quote/pricing';

const rows: BomRow[] = [
  { grade: 'ultra', size: '878x428x10', count: 1, areaM2: 0.3758, holes: 0 },
  { grade: 'float', size: '900x450x10', count: 2, areaM2: 0.81, holes: 2 },
];
const externRows: ExternRow[] = [
  { rule: 'cabinet', label: '柜顶板', size: '490x18x750', count: 1 },
];
const quote: Quote = { glass: 288.6, cut: 15, glue: 60, total: 363.6 };

/** 写盘再读回，断言的是真实产物而不是内存对象 */
function readBack(wb: XLSX.WorkBook) {
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return XLSX.read(buf, { type: 'array' });
}

function rowsOf(sheet: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
}

describe('下料工作簿', () => {
  it('恰好两张表，名字对得上', () => {
    expect(buildWorkbook(rows, externRows, quote).SheetNames).toEqual(['缸体清单', '玻璃统计']);
  });

  it('缸体清单含玻璃行与合计', () => {
    const back = readBack(buildWorkbook(rows, externRows, quote));
    const aoa = rowsOf(back.Sheets['缸体清单']);
    const flat = aoa.flat().map(String);

    expect(flat).toContain('超白');
    expect(flat).toContain('浮法');
    expect(flat).toContain('878x428x10');
    const totals = aoa.find((r) => r[0] === '玻璃合计');
    expect(totals?.[2]).toBe(3); // 1 + 2 件
  });

  it('玻璃合计与报价合计不重名（否则表里两行都叫“合计”）', () => {
    const back = readBack(buildWorkbook(rows, externRows, quote));
    const aoa = rowsOf(back.Sheets['缸体清单']);
    const heji = aoa.filter((r) => r[0] === '合计');
    expect(heji).toHaveLength(1);
    expect(heji[0][1]).toBe(363.6);
  });

  it('缸外结构单独成段，且不占面积列', () => {
    const back = readBack(buildWorkbook(rows, externRows, quote));
    const aoa = rowsOf(back.Sheets['缸体清单']);
    const header = aoa.findIndex((r) => r[0] === '缸外结构');
    expect(header).toBeGreaterThan(-1);

    const cabRow = aoa[header + 1];
    expect(cabRow[0]).toBe('柜顶板');
    // 关键：柜体那行没有面积 —— 它不是按平方米卖的玻璃
    expect(cabRow[3] ?? '').toBe('');
  });

  it('没有缸外结构时不出现该段', () => {
    const back = readBack(buildWorkbook(rows, [], quote));
    const flat = rowsOf(back.Sheets['缸体清单']).flat().map(String);
    expect(flat).not.toContain('缸外结构');
  });

  it('报价四项齐全且合计对得上', () => {
    const back = readBack(buildWorkbook(rows, externRows, quote));
    const aoa = rowsOf(back.Sheets['缸体清单']);
    const at = (label: string) => aoa.find((r) => r[0] === label)?.[1];
    expect(at('玻璃')).toBe(288.6);
    expect(at('切割')).toBe(15);
    expect(at('打胶')).toBe(60);
    expect(at('合计')).toBe(363.6);
  });

  it('玻璃统计按材质汇总', () => {
    const back = readBack(buildWorkbook(rows, externRows, quote));
    const aoa = rowsOf(back.Sheets['玻璃统计']);
    const ultra = aoa.find((r) => r[0] === '超白');
    const float = aoa.find((r) => r[0] === '浮法');
    expect(ultra?.[1]).toBe(0.3758);
    expect(ultra?.[2]).toBe(1);
    expect(float?.[1]).toBe(0.81);
    expect(float?.[2]).toBe(2);

    const total = aoa.find((r) => r[0] === '合计');
    expect(total?.[2]).toBe(3);
  });
});

describe('导出二进制', () => {
  it('产出非空 xlsx Blob', async () => {
    const blob = await exportXlsx(rows, externRows, quote);
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toContain('spreadsheetml');
  });

  it('空清单也能导出', async () => {
    const blob = await exportXlsx([], [], { glass: 0, cut: 0, glue: 0, total: 0 });
    expect(blob.size).toBeGreaterThan(0);
  });
});
