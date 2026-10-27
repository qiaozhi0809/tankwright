import type { BuildResult, Geom, Part } from '../model/types';
import { OVERFLOW_LIP } from '../rules/overflow';

/** 尺寸比较容差（mm），吸收浮点尾数 */
const TOL = 0.01;
/** 规格 §5 C2 容许的胶缝溢出（mm） */
const BOUND_TOL = 1;

export interface Extent {
  ex: number;
  ey: number;
  ez: number;
}

/**
 * 板件的世界轴向外廓尺寸。
 * `l/w/h` 是旋转**前**的盒体尺寸（X/Y/Z），旋转分母把轴映射到世界方向：
 *   rx: 绕 X 转 π/2 → Y↔Z
 *   ry: 绕 Y 转 π/2 → X↔Z
 *   rz: 绕 Z 转 π/2 → X↔Y
 * 不做这层映射就量不出真实包围盒，C2 会量错轴。
 */
export function worldExtent(p: Part): Extent {
  if (p.rx) return { ex: p.l, ey: p.h, ez: p.w };
  if (p.ry) return { ex: p.h, ey: p.w, ez: p.l };
  if (p.rz) return { ex: p.w, ey: p.l, ez: p.h };
  return { ex: p.l, ey: p.w, ez: p.h };
}

interface Aabb {
  x0: number; x1: number;
  y0: number; y1: number;
  z0: number; z1: number;
}

export function aabb(p: Part): Aabb {
  const e = worldExtent(p);
  return {
    x0: p.x - e.ex / 2, x1: p.x + e.ex / 2,
    y0: p.y - e.ey / 2, y1: p.y + e.ey / 2,
    z0: p.z - e.ez / 2, z1: p.z + e.ez / 2,
  };
}

/**
 * 各规则在规格 §3.1–3.8 里声明的世界向尺寸。
 * 一个候选表示该规则的板件可能取的外廓（拉筋有两种走向，故有两个候选）。
 */
function expectedExtents(rule: string, g: Geom): Extent[] | null {
  switch (rule) {
    case 'floor':
      return [{ ex: g.outerL - 2 * g.gap, ey: g.bottomT, ez: g.outerW - 2 * g.gap }];
    case 'frontBack':
      return [{ ex: g.L, ey: g.H, ez: g.sideT }];
    case 'leftRight':
      return [{ ex: g.sideT, ey: g.H, ez: g.outerW - 2 * g.gap }];
    case 'brace':
      return [
        { ex: g.innerL, ey: g.sideT, ez: g.braceW }, // 前后拉筋：沿缸长
        { ex: g.braceW, ey: g.sideT, ez: g.innerW }, // 左右拉筋：沿缸深
      ];
    case 'overflow':
      return [{ ex: g.innerL, ey: g.innerH - OVERFLOW_LIP, ez: g.baffleT }];
    case 'baffle':
      return [{ ex: g.baffleT, ey: g.innerH - g.baffleCut, ez: g.usableW }];
    case 'sandDivider':
    case 'pumpDivider':
      return [{ ex: g.baffleT, ey: g.innerH, ez: g.usableW }];
    default:
      return null; // 未知规则不判朝向
  }
}

function sameExtent(a: Extent, b: Extent): boolean {
  return Math.abs(a.ex - b.ex) <= TOL
    && Math.abs(a.ey - b.ey) <= TOL
    && Math.abs(a.ez - b.ez) <= TOL;
}

/**
 * 规格 §5 的一致性检查。返回违例描述，空数组表示通过。
 *
 * 断言全部来自几何自洽性与规格 §3 的尺寸声明，不引用任何外部实现。
 */
