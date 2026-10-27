import { describe, it, expect } from 'vitest';
import { braceRule } from '../../src/rules/brace';
import { overflowRule } from '../../src/rules/overflow';
import { baffleRule } from '../../src/rules/baffle';
import { sandDividerRule, pumpDividerRule } from '../../src/rules/divider';
import { floorRule, frontBackRule, leftRightRule } from '../../src/rules/base';
import { solve } from '../../src/solver/solve';
import { derive } from '../../src/model/derive';
import { worldExtent } from '../../src/solver/assertions';
import type { TankParams, TankKind } from '../../src/model/types';

const base: TankParams = {
  L: 900, W: 450, H: 450,
  sideT: 10, bottomT: 10, baffleT: 6, gap: 1,
  baffleCount: 2, baffleCut: 40,
  overflowW: 80, sandW: 139, pumpW: 49, braceW: 19,
  material: 1,
};

describe('拉筋', () => {
  it('切口足够时生成 4 根', () => {
    expect(braceRule.parts(derive(base))).toHaveLength(4);
  });

  it('切口不足时一根都不生成', () => {
    const g = derive({ ...base, baffleCut: 10, sideT: 10 });
    expect(braceRule.parts(g)).toHaveLength(0);
  });

  it('拉筋位于缸口下缘', () => {
    const g = derive(base);
    for (const b of braceRule.parts(g)) {
      expect(b.y).toBeLessThan(g.H);
      expect(b.y).toBeGreaterThan(g.H - 10 - 40);
    }
  });

  it('左右两根在正负 x，前后两根在正负 z', () => {
    const parts = braceRule.parts(derive(base));
    const xs = parts.map((p) => p.x).filter((v) => v !== 0);
    const zs = parts.map((p) => p.z).filter((v) => v !== 0);
    expect(xs).toHaveLength(2);
    expect(zs).toHaveLength(2);
    expect(xs[0]).toBeCloseTo(-xs[1], 6);
    expect(zs[0]).toBeCloseTo(-zs[1], 6);
    // 精确落位，不只验对称：外缘贴内腔壁面。漏掉 -gap 或把基准写成 innerL/2
    // 都会让拉筋挪 1mm 进玻璃，对称性照样成立，所以必须钉死数值。
    // base: innerL = 878, innerW = 428, braceW = 19
    const g = derive(base);
    expect(Math.abs(xs[0])).toBeCloseTo((g.innerL - g.braceW) / 2, 6);
    expect(Math.abs(zs[0])).toBeCloseTo((g.innerW - g.braceW) / 2, 6);
  });

  it('竖直厚度取侧板厚，横向宽度取拉筋宽', () => {
    // 断言世界向物理量，不绑定 l/w/h 的具体摆放：左右拉筋用 ry、前后拉筋用 rx，
    // 两者都要求竖直方向是玻璃厚、水平截面宽度是拉筋宽。
    for (const b of braceRule.parts(derive(base))) {
      const e = worldExtent(b);
      expect(e.ey).toBe(base.sideT);
      expect(Math.min(e.ex, e.ez)).toBe(base.braceW);
    }
  });
});

describe('溢流板', () => {
  it('宽度达标时生成一块', () => {
    expect(overflowRule.parts(derive(base))).toHaveLength(1);
  });

  it('低于阈值时不生成', () => {
    expect(overflowRule.parts(derive({ ...base, overflowW: 69 }))).toHaveLength(0);
  });

  it('位于后侧', () => {
    const [o] = overflowRule.parts(derive(base));
    expect(o.z).toBeLessThan(0);
    // 精确基准，不只验符号：漏掉 +gap 或把基准换成 -W/2 都能通过符号检查。
    // base: -428/2 + 80 + 6/2 = -131
    const g = derive(base);
    expect(o.z).toBeCloseTo(-g.innerW / 2 + base.overflowW + base.baffleT / 2, 6);
    expect(o.z).toBeCloseTo(-131, 6);
  });

  it('以内腔后壁为基准距出 overflowW（不是标称外宽）', () => {
    const g = derive(base);
    const [o] = overflowRule.parts(g);
    expect(o.z).toBeCloseTo(-g.innerW / 2 + g.overflowW + g.baffleT / 2, 6);
    // 净溢流仓深 = 后壁到板后表面的距离，必须等于 overflowW；
    // 板厚另外占用 baffleT，两者合计才是 §2 的 floodW
    const clearBay = (o.z - o.h / 2) - (-g.innerW / 2);
    expect(clearBay).toBeCloseTo(g.overflowW, 6);
    expect(g.floodW).toBeCloseTo(g.overflowW + g.baffleT, 6);
  });

  it('上缘比内腔矮 10mm，给溢流留出通路', () => {
    const g = derive(base);
    const [o] = overflowRule.parts(g);
    expect(o.w).toBe(g.innerH - 10);
    expect(o.h).toBe(base.baffleT);
  });
});

