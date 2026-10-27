import { describe, it, expect } from 'vitest';
import { floorRule, frontBackRule, leftRightRule } from '../../src/rules/base';
import { solve } from '../../src/solver/solve';
import { derive } from '../../src/model/derive';
import type { TankParams, TankKind } from '../../src/model/types';

const base: TankParams = {
  L: 400, W: 400, H: 400,
  sideT: 8, bottomT: 8, baffleT: 6, gap: 1,
  baffleCount: 1, baffleCut: 20,
  overflowW: 69, sandW: 139, pumpW: 49, braceW: 19,
  material: 3,
};

describe('底板规则', () => {
  it('尺寸 = 外观跨度减胶缝', () => {
    const g = derive(base);
    const [floor] = floorRule.parts(g);
    expect(floor.l).toBe(g.outerL - 2 * g.gap);
    expect(floor.w).toBe(g.outerW - 2 * g.gap);
    expect(floor.h).toBe(8);
  });

  it('绕 X 轴转 90 度，厚度沿 Y', () => {
    const [floor] = floorRule.parts(derive(base));
    expect(floor.rx).toBe(2);
  });

  it('中心高度 = 底板厚的一半', () => {
    const [floor] = floorRule.parts(derive(base));
    expect(floor.y).toBe(4);
  });
});

describe('前后板规则', () => {
  it('两块，横跨全长', () => {
    const parts = frontBackRule.parts(derive(base));
    expect(parts).toHaveLength(2);
    for (const p of parts) {
      expect(p.l).toBe(400);
      expect(p.w).toBe(400);
      expect(p.h).toBe(8);
    }
  });

  it('外表面间距等于标称宽度', () => {
    const g = derive(base);
    const parts = frontBackRule.parts(g);
    const zs = parts.map((p) => Math.abs(p.z) + p.h / 2);
    expect(Math.max(...zs) * 2).toBeCloseTo(g.W, 5);
  });
});

describe('左右板规则', () => {
  it('两块，长度取内跨减胶缝', () => {
    const g = derive(base);
    const parts = leftRightRule.parts(g);
    expect(parts).toHaveLength(2);
    expect(parts[0].l).toBe(g.outerW - 2 * g.gap);
  });

  it('绕 Y 轴转 90 度', () => {
    expect(leftRightRule.parts(derive(base))[0].ry).toBe(2);
  });
});

describe('求解器', () => {
  const spec = {
    kind: 'jar' as TankKind,
    label: '标准鱼缸',
    rules: [floorRule, frontBackRule, leftRightRule],
  };

  it('汇总所有规则的板件', () => {
    const r = solve(spec, base);
    expect(r.parts).toHaveLength(5);
  });

  it('带出缸型与容积', () => {
    const r = solve(spec, base);
    expect(r.kind).toBe('jar');
    expect(r.volumeL).toBeGreaterThan(0);
  });

  it('每条规则产出的板件都带来源名', () => {
    const r = solve(spec, base);
    expect(r.parts.every((p) => typeof p.rule === 'string' && p.rule.length > 0)).toBe(true);
  });
});

describe('材质分区（规格 §6）', () => {
  it('全超白时五块全为超白', () => {
    const r = solve({ kind: 'jar', label: 't', rules: [floorRule, frontBackRule, leftRightRule] }, base);
    expect(r.parts.every((p) => p.material === 'ultra')).toBe(true);
  });

  it('底背超白：底板与后板超白，前板与左右板浮法', () => {
    const r = solve(
      { kind: 'jar', label: 't', rules: [floorRule, frontBackRule, leftRightRule] },
      { ...base, material: 1 },
    );
    expect(r.parts.find((p) => p.rule === 'floor')!.material).toBe('ultra');
    expect(r.parts.filter((p) => p.rule === 'frontBack').map((p) => p.material).sort())
      .toEqual(['float', 'ultra']);
    expect(r.parts.filter((p) => p.rule === 'leftRight').every((p) => p.material === 'float')).toBe(true);
  });

  it('正面超白：只有正 z 那块前板是超白', () => {
    const r = solve(
      { kind: 'jar', label: 't', rules: [frontBackRule] },
      { ...base, material: 2 },
    );
    const front = r.parts.find((p) => p.z > 0)!;
    const back = r.parts.find((p) => p.z < 0)!;
    expect(front.material).toBe('ultra');
    expect(back.material).toBe('float');
  });

  it('全浮法时五块全为浮法', () => {
    const r = solve(
      { kind: 'jar', label: 't', rules: [floorRule, frontBackRule, leftRightRule] },
      { ...base, material: 0 },
    );
    expect(r.parts.every((p) => p.material === 'float')).toBe(true);
  });
});
