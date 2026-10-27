import type { Part, Hole } from '../model/types';

/**
 * 布尔切除的上下余量（mm）。孔的深度只取板厚会让切面与板面共面，
 * 在 CSG 里留下零厚度的碎片，所以两头各多切 1mm。
 */
const OVERCUT = 1;

/**
 * 把孔挂到板件上。板件本体尺寸与位置不变，只带一份加过余量的孔副本。
 *
 * 空孔集返回**原对象**（引用相等），让调用方可以安全地把 `attachHole` 串在
 * 每条规则后面而不产生无谓的拷贝。
 *
 * 非空时**追加**而不是覆盖：同一块板可能既要梳齿开口又要穿板钻孔，
 * 第二次调用不该把第一批孔吞掉。追加的孔同样各加一份余量。
 */
export function attachHole(part: Part, holes: Hole[]): Part {
  if (holes.length === 0) return part;
  const incoming = holes.map((h) => ({ ...h, h: h.h + OVERCUT * 2 }));
  return {
    ...part,
    holes: [...(part.holes ?? []), ...incoming],
  };
}
