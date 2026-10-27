import type { PartRule, TankSpec } from './types';
import { plateDims } from './dimension';
import { gradeFor } from './materials';
import { floorRule, frontBackRule, leftRightRule } from './base';
import { braceRule } from './brace';
import { overflowRule } from './overflow';
import { baffleRule } from './baffle';

/** 保温层厚度 */
const INS_T = 30;

/**
 * 保温层：前后左右各一块外包板，把缸体裹起来。
 *
 * 取舍：只做四面，不做顶盖与底垫——顶盖要开灯孔、底垫要承受缸体重量，
 * 都属于现场铺设件。四面板足以给出挤塑板的裁切尺寸。
 * 四块都贴在缸体外表面之外，属于缸体外附属结构。
 */
export const insulationRule: PartRule = {
  name: 'insulation',
  parts(g) {
    const yc = g.H / 2;
    const material = gradeFor(g, 'insulation', 'side');
    const plate = (label: string, L: number, W: number, H: number, x: number, y: number, z: number) => ({
      rule: 'insulation', label, l: L, w: W, h: H, x, y, z,
      material, envelope: 'extern' as const,
    });

    return [
      plate('保温层', g.L + INS_T * 2, g.H, INS_T, 0, yc, g.W / 2 + INS_T / 2),
      plate('保温层', g.L + INS_T * 2, g.H, INS_T, 0, yc, -(g.W / 2 + INS_T / 2)),
      plate('保温层', INS_T, g.H, g.W, g.L / 2 + INS_T / 2, yc, 0),
      plate('保温层', INS_T, g.H, g.W, -(g.L / 2 + INS_T / 2), yc, 0),
    ];
  },
  dims(_g, parts) {
    return plateDims(parts);
  },
};

/** 分池格数：海鲜池按品种隔离，三格是常见配置 */
const BAYS = 3;

/**
 * 分池：把内腔沿缸长等分成 BAYS 段，需要 BAYS − 1 块横向隔板。
 *
 * 隔板横跨可用腔深，避让溢流仓（与隔板规则同一基准），贴底到缸口满高——
 * 海鲜池分池要挡住活体游动，不能像滤仓隔板那样留过水口。
 */
export const bayRule: PartRule = {
  name: 'bay',
  parts(g) {
    const out = [];
    const material = gradeFor(g, 'bay', 'side');
    // 分池按 BAYS 独立等分，与滤仓隔板数 baffleCount 无关——两者是不同的仓格体系
    const span = g.innerL / BAYS;
    for (let i = 1; i < BAYS; i++) {
      out.push({
        rule: 'bay',
        label: '分池隔板',
        // 与 baffleRule 同一写法：长边先沿 X 声明，再用 ry 转到跨腔深方向。
        // 两种表达的世界外廓都是 baffleT × innerH × usableW，但同一形状只用一种写法。
        l: g.usableW,
        w: g.innerH,
        h: g.baffleT,
        x: -g.innerL / 2 + span * i,
        y: g.bottomT + g.innerH / 2,
        z: g.usableZ,
        ry: 2,
        material,
      });
    }
    return out;
  },
  dims(_g, parts) {
    return plateDims(parts);
  },
};

/**
 * 海鲜池：缸体 + 保温层 + 分池。
 */
export const seafoodSpec: TankSpec = {
  kind: 'seafood',
  label: '海鲜池',
  rules: [floorRule, frontBackRule, leftRightRule, braceRule, overflowRule, baffleRule, insulationRule, bayRule],
};
