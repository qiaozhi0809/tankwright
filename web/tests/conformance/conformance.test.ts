import { describe, it, expect } from 'vitest';
import { jarSpec } from '../../src/rules/jar';
import { solve } from '../../src/solver/solve';
import { derive } from '../../src/model/derive';
import { clampParams } from '../../src/model/validate';
import { checkConformance, worldExtent, aabb } from '../../src/solver/assertions';
import type { BuildResult, TankParams } from '../../src/model/types';

/** 只有底板与四壁：规格里最简、没有组合歧义的构型 */
const plain: TankParams = {
  L: 900, W: 450, H: 450,
  sideT: 10, bottomT: 10, baffleT: 6, gap: 1,
  baffleCount: 1, baffleCut: 40,
  overflowW: 0, sandW: 0, pumpW: 0, braceW: 0,
  material: 1,
};

const withBrace: TankParams = { ...plain, braceW: 19 };
const withBaffle: TankParams = { ...plain, braceW: 19, baffleCount: 3 };
const withOverflow: TankParams = { ...plain, braceW: 19, overflowW: 80 };
const withDivider: TankParams = { ...plain, sandW: 139, pumpW: 49 };

function run(p: TankParams) {
  const g = derive(p);
  return { g, r: solve(jarSpec, p) };
}

/** 复制一份合法结果，改坏它，用来证明检查器真的会响 */
function broken(p: TankParams, mutate: (r: BuildResult) => void): string[] {
  const g = derive(p);
  const r = solve(jarSpec, p);
  mutate(r);
  return checkConformance(r, g);
}

describe('合格构型全部通过', () => {
  for (const [name, p] of Object.entries({
    plain, withBrace, withBaffle, withOverflow, withDivider,
  })) {
    it(`${name} 无违例`, () => {
      const { g, r } = run(p);
      expect(checkConformance(r, g)).toEqual([]);
    });
  }
});

describe('C1 尺寸有效性', () => {
  it('零厚度板件被抓出', () => {
    const v = broken(plain, (r) => { r.parts[0].l = 0; });
    expect(v.some((m) => m.startsWith('C1'))).toBe(true);
  });

  it('非有限位置被抓出', () => {
    const v = broken(plain, (r) => { r.parts[0].x = Number.NaN; });
    expect(v.some((m) => m.startsWith('C1'))).toBe(true);
  });
});

describe('C2 包围盒与朝向', () => {
  it('板件被推出缸体被抓出', () => {
    const v = broken(plain, (r) => { r.parts[0].x = 2000; });
    expect(v.some((m) => m.startsWith('C2 '))).toBe(true);
  });

  it('长边躺错轴被抓出（隔板转 90 度才对）', () => {
    const v = broken(withBaffle, (r) => {
      const b = r.parts.find((p) => p.rule === 'baffle')!;
      delete b.ry; // 去掉旋转 → 428mm 长边落在 X 轴，成了沿缸长的鳍片
    });
    expect(v.some((m) => m.startsWith('C2b'))).toBe(true);
  });

  it('拉筋走向用世界外廓判定，不看 l/w/h 字面量', () => {
    const { g, r } = run(withBrace);
    const braces = r.parts.filter((p) => p.rule === 'brace');
    expect(braces).toHaveLength(4);
    const alongX = braces.filter((p) => Math.abs(worldExtent(p).ex - g.innerL) < 1e-6);
    const alongZ = braces.filter((p) => Math.abs(worldExtent(p).ez - g.innerW) < 1e-6);
    expect(alongX).toHaveLength(2);
    expect(alongZ).toHaveLength(2);
  });
});

