import { describe, it, expect } from 'vitest';
import { sizeText, formatMm } from '../../src/model/size';
import { plateDims } from '../../src/rules/dimension';
import { buildBOM } from '../../src/quote/bom';
import type { Part } from '../../src/model/types';

/**
 * 这批用例守的是 **Task 11 复审指出的分叉风险**：图纸标注与下料清单曾各自实现了
 * 一份尺寸格式化，结果一致纯属巧合。现在两者都走 `model/size.ts`，下面的断言
 * 一旦有人重新写一份本地格式化就会挂。
 */
const fractional: Part = {
  rule: 'frontBack', label: '前后',
  // 12.34 是关键取值：保留 0.1mm 得 12.3，四舍五入到整数得 12 —— 两种实现会分叉
  l: 12.34, w: 400, h: 8,
  x: 0, y: 200, z: 0, material: 'float',
};

describe('尺寸格式单点拥有', () => {
  it('图纸标注与下料清单输出同一串', () => {
    const fromDims = plateDims([fractional])[0].text;
    const fromBom = buildBOM([fractional])[0].size;
    expect(fromDims).toBe(fromBom);
  });

  it('同一板件三条路径字面相同', () => {
    expect(plateDims([fractional])[0].text).toBe(sizeText(fractional));
    expect(buildBOM([fractional])[0].size).toBe(sizeText(fractional));
  });

  it('保留到 0.1mm，不是取整', () => {
    // 若某个实现换成 Math.round(n)，这里会得到 12，测试立刻失败
    expect(sizeText(fractional)).toBe('12.3x400x8');
    expect(formatMm(12.34)).toBe('12.3');
  });

  it('整数不拖小数点', () => {
    expect(sizeText({ l: 878, w: 428, h: 10 })).toBe('878x428x10');
  });

  it('格式是 小写x / 无空格', () => {
    expect(sizeText(fractional)).toMatch(/^\d+(\.\d)?x\d+(\.\d)?x\d+(\.\d)?$/);
  });
});
