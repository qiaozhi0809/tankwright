import { describe, it, expect } from 'vitest';
import { clampParams } from '../../src/model/validate';
import type { TankParams } from '../../src/model/types';

const base: TankParams = {
  L: 500, W: 300, H: 400,
  sideT: 8, bottomT: 10, baffleT: 6, gap: 1,
  baffleCount: 3, baffleCut: 40,
  overflowW: 69, sandW: 139, pumpW: 49, braceW: 19,
  material: 0,
};

describe('参数夹紧', () => {
  it('隔板数量不超过 缸长/125', () => {
    const r = clampParams({ ...base, L: 500, baffleCount: 99 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.baffleCount).toBe(4);
  });

  it('隔板数至少为 1', () => {
    const r = clampParams({ ...base, baffleCount: 0 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.baffleCount).toBe(1);
  });

  it('切口过浅时取消拉筋', () => {
    const r = clampParams({ ...base, baffleCut: 10, sideT: 8, braceW: 19 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.braceW).toBe(0);
  });

  it('沙缸加宽时泵仓回落', () => {
    const r = clampParams({ ...base, sandW: 150, pumpW: 90 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.pumpW).toBe(49);
  });

  it('泵仓加宽时沙缸回落', () => {
    const r = clampParams({ ...base, sandW: 150, pumpW: 60 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.sandW).toBe(139);
  });

  it('边长非正时拒绝', () => {
    expect(clampParams({ ...base, H: 0 }).ok).toBe(false);
    expect(clampParams({ ...base, L: -1 }).ok).toBe(false);
  });

  it('玻璃厚度吃掉内腔时拒绝', () => {
    expect(clampParams({ ...base, H: 10, bottomT: 6, sideT: 8 }).ok).toBe(false);
  });

  it('拒绝时给出原因', () => {
    const r = clampParams({ ...base, L: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.length).toBeGreaterThan(0);
  });
});