describe('C3/C4 外观间距等于标称', () => {
  it('前后板外表面间距 = W', () => {
    const { g, r } = run(plain);
    const fronts = r.parts.filter((p) => p.rule === 'frontBack');
    const span = Math.max(...fronts.map((p) => {
      const b = aabb(p);
      return Math.max(Math.abs(b.z0), Math.abs(b.z1));
    })) * 2;
    expect(span).toBeCloseTo(g.W, 6);
  });

  it('左右板外表面间距 = L', () => {
    const { g, r } = run(plain);
    const sides = r.parts.filter((p) => p.rule === 'leftRight');
    const span = Math.max(...sides.map((p) => {
      const b = aabb(p);
      return Math.max(Math.abs(b.x0), Math.abs(b.x1));
    })) * 2;
    expect(span).toBeCloseTo(g.L, 6);
  });

  it('前后板被内推时被抓出', () => {
    const v = broken(plain, (r) => {
      for (const p of r.parts.filter((x) => x.rule === 'frontBack')) p.z = 100;
    });
    expect(v.some((m) => m.startsWith('C3'))).toBe(true);
  });

  it('左右板被内推时被抓出', () => {
    const v = broken(plain, (r) => {
      for (const p of r.parts.filter((x) => x.rule === 'leftRight')) p.x = 100;
    });
    expect(v.some((m) => m.startsWith('C4'))).toBe(true);
  });
});

describe('C5 底板对齐', () => {
  it('底板上表面 = bottomT', () => {
    const { g, r } = run(plain);
    const floor = r.parts.find((p) => p.rule === 'floor')!;
    expect(aabb(floor).y1).toBeCloseTo(g.bottomT, 6);
  });

  it('底板被抬高时被抓出', () => {
    const v = broken(plain, (r) => { r.parts.find((p) => p.rule === 'floor')!.y += 50; });
    expect(v.some((m) => m.startsWith('C5'))).toBe(true);
  });
});

describe('C6 板件不得侵入壁厚带', () => {
  it('拉筋嵌进侧壁时被抓出', () => {
    const v = broken(withBrace, (r) => {
      const brace = r.parts.find((p) => p.rule === 'brace')!;
      brace.x = 445; // 壁厚带 440–450
    });
    expect(v.some((m) => m.startsWith('C6'))).toBe(true);
  });

  it('合格构型的板件全部在内腔以内', () => {
    const { g, r } = run(withBrace);
    const limit = g.L / 2 - g.sideT;
    // 四壁本身构成壁厚带，只有腔内构件需要满足
    const inside = r.parts.filter((p) => p.rule !== 'frontBack' && p.rule !== 'leftRight');
    expect(inside.length).toBeGreaterThan(0);
    for (const p of inside) {
      expect(Math.abs(aabb(p).x0)).toBeLessThanOrEqual(limit + 1);
      expect(Math.abs(aabb(p).x1)).toBeLessThanOrEqual(limit + 1);
    }
  });
});

describe('C7 容积一致性', () => {
  it('volumeL 与内腔尺寸自洽', () => {
    const { g, r } = run(plain);
    expect(r.volumeL).toBeCloseTo((g.innerL * g.innerW * g.innerH) / 1e6, 6);
  });

  it('容积被篡改时被抓出', () => {
    const v = broken(plain, (r) => { r.volumeL *= 1.2; });
    expect(v.some((m) => m.startsWith('C7'))).toBe(true);
  });
});

describe('C8 隔板均匀', () => {
  it('三块隔板等距', () => {
    const { r } = run({ ...plain, baffleCount: 4 });
    const xs = r.parts.filter((p) => p.rule === 'baffle').map((p) => p.x).sort((a, b) => a - b);
    expect(xs).toHaveLength(3);
    const gaps = xs.slice(1).map((x, i) => x - xs[i]);
    for (const gp of gaps) expect(gp).toBeCloseTo(gaps[0], 6);
  });

  it('隔板被挪动时被抓出', () => {
    const v = broken({ ...plain, baffleCount: 4 }, (r) => {
      const bs = r.parts.filter((p) => p.rule === 'baffle').sort((a, b) => a.x - b.x);
      bs[1].x += 30;
    });
    expect(v.some((m) => m.startsWith('C8'))).toBe(true);
  });
});

