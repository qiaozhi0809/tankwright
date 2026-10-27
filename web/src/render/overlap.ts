import type { BuildResult } from '../model/types';

/**
 * 底座 `tank.js` 自己就会画柜体、灯条和背景，并且它们住在同一个 `tank.group`。
 * 结构层为了下料清单也会产出柜体和灯架（`envelope === 'extern'`），如果原样
 * 挂进场景，`whole` 缸会出现两套柜子、两盏灯，比例还不一样。
 *
 * 所以渲染前剔掉这些"底座已经画了"的构件 —— 它们仍然留在 `BuildResult` 里
 * 供清单使用，只是不进场景。
 */
export const BASE_DRAWS: ReadonlySet<string> = new Set(['cabinet', 'canopy']);

export function forRender(result: BuildResult): BuildResult {
  const parts = result.parts.filter(
    (p) => !(p.envelope === 'extern' && BASE_DRAWS.has(p.rule)),
  );
  return parts.length === result.parts.length ? result : { ...result, parts };
}
