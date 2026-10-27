import type { TankKind } from '../model/types';
import { TANK_KINDS } from '../model/types';
import type { TankSpec } from './types';
import { jarSpec } from './jar';
import { rackSpec } from './rack';
import { sysSpec } from './sys';
import { filterSpec } from './filter';
import { sidebackSpec } from './sideback';
import { wholeSpec } from './whole';
import { seafoodSpec } from './seafood';
import { upfilterSpec } from './upfilter';

/**
 * 全部缸型的注册表。清单本身由 `model/types.ts` 拥有 —— 这里只转发，
 * 不再各写一份，免得规则层与分享链接对"有几种缸"产生分歧。
 */
export { TANK_KINDS };

export const SPECS: Record<TankKind, TankSpec> = {
  jar: jarSpec,
  rack: rackSpec,
  sys: sysSpec,
  filter: filterSpec,
  sideback: sidebackSpec,
  whole: wholeSpec,
  seafood: seafoodSpec,
  upfilter: upfilterSpec,
};