export function checkConformance(r: BuildResult, g: Geom): string[] {
  const bad: string[] = [];
  const seen = new Map<string, number>();

  for (const p of r.parts) {
    const tag = p.label || p.rule;
    const idx = (seen.get(tag) ?? 0) + 1;
    seen.set(tag, idx);
    const who = `${tag}#${idx}`;

    // ---- C1 尺寸与位置有效性 ----
    if (!(p.l > 0) || !(p.w > 0) || !(p.h > 0)) {
      bad.push(`C1 ${who} 尺寸非正 (${p.l}x${p.w}x${p.h})`);
    }
    if (![p.x, p.y, p.z].every(Number.isFinite)) {
      bad.push(`C1 ${who} 位置非有限数`);
    }
    if (!Number.isFinite(p.l) || !Number.isFinite(p.w) || !Number.isFinite(p.h)) continue;

    const b = aabb(p);

    // ---- C2 包围盒落在缸体内 ----
    // 缸体外的附属结构（柜体、铝架、顶滤槽、保温层）不参与本条，理由见 Part.envelope。
    const isExtern = p.envelope === 'extern';
    const halfL = g.L / 2 + BOUND_TOL;
    const halfW = g.W / 2 + BOUND_TOL;
    if (!isExtern) {
      if (b.x0 < -halfL || b.x1 > halfL) bad.push(`C2 ${who} 超出长度范围 x[${b.x0.toFixed(1)}, ${b.x1.toFixed(1)}]`);
      if (b.z0 < -halfW || b.z1 > halfW) bad.push(`C2 ${who} 超出宽度范围 z[${b.z0.toFixed(1)}, ${b.z1.toFixed(1)}]`);
      if (b.y0 < -BOUND_TOL || b.y1 > g.H + BOUND_TOL) bad.push(`C2 ${who} 超出高度范围 y[${b.y0.toFixed(1)}, ${b.y1.toFixed(1)}]`);
    }

    // ---- C2b 朝向符合规格 §3 的尺寸声明 ----
    const want = expectedExtents(p.rule, g);
    if (want && !want.some((w) => sameExtent(worldExtent(p), w))) {
      const got = worldExtent(p);
      bad.push(
        `C2b ${who} 朝向不符 实际(${got.ex}x${got.ey}x${got.ez}) `
        + `期望${want.map((w) => `(${w.ex}x${w.ey}x${w.ez})`).join(' 或 ')}`,
      );
    }
  }

  // ---- C3 前后板外表面间距 = W ----
  const fronts = r.parts.filter((p) => p.rule === 'frontBack');
  if (fronts.length) {
    const reach = Math.max(...fronts.map((p) => {
      const b = aabb(p);
      return Math.max(Math.abs(b.z0), Math.abs(b.z1));
    }));
    if (Math.abs(reach * 2 - g.W) > TOL) {
      bad.push(`C3 前后板外表面间距 ${(reach * 2).toFixed(2)} ≠ W ${g.W}`);
    }
  }

  // ---- C4 左右板外表面间距 = L ----
  const sides = r.parts.filter((p) => p.rule === 'leftRight');
  if (sides.length) {
    const reach = Math.max(...sides.map((p) => {
      const b = aabb(p);
      return Math.max(Math.abs(b.x0), Math.abs(b.x1));
    }));
    if (Math.abs(reach * 2 - g.L) > TOL) {
      bad.push(`C4 左右板外表面间距 ${(reach * 2).toFixed(2)} ≠ L ${g.L}`);
    }
  }

  // ---- C5 底板上表面 = bottomT ----
  for (const p of r.parts.filter((x) => x.rule === 'floor')) {
    const b = aabb(p);
    if (Math.abs(b.y1 - g.bottomT) > TOL) {
      bad.push(`C5 底板上表面 ${b.y1.toFixed(2)} ≠ bottomT ${g.bottomT}`);
    }
  }

  // ---- C6 板件不得侵入四壁厚度带 ----
  // 规格 C6 的完整形式是「相邻板件间隙 ∈ [0, 2·gap]，不重叠不穿透」。角部拉筋
  // 按 §3.4 是搭接的（四根拉筋在四角必然相交），全局两两不穿透不可判定。
  // 这里断言两层可判定的强性质：① 板件落在内腔以内，不得嵌进壁厚；
  // ② 横跨腔深的板件不得穿过溢流板（§2 的 usableW / usableZ 就是为了这条）。
  const cavX = g.L / 2 - g.sideT + BOUND_TOL;
  const cavZ = g.W / 2 - g.sideT + BOUND_TOL;
  for (const p of r.parts) {
    if (!Number.isFinite(p.l)) continue;
    // 四壁本身构成壁厚带；缸体外附属结构不在腔体里，两者都不参与本项检查
    if (p.rule === 'frontBack' || p.rule === 'leftRight') continue;
    if (p.envelope === 'extern') continue;
    const b = aabb(p);
    if (b.x0 < -cavX || b.x1 > cavX) bad.push(`C6 ${p.label} 侵入左右壁厚带 x[${b.x0.toFixed(1)}, ${b.x1.toFixed(1)}]`);
    if (b.z0 < -cavZ || b.z1 > cavZ) bad.push(`C6 ${p.label} 侵入前后壁厚带 z[${b.z0.toFixed(1)}, ${b.z1.toFixed(1)}]`);
  }

  // ---- C6b 隔板 / 隔断不得穿过溢流板 ----
  const overflowParts = r.parts.filter((p) => p.rule === 'overflow');
  if (overflowParts.length) {
    const ov = aabb(overflowParts[0]);
    for (const p of r.parts) {
      if (p.rule !== 'baffle' && p.rule !== 'sandDivider' && p.rule !== 'pumpDivider') continue;
      const b = aabb(p);
      const oz = Math.min(b.z1, ov.z1) - Math.max(b.z0, ov.z0);
      if (oz > TOL) {
        bad.push(`C6b ${p.label} 穿过溢流板 z 重叠 ${oz.toFixed(1)}mm`);
      }
    }
  }

  // ---- C6c 背仓与溢流仓互斥（规格 §7） ----
  // 两者占同一段深度带：同时出现时背仓板会把溢流板围合（overflowW=80）、
  // 与之完全重合（=120）或反转到它之前（>120），三种都不是可施工的几何。
  // 要断言的是「互斥」这个性质本身，不是穿越检测。
  if (r.parts.some((p) => p.rule === 'rearBay') && overflowParts.length) {
    bad.push('C6c 背仓隔板与溢流板同时存在（规格 §7 规定二者互斥，溢流仓胜出）');
  }

  // ---- C7 容积自洽 ----
  const v = (g.innerL * g.innerW * g.innerH) / 1e6;
  if (!(v > 0) || Math.abs(r.volumeL - v) / v > 0.005) {
    bad.push(`C7 容积 ${r.volumeL.toFixed(3)}L 与内腔 ${v.toFixed(3)}L 不符`);
  }

  // ---- C8 隔板均匀分布 ----
  const xs = r.parts.filter((p) => p.rule === 'baffle').map((p) => p.x).sort((a, b) => a - b);
  if (xs.length >= 2) {
    const gaps = xs.slice(1).map((x, i) => x - xs[i]);
    for (const gp of gaps) {
      if (Math.abs(gp - gaps[0]) > TOL) {
        bad.push(`C8 隔板间距不均匀 (${gaps.map((n) => n.toFixed(1)).join(', ')})`);
        break;
      }
    }
  }

  // ---- C9 溢流阈值 ----
  if (!g.hasOverflow && r.parts.some((p) => p.rule === 'overflow')) {
    bad.push(`C9 overflowW ${g.overflowW} 未达阈值却生成了溢流板`);
  }

  // ---- C10 拉筋阈值 ----
  if (!g.hasBrace && r.parts.some((p) => p.rule === 'brace')) {
    bad.push(`C10 切口 ${g.baffleCut} 小于 2·sideT ${2 * g.sideT} 却生成了拉筋`);
  }

  return bad;
}