describe('C9/C10 分支行为', () => {
  it('溢流宽度不足时不生成溢流板', () => {
    const { g, r } = run({ ...plain, overflowW: 69 });
    expect(g.hasOverflow).toBe(false);
    expect(r.parts.some((p) => p.rule === 'overflow')).toBe(false);
  });

  it('切口过浅时不生成拉筋', () => {
    const { g, r } = run({ ...plain, baffleCut: 10, sideT: 10, braceW: 19 });
    expect(g.hasBrace).toBe(false);
    expect(r.parts.some((p) => p.rule === 'brace')).toBe(false);
  });

  it('阈值未达标却出现溢流板时被抓出', () => {
    const v = broken({ ...plain, overflowW: 69 }, (r) => {
      r.parts.push({
        rule: 'overflow', label: '溢流板',
        l: 100, w: 100, h: 6, x: 0, y: 100, z: -100, material: 'float',
      });
    });
    expect(v.some((m) => m.startsWith('C9'))).toBe(true);
  });

  it('切口过浅却出现拉筋时被抓出', () => {
    const v = broken({ ...plain, baffleCut: 10, sideT: 10, braceW: 0 }, (r) => {
      r.parts.push({
        rule: 'brace', label: '拉筋',
        l: 100, w: 19, h: 10, x: 0, y: 400, z: 0, rx: 2, material: 'float',
      });
    });
    expect(v.some((m) => m.startsWith('C10'))).toBe(true);
  });
});

describe('整链契约：baffleCount = 0 必须被夹紧而不是除零', () => {
  it('clampParams → derive → solve 全程有限', () => {
    const clamped = clampParams({ ...plain, baffleCount: 0 });
    expect(clamped.ok).toBe(true);
    if (!clamped.ok) return;

    expect(clamped.value.baffleCount).toBe(1);

    const g = derive(clamped.value);
    expect(Number.isFinite(g.baffleSpan)).toBe(true);
    expect(Number.isFinite(g.volumeL)).toBe(true);

    const r = solve(jarSpec, clamped.value);
    expect(checkConformance(r, g)).toEqual([]);
  });

  it('未经夹紧直接 derive 会分出 Infinity —— 说明夹紧是承重的', () => {
    const g = derive({ ...plain, baffleCount: 0 });
    expect(Number.isFinite(g.baffleSpan)).toBe(false);
  });
});

describe('C6b 溢流仓与横跨腔深的板件互不穿插（规格 §2 usable*）', () => {
  const mixed: TankParams = { ...plain, braceW: 0, baffleCount: 3, overflowW: 80, sandW: 139, pumpW: 49 };

  it('隔板与溢流仓同时启用时不相交', () => {
    const { g, r } = run(mixed);
    expect(g.hasOverflow).toBe(true);

    const ov = aabb(r.parts.find((x) => x.rule === 'overflow')!);
    const spanning = r.parts.filter((x) => x.rule === 'baffle'
      || x.rule === 'sandDivider' || x.rule === 'pumpDivider');
    expect(spanning.length).toBeGreaterThan(0);

    for (const p of spanning) {
      const b = aabb(p);
      const overlapZ = Math.min(b.z1, ov.z1) - Math.max(b.z0, ov.z0);
      expect(overlapZ).toBeLessThanOrEqual(0.01);
    }

    expect(checkConformance(r, g)).toEqual([]);
  });

  it('隔板只占可用腔深，不占满 innerW', () => {
    const { g, r } = run(mixed);
    const b = r.parts.find((x) => x.rule === 'baffle')!;
    expect(worldExtent(b).ez).toBeCloseTo(g.usableW, 6);
    expect(g.usableW).toBeLessThan(g.innerW);
    expect(b.z).toBeCloseTo(g.usableZ, 6);
  });

  it('无溢流仓时 usable* 退化为完整内腔', () => {
    const g = derive({ ...plain, overflowW: 0 });
    expect(g.floodW).toBe(0);
    expect(g.usableW).toBeCloseTo(g.innerW, 6);
    expect(g.usableZ).toBeCloseTo(0, 6);
  });

  it('隔板被撑满 innerW 时 C6b 会响', () => {
    const v = broken(mixed, (r) => {
      for (const p of r.parts.filter((x) => x.rule === 'baffle')) p.l = 428;
    });
    expect(v.some((m) => m.startsWith('C6b'))).toBe(true);
  });
});
