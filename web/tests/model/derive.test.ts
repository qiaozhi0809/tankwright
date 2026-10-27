import { describe, it, expect } from 'vitest';
import { derive } from '../../src/model/derive';
import type { TankParams } from '../../src/model/types';

export const base: TankParams = {
  L: 400, W: 400, H: 400,
  sideT: 8, bottomT: 8, baffleT: 6, gap: 1,
  baffleCount: 1, baffleCut: 20,
  overflowW: 69, sandW: 139, pumpW: 49, braceW: 19,
  material: 3,
};

describe('派生几何', () => {
  it('外观跨度 = 标称 - 2 倍侧板厚', () => {
    const g = derive(base);
    expect(g.outerL).toBe(400 - 16);
    expect(g.outerW).toBe(400 - 16);
  });

  it('内腔 = 标称 - 2 倍侧板厚 - 2 倍胶缝', () => {
    const g = derive(base);
    expect(g.innerL).toBe(400 - 16 - 2);
    expect(g.innerW).toBe(400 - 16 - 2);
  });

  it('内腔高 = 总高 - 底板厚', () => {
    expect(derive(base).innerH).toBe(392);
  });

  it('底板中心在底板厚的一半处', () => {
    expect(derive(base).floorY).toBe(4);
  });

  it('容积按内腔算，单位升', () => {
    const g = derive(base);
    const expected = (382 * 382 * 392) / 1e6;
    expect(g.volumeL).toBeCloseTo(expected, 3);
  });

  it('溢流阈值 70', () => {
    expect(derive({ ...base, overflowW: 69 }).hasOverflow).toBe(false);
    expect(derive({ ...base, overflowW: 70 }).hasOverflow).toBe(true);
  });

  it('拉筋需要切口高度足够', () => {
    expect(derive({ ...base, baffleCut: 10, sideT: 8 }).hasBrace).toBe(false);
    expect(derive({ ...base, baffleCut: 20, sideT: 8 }).hasBrace).toBe(true);
  });

  it('隔板段宽均匀', () => {
    const g = derive({ ...base, baffleCount: 4 });
    expect(g.baffleSpan).toBeCloseTo(g.innerL / 4, 6);
  });

  it('沙缸与泵仓宽度原样带出', () => {
    const g = derive({ ...base, sandW: 150, pumpW: 90 });
    expect(g.sandW).toBe(150);
    expect(g.pumpW).toBe(90);
  });
});
