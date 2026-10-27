import { describe, it, expect } from 'vitest';
import { solve } from '../../src/solver/solve';
import { SPECS } from '../../src/rules';
import { forRender, BASE_DRAWS } from '../../src/render/overlap';
import { buildBOM, buildExternBOM } from '../../src/quote/bom';
import type { TankParams } from '../../src/model/types';

const base: TankParams = {
  L: 900, W: 450, H: 450, sideT: 10, bottomT: 10, baffleT: 6, gap: 1,
  baffleCount: 2, baffleCut: 40, overflowW: 0, sandW: 0, pumpW: 0,
  braceW: 19, material: 1,
};

describe('场景去重：底座已画的构件不再重复挂载', () => {
  it('whole 缸在场景里没有柜体和灯架', () => {
    const result = solve(SPECS.whole, base);
    const rendered = forRender(result);
    const dup = rendered.parts.filter((p) => BASE_DRAWS.has(p.rule));
    expect(dup).toHaveLength(0);
  });

  it('whole 缸的清单里仍然有柜体和灯架', () => {
    const result = solve(SPECS.whole, base);
    const extern = buildExternBOM(result.parts);
    const rules = extern.map((r) => r.rule);
    expect(rules).toContain('cabinet');
    expect(rules).toContain('canopy');
  });

  it('过滤不改变玻璃下料', () => {
    const result = solve(SPECS.whole, base);
    const before = buildBOM(result.parts);
    const after = buildBOM(forRender(result).parts);
    expect(after).toEqual(before);
  });

  it('jar 缸没有可剔除的构件，原对象直接返回', () => {
    const result = solve(SPECS.jar, base);
    expect(forRender(result)).toBe(result);
  });

  it('铝架缸的 rack 构件仍会进场景（底座没有铝架）', () => {
    const result = solve(SPECS.rack, base);
    const rendered = forRender(result);
    expect(rendered.parts.filter((p) => p.rule === 'rack').length).toBe(
      result.parts.filter((p) => p.rule === 'rack').length,
    );
    expect(rendered.parts.some((p) => p.rule === 'rack')).toBe(true);
  });

  it('剔除只针对 extern：缸内板件一件不少', () => {
    const result = solve(SPECS.whole, base);
    const rendered = forRender(result);
    const tankPartsBefore = result.parts.filter((p) => (p.envelope ?? 'tank') === 'tank');
    const tankPartsAfter = rendered.parts.filter((p) => (p.envelope ?? 'tank') === 'tank');
    expect(tankPartsAfter).toHaveLength(tankPartsBefore.length);
  });
});
