import { describe, it, expect } from 'vitest';
import { envelopeUnchanged } from '../../src/render/tankBridge';
import type { TankParams } from '../../src/model/types';

const base: TankParams = {
  L: 900, W: 450, H: 450,
  sideT: 10, bottomT: 10, baffleT: 6, gap: 1,
  baffleCount: 3, baffleCut: 40,
  overflowW: 80, sandW: 139, pumpW: 49, braceW: 19,
  material: 3,
};

describe('造景保留判定', () => {
  it('首次重建没有上一份参数，必须重建底床', () => {
    expect(envelopeUnchanged(null, base)).toBe(false);
    expect(envelopeUnchanged(undefined, base)).toBe(false);
  });

  it('只改隔板数量时保留造景', () => {
    // 隔板是缸内零件，不动外廓；用户摆的水草石头没有理由被清空
    expect(envelopeUnchanged(base, { ...base, baffleCount: 4 })).toBe(true);
  });

  it('只改溢流宽度时保留造景', () => {
    expect(envelopeUnchanged(base, { ...base, overflowW: 69 })).toBe(true);
  });

  it('只改材质与沙缸泵仓时保留造景', () => {
    expect(envelopeUnchanged(base, { ...base, material: 0, sandW: 150, pumpW: 90 })).toBe(true);
  });

  it('改缸长时丢弃造景', () => {
    // 缸变小，已摆的石头会穿出去；缸变大，底床会悬空
    expect(envelopeUnchanged(base, { ...base, L: 901 })).toBe(false);
  });

  it('改缸宽或缸高时丢弃造景', () => {
    expect(envelopeUnchanged(base, { ...base, W: 451 })).toBe(false);
    expect(envelopeUnchanged(base, { ...base, H: 451 })).toBe(false);
  });

  it('改玻璃厚时丢弃造景', () => {
    // 内腔随玻璃厚变化，底床的可用范围跟着变
    expect(envelopeUnchanged(base, { ...base, sideT: 12 })).toBe(false);
    expect(envelopeUnchanged(base, { ...base, bottomT: 12 })).toBe(false);
  });
});
