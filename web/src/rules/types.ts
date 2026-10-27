import type { Geom, Part, Dimension, TankKind } from '../model/types';

/**
 * 一条板件规则：给定派生几何，产出属于该规则的全部板件。
 * 规则是纯函数，无副作用，可以独立测试与组合。
 */
export interface PartRule {
  name: string;
  parts(g: Geom): Part[];
  dims?(g: Geom, parts: Part[]): Dimension[];
}

/**
 * 一种缸型：只声明它由哪些规则组成，不写拼装逻辑。
 * 求解器按顺序执行规则并汇总。
 */
export interface TankSpec {
  kind: TankKind;
  label: string;
  rules: PartRule[];
}
