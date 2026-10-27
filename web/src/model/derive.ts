import type { TankParams, Geom } from './types';

/** 溢流区最小可用宽度：低于此值做不出可维护的溢流仓 */
export const OVERFLOW_MIN = 70;

export function derive(p: TankParams): Geom {
  const outerL = p.L - 2 * p.sideT;
  const outerW = p.W - 2 * p.sideT;
  const innerL = outerL - 2 * p.gap;
  const innerW = outerW - 2 * p.gap;
  const innerH = p.H - p.bottomT;

  const hasOverflow = p.overflowW >= OVERFLOW_MIN;
  // 规格 §2：溢流仓占用后侧深度，横跨腔深的板件只能用剩下的 usableW，
  // 否则会直接穿过溢流板。没有溢流仓时 floodW 为 0，usable* 退化成完整内腔。
  const floodW = hasOverflow ? p.overflowW + p.baffleT : 0;
  const usableW = innerW - floodW;
  const usableZ = -innerW / 2 + floodW + usableW / 2;

  return {
    ...p,
    outerL, outerW, innerL, innerW, innerH,
    floodW, usableW, usableZ,
    floorY: p.bottomT / 2,
    baffleSpan: innerL / p.baffleCount,
    hasOverflow,
    hasBrace: p.braceW > 0 && p.baffleCut >= 2 * p.sideT,
    hasSand: p.sandW > 0,
    hasPump: p.pumpW > 0,
    volumeL: (innerL * innerW * innerH) / 1e6,
  };
}
