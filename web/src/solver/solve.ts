import type { TankSpec } from '../rules/types';
import type { TankParams, BuildResult, Part, Dimension } from '../model/types';
import { derive } from '../model/derive';

/**
 * 执行一个缸型的全部规则，汇总板件与标注。
 * 求解器不认识任何具体缸型，只按规则顺序执行。
 */
export function solve(spec: TankSpec, p: TankParams): BuildResult {
  const g = derive(p);
  const parts: Part[] = [];
  const dims: Dimension[] = [];

  for (const rule of spec.rules) {
    const produced = rule.parts(g);
    parts.push(...produced);
    if (rule.dims) dims.push(...rule.dims(g, produced));
  }

  return { kind: spec.kind, parts, dims, volumeL: g.volumeL };
}
