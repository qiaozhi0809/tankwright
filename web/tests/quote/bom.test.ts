import { describe, it, expect } from 'vitest';
import { buildBOM, buildExternBOM, sizeText } from '../../src/quote/bom';
import { priceBOM } from '../../src/quote/pricing';
import type { Part } from '../../src/model/types';

const cfg = { ultraPerM2: 380, floatPerM2: 180, cutPerPart: 5, glue: 60 };

const parts: Part[] = [
  { rule: 'frontBack', label: '前后', l: 500, w: 400, h: 8, x: 0, y: 200, z: 154, material: 'ultra' },
  { rule: 'leftRight', label: '左右', l: 384, w: 400, h: 8, x: 254, y: 200, z: 0, ry: 2, material: 'float' },
  { rule: 'leftRight', label: '左右', l: 384, w: 400, h: 8, x: -254, y: 200, z: 0, ry: 2, material: 'float' },
];

/** 900×450×18 的柜顶板 —— 带 float 级别的占位材质，但它是 extern，不是玻璃 */
const cabinet: Part = {
  rule: 'cabinet', label: '柜体', l: 900, w: 450, h: 18,
  x: 0, y: -9, z: 0, material: 'float', envelope: 'extern',
};

describe('下料清单', () => {
  it('同材质同尺寸合并计数', () => {
    const row = buildBOM(parts).find((r) => r.grade === 'float' && r.size === '384x400x8');
    expect(row?.count).toBe(2);
  });

  it('不同材质分开统计', () => {
    expect(new Set(buildBOM(parts).map((r) => r.grade)).size).toBe(2);
  });

  it('面积为平方米', () => {
    const ultra = buildBOM(parts).find((r) => r.grade === 'ultra')!;
    expect(ultra.areaM2).toBeCloseTo((500 * 400) / 1e6, 6);
  });

  it('面积随件数累加', () => {
    const row = buildBOM(parts).find((r) => r.grade === 'float')!;
    expect(row.areaM2).toBeCloseTo(((384 * 400) / 1e6) * 2, 6);
  });

  it('尺寸文本为小写 x、无空格', () => {
    expect(sizeText(parts[0])).toBe('500x400x8');
    expect(buildBOM(parts).every((r) => /^\d+(\.\d)?x\d+(\.\d)?x\d+(\.\d)?$/.test(r.size))).toBe(true);
  });
});

describe('extern 构件不是玻璃', () => {
  it('不计入下料清单', () => {
    expect(buildBOM([...parts, cabinet])).toEqual(buildBOM(parts));
  });

  it('不影响玻璃报价总额', () => {
    const a = priceBOM(buildBOM(parts), cfg);
    const b = priceBOM(buildBOM([...parts, cabinet]), cfg);
    expect(b.total).toBeCloseTo(a.total, 6);
    expect(b.glass).toBeCloseTo(a.glass, 6);
  });

  it('不会被静默丢弃，单独成表', () => {
    const rows = buildExternBOM([...parts, cabinet]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ rule: 'cabinet', label: '柜体', count: 1 });
  });

  it('extern 表里没有面积字段', () => {
    const [row] = buildExternBOM([cabinet]);
    expect('areaM2' in row).toBe(false);
  });
});

describe('报价', () => {
  it('总价由玻璃与加工构成', () => {
    const q = priceBOM(buildBOM(parts), cfg);
    expect(q.total).toBeCloseTo(q.glass + q.cut + q.glue, 6);
  });

  it('空清单为 0', () => {
    expect(priceBOM([], cfg).total).toBe(0);
  });

  it('超白比浮法贵', () => {
    const rows = buildBOM(parts);
    expect(priceBOM(rows.filter((r) => r.grade === 'ultra'), cfg).glass)
      .toBeGreaterThan(priceBOM(rows.filter((r) => r.grade === 'float'), cfg).glass);
  });

  it('加工费按件数计', () => {
    const q = priceBOM(buildBOM(parts), cfg);
    expect(q.cut).toBeCloseTo(3 * cfg.cutPerPart, 6);
  });

  it('金额保留两位小数', () => {
    const q = priceBOM(buildBOM(parts), cfg);
    expect(q.total).toBeCloseTo(Math.round(q.total * 100) / 100, 6);
  });
});

describe('开孔加工费', () => {
  const hole = (x: number) => ({
    kind: 'circle' as const, l: 30, w: 30, h: 20, x, y: 0, z: 0, style: 'drill' as const,
  });

  /** 一块打了三个穿板孔的板，尺寸与浮法那块完全相同 */
  const drilled: Part = {
    rule: 'leftRight', label: '左右', l: 384, w: 400, h: 8,
    x: 254, y: 200, z: 0, ry: 2, material: 'float',
    holes: [hole(0), hole(50), hole(100)],
  };

  const unpierced: Part = { ...drilled, holes: undefined };

  it('清单里带出合并后的孔数', () => {
    const rows = buildBOM([drilled, unpierced]);
    const row = rows.find((r) => r.size === '384x400x8')!;
    expect(row.count).toBe(2);
    // 两块同尺寸的板合并成一行，孔数按件累加：3 + 0
    expect(row.holes).toBe(3);
  });

  it('三个孔比零个孔多收 3 份钻孔费', () => {
    const priced = { ...cfg, holesPerPart: 9 };
    const withHoles = priceBOM(buildBOM([drilled]), priced);
    const blank = priceBOM(buildBOM([unpierced]), priced);
    expect(withHoles.cut - blank.cut).toBeCloseTo(3 * 9, 6);
  });

  it('未配置钻孔单价时按 0 计，老配置继续可用', () => {
    // cfg 里没有 holesPerPart —— 不能因此算出 NaN，也不能多收钱
    const withHoles = priceBOM(buildBOM([drilled]), cfg);
    const blank = priceBOM(buildBOM([unpierced]), cfg);
    expect(withHoles.cut).toBeCloseTo(blank.cut, 6);
    expect(Number.isFinite(withHoles.total)).toBe(true);
  });

  it('钻孔费计入加工费而不是玻璃费', () => {
    const priced = { ...cfg, holesPerPart: 9 };
    const q = priceBOM(buildBOM([drilled]), priced);
    const q0 = priceBOM(buildBOM([unpierced]), priced);
    expect(q.glass).toBeCloseTo(q0.glass, 6);
    expect(q.cut).toBeGreaterThan(q0.cut);
  });
});
