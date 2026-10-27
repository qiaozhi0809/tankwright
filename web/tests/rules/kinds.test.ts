import { describe, it, expect } from 'vitest';
import { SPECS, TANK_KINDS } from '../../src/rules';
import { solve } from '../../src/solver/solve';
import { derive } from '../../src/model/derive';
import { checkConformance, aabb } from '../../src/solver/assertions';
import type { TankParams } from '../../src/model/types';

const base: TankParams = {
  L: 900, W: 450, H: 450,
  sideT: 10, bottomT: 10, baffleT: 6, gap: 1,
  baffleCount: 2, baffleCut: 40,
  overflowW: 80, sandW: 139, pumpW: 49, braceW: 19,
  material: 1,
};

const build = (kind: (typeof TANK_KINDS)[number], p: TankParams = base) => ({
  g: derive(p),
  r: solve(SPECS[kind], p),
});

describe('八种缸型注册', () => {
  it('全部注册且顺序稳定', () => {
    expect(TANK_KINDS).toHaveLength(8);
    expect([...TANK_KINDS]).toEqual([
      'jar', 'rack', 'sys', 'filter', 'sideback', 'whole', 'seafood', 'upfilter',
    ]);
    for (const k of TANK_KINDS) expect(SPECS[k]).toBeDefined();
  });

  for (const kind of TANK_KINDS) {
    it(`${kind} 通过一致性检查`, () => {
      const { g, r } = build(kind);
      expect(checkConformance(r, g)).toEqual([]);
      expect(r.parts.length).toBeGreaterThan(0);
      expect(r.kind).toBe(kind);
    });

    it(`${kind} 无非法尺寸或位置`, () => {
      const { r } = build(kind);
      for (const p of r.parts) {
        expect(p.l).toBeGreaterThan(0);
        expect(p.w).toBeGreaterThan(0);
        expect(p.h).toBeGreaterThan(0);
        expect(Number.isFinite(p.x + p.y + p.z)).toBe(true);
      }
    });
  }
});

describe('缸型之间的差异', () => {
  it('系统组缸同时含沙缸与泵仓隔断', () => {
    const { r } = build('sys');
    expect(r.parts.some((p) => p.rule === 'sandDivider')).toBe(true);
    expect(r.parts.some((p) => p.rule === 'pumpDivider')).toBe(true);
  });

  it('底滤缸不含拉筋', () => {
    const { r } = build('filter');
    expect(r.parts.some((p) => p.rule === 'brace')).toBe(false);
  });

  it('底滤缸仍含溢流板与隔板', () => {
    const { r } = build('filter');
    expect(r.parts.some((p) => p.rule === 'overflow')).toBe(true);
    expect(r.parts.some((p) => p.rule === 'baffle')).toBe(true);
  });

  it('铝架缸带铝型材框架', () => {
    const { r } = build('rack');
    expect(r.parts.filter((p) => p.rule === 'rack')).toHaveLength(8);
  });

  it('客厅缸带柜体与灯架', () => {
    const { r } = build('whole');
    expect(r.parts.filter((p) => p.rule === 'cabinet')).toHaveLength(6);
    expect(r.parts.filter((p) => p.rule === 'canopy')).toHaveLength(3);
  });

  it('上滤缸带顶部滤槽', () => {
    const { r } = build('upfilter');
    expect(r.parts.filter((p) => p.rule === 'trough')).toHaveLength(5);
  });

  it('背侧滤缸带背仓隔板', () => {
    // 背仓与溢流仓互斥（规格 §7），所以必须在没有溢流仓的参数下才出现背仓板
    const { r } = build('sideback', { ...base, overflowW: 0 });
    expect(r.parts.filter((p) => p.rule === 'rearBay')).toHaveLength(1);
  });

  it('海鲜池带保温层与分池', () => {
    const { r } = build('seafood');
    expect(r.parts.filter((p) => p.rule === 'insulation')).toHaveLength(4);
    expect(r.parts.filter((p) => p.rule === 'bay')).toHaveLength(2);
  });

  it('标准鱼缸不含任何附属结构', () => {
    const { r } = build('jar');
    for (const rule of ['rack', 'cabinet', 'canopy', 'trough', 'rearBay', 'insulation', 'bay']) {
      expect(r.parts.some((p) => p.rule === rule)).toBe(false);
    }
  });
});

describe('附属结构的包络语义', () => {
  it('铝架与柜体被标为 extern', () => {
    for (const kind of ['rack', 'whole'] as const) {
      const { r } = build(kind);
      const ext = r.parts.filter((p) => p.envelope === 'extern');
      expect(ext.length).toBeGreaterThan(0);
      for (const p of ext) expect(p.envelope).toBe('extern');
    }
  });

  it('extern 构件确实伸到缸体之外', () => {
    // 逐个检查，而非只挑一件：一条规则里可能同时存在贴壁件与伸远件
    for (const kind of ['rack', 'whole', 'upfilter', 'seafood'] as const) {
      const { g, r } = build(kind);
      const ext = r.parts.filter((p) => p.envelope === 'extern');
      expect(ext.length).toBeGreaterThan(0);
      for (const p of ext) {
        const b = aabb(p);
        const outside =
          b.x1 > g.L / 2 + 0.01 || b.x0 < -g.L / 2 - 0.01
          || b.z1 > g.W / 2 + 0.01 || b.z0 < -g.W / 2 - 0.01
          || b.y1 > g.H + 0.01 || b.y0 < -0.01;
        expect(outside, `${kind}/${p.label} 并未伸出缸体`).toBe(true);
      }
    }
  });

  it('若剥掉 extern 标记，C2 会报警', () => {
    const { g, r } = build('rack');
    const stripped = {
      ...r,
      parts: r.parts.map((p) => ({ ...p, envelope: undefined })),
    };
    const bad = checkConformance(stripped, g);
    expect(bad.some((s) => s.startsWith('C2'))).toBe(true);
  });

  it('顶滤槽在缸口之上', () => {
    const { g, r } = build('upfilter');
    for (const p of r.parts.filter((x) => x.rule === 'trough')) {
      expect(aabb(p).y0).toBeGreaterThanOrEqual(g.H);
    }
  });

  it('保温层包在缸体外侧', () => {
    const { g, r } = build('seafood');
    for (const p of r.parts.filter((x) => x.rule === 'insulation')) {
      const b = aabb(p);
      const outside = b.x1 > g.L / 2 || b.x0 < -g.L / 2 || b.z1 > g.W / 2 || b.z0 < -g.W / 2;
      expect(outside).toBe(true);
    }
  });
});