describe('隔板', () => {
  it('数量 = 段数 - 1', () => {
    expect(baffleRule.parts(derive({ ...base, baffleCount: 4 }))).toHaveLength(3);
  });

  it('单段时不生成隔板', () => {
    expect(baffleRule.parts(derive({ ...base, baffleCount: 1 }))).toHaveLength(0);
  });

  it('沿长度均匀分布', () => {
    const g = derive({ ...base, baffleCount: 3 });
    const xs = baffleRule.parts(g).map((p) => p.x).sort((a, b) => a - b);
    expect(xs[1] - xs[0]).toBeCloseTo(xs[0] - (-g.innerL / 2), 5);
  });

  it('下缘抬高 = 切口高度', () => {
    const g = derive(base);
    const [b] = baffleRule.parts(g);
    expect(b.w).toBe(g.innerH - g.baffleCut);
  });

  it('跨越可用腔深并落在可用腔中心，不穿过溢流仓', () => {
    const g = derive(base);
    expect(g.hasOverflow).toBe(true);
    for (const b of baffleRule.parts(g)) {
      expect(worldExtent(b).ez).toBeCloseTo(g.usableW, 6);
      expect(b.z).toBeCloseTo(g.usableZ, 6);
    }
  });

  it('无溢流仓时用满内腔、居中', () => {
    const g = derive({ ...base, overflowW: 0 });
    for (const b of baffleRule.parts(g)) {
      expect(worldExtent(b).ez).toBeCloseTo(g.innerW, 6);
      expect(b.z).toBeCloseTo(0, 6);
    }
  });

  it('首块紧邻左端段界，末块不贴右壁', () => {
    const g = derive({ ...base, baffleCount: 4 });
    const xs = baffleRule.parts(g).map((p) => p.x).sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(-g.innerL / 2 + g.baffleSpan, 5);
    expect(xs[xs.length - 1]).toBeLessThan(g.innerL / 2);
  });
});

describe('沙缸与泵仓隔断', () => {
  it('沙缸隔断靠右侧', () => {
    const [d] = sandDividerRule.parts(derive(base));
    expect(d.x).toBeGreaterThan(0);
    // 精确到 mm，不只验符号：漏掉 -baffleT/2 会让隔断挪 3mm，符号检查照样通过。
    // base: L = 900, sandW = 139, baffleT = 6 → 450 - 139 - 3 = 308
    expect(d.x).toBeCloseTo(base.L / 2 - base.sandW - base.baffleT / 2, 6);
    expect(d.x).toBeCloseTo(308, 6);
  });

  it('泵仓隔断靠左侧', () => {
    const [d] = pumpDividerRule.parts(derive(base));
    expect(d.x).toBeLessThan(0);
    // base: -450 + 49 + 3 = -398
    expect(d.x).toBeCloseTo(-base.L / 2 + base.pumpW + base.baffleT / 2, 6);
    expect(d.x).toBeCloseTo(-398, 6);
  });

  it('宽度为 0 时不生成', () => {
    expect(sandDividerRule.parts(derive({ ...base, sandW: 0 }))).toHaveLength(0);
    expect(pumpDividerRule.parts(derive({ ...base, pumpW: 0 }))).toHaveLength(0);
  });

  it('隔断高度取满内腔高', () => {
    const g = derive(base);
    expect(sandDividerRule.parts(g)[0].w).toBe(g.innerH);
    expect(pumpDividerRule.parts(g)[0].w).toBe(g.innerH);
  });

  it('隔断跨越可用腔深并落在可用腔中心', () => {
    const g = derive(base);
    for (const rule of [sandDividerRule, pumpDividerRule]) {
      const [d] = rule.parts(g);
      expect(worldExtent(d).ez).toBeCloseTo(g.usableW, 6);
      expect(d.z).toBeCloseTo(g.usableZ, 6);
    }
  });

  it('无溢流仓时隔断用满内腔、居中', () => {
    const g = derive({ ...base, overflowW: 0 });
    for (const rule of [sandDividerRule, pumpDividerRule]) {
      const [d] = rule.parts(g);
      expect(worldExtent(d).ez).toBeCloseTo(g.innerW, 6);
      expect(d.z).toBeCloseTo(0, 6);
    }
  });
});

describe('尺寸标注', () => {
  it('标注文本为 长x宽x厚，无空格', () => {
    for (const rule of [floorRule, frontBackRule, leftRightRule]) {
      const g = derive(base);
      const parts = rule.parts(g);
      const dims = rule.dims!(g, parts);
      expect(dims).toHaveLength(parts.length);
      for (const d of dims) expect(d.text).toMatch(/^\d+(\.\d+)?x\d+(\.\d+)?x\d+(\.\d+)?$/);
    }
  });

  it('求解器汇总多条规则的标注', () => {
    const spec = { kind: 'jar' as TankKind, label: '标准鱼缸', rules: [floorRule, frontBackRule, leftRightRule] };
    const r = solve(spec, base);
    expect(r.dims).toHaveLength(5);
    expect(r.dims.filter((d) => d.text === '900x450x10')).toHaveLength(2);
    expect(r.dims.some((d) => d.text === '878x428x10')).toBe(true);
    expect(r.dims.some((d) => d.text === '428x450x10')).toBe(true);
  });

  it('扩展规则的标注也进入求解结果', () => {
    const spec = { kind: 'filter' as TankKind, label: '底滤', rules: [baffleRule, overflowRule] };
    const r = solve(spec, base);
    expect(r.parts.length).toBeGreaterThan(0);
    expect(r.dims.length).toBe(r.parts.length);
  });
});
