import type { TankParams, TankKind } from './types';

/**
 * 表单与求解器的默认设计参数（毫米）。
 * 400×400×400 全超白标准缸，与规格 §1 的典型值一致。
 */
export const DEFAULT_PARAMS: TankParams = {
  L: 400, W: 400, H: 400,
  sideT: 8, bottomT: 8, baffleT: 6, gap: 1,
  baffleCount: 1, baffleCut: 20,
  overflowW: 69, sandW: 139, pumpW: 49, braceW: 19,
  material: 3,
};

export const DEFAULT_KIND: TankKind = 'jar';
