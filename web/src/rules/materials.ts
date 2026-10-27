import type { Geom, GlassGrade } from '../model/types';

/** 板件在缸体上的位置分区，决定玻璃等级（规格 §6） */
export type Slot = 'floor' | 'front' | 'back' | 'side';

/**
 * 规格 §6 的材质分区：
 *   material 0 全浮法 / 1 底背超白 / 2 正面超白 / 3 全超白
 */
export function gradeFor(g: Geom, _rule: string, slot: Slot): GlassGrade {
  const m = g.material;
  if (m === 3) return 'ultra';
  if (m === 1 && (slot === 'floor' || slot === 'back')) return 'ultra';
  if (m === 2 && slot === 'front') return 'ultra';
  return 'float';
}