describe('灯架结构连续性', () => {
  const posts = (r: ReturnType<typeof build>['r']) =>
    r.parts.filter((p) => p.rule === 'canopy' && p.label === '灯架立柱');

  it('立柱自柜顶起，不悬空', () => {
    const { r } = build('whole');
    for (const p of posts(r)) {
      expect(aabb(p).y0).toBeLessThanOrEqual(0.01);
    }
  });

  it('立柱全程在玻璃之外', () => {
    const { g, r } = build('whole');
    for (const p of posts(r)) {
      const b = aabb(p);
      expect(b.x0 >= g.L / 2 - 0.01 || b.x1 <= -g.L / 2 + 0.01).toBe(true);
    }
  });

  it('立柱不穿过缸壁体积', () => {
    const { g, r } = build('whole');
    for (const p of posts(r)) {
      const b = aabb(p);
      const insideX = b.x0 < g.L / 2 - 0.01 && b.x1 > -g.L / 2 + 0.01;
      expect(insideX && b.y0 < g.H - 0.01).toBe(false);
    }
  });

  it('横梁坐在立柱顶上', () => {
    const { r } = build('whole');
    const beam = r.parts.find((p) => p.rule === 'canopy' && p.label === '灯架横梁')!;
    const postTop = Math.max(...posts(r).map((p) => aabb(p).y1));
    expect(aabb(beam).y0).toBeCloseTo(postTop, 5);
  });

  it('柜顶板伸到立柱之外，托得住', () => {
    const { r } = build('whole');
    const top = r.parts.find((p) => p.rule === 'cabinet' && p.label === '柜顶板')!;
    const postReach = Math.max(...posts(r).map((p) => Math.max(Math.abs(aabb(p).x0), Math.abs(aabb(p).x1))));
    const topReach = Math.max(Math.abs(aabb(top).x0), Math.abs(aabb(top).x1));
    expect(topReach).toBeGreaterThanOrEqual(postReach);
  });
});

describe('分池与滤仓互不干扰', () => {
  it('分池隔板等距且落在内腔', () => {
    const { g, r } = build('seafood');
    const xs = r.parts.filter((p) => p.rule === 'bay').map((p) => p.x).sort((a, b) => a - b);
    expect(xs).toHaveLength(2);
    expect(xs[1] - xs[0]).toBeCloseTo(g.innerL / 3, 5);
    for (const x of xs) expect(Math.abs(x)).toBeLessThan(g.innerL / 2);
  });

  it('分池段数与 baffleCount 无关', () => {
    const a = build('seafood', { ...base, baffleCount: 1 });
    const b = build('seafood', { ...base, baffleCount: 4 });
    const xsA = a.r.parts.filter((p) => p.rule === 'bay').map((p) => p.x);
    const xsB = b.r.parts.filter((p) => p.rule === 'bay').map((p) => p.x);
    expect(xsA).toEqual(xsB);
  });

  it('背仓与溢流仓互斥：溢流仓胜出', () => {
    const { r } = build('sideback', { ...base, overflowW: 80 });
    expect(r.parts.filter((p) => p.rule === 'rearBay')).toHaveLength(0);
    expect(r.parts.filter((p) => p.rule === 'overflow')).toHaveLength(1);
  });

  it('背仓与溢流仓互斥：无溢流时才出背仓', () => {
    const { r } = build('sideback', { ...base, overflowW: 0 });
    expect(r.parts.filter((p) => p.rule === 'rearBay')).toHaveLength(1);
    expect(r.parts.filter((p) => p.rule === 'overflow')).toHaveLength(0);
  });

  it('互斥在三种 overflowW 下都成立', () => {
    for (const overflowW of [80, 120, 160]) {
      const { g, r } = build('sideback', { ...base, overflowW });
      expect(r.parts.some((p) => p.rule === 'rearBay')).toBe(false);
      expect(checkConformance(r, g)).toEqual([]);
    }
  });

  it('C6c 对同时含背仓与溢流的结果报警', () => {
    const { g, r } = build('sideback', { ...base, overflowW: 0 });
    // 手工塞一块溢流板进来，构造出规格禁止的组合
    const fake = {
      ...r,
      parts: [
        ...r.parts,
        { rule: 'overflow', label: '溢流板', l: g.innerL, w: g.innerH - 10, h: g.baffleT,
          x: 0, y: g.bottomT / 2 + g.innerH / 2, z: -g.innerW / 2 + 40, material: 'float' as const },
      ],
    };
    const bad = checkConformance(fake, g);
    expect(bad.some((s) => s.startsWith('C6c'))).toBe(true);
  });
});
