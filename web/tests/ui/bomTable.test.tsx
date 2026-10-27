import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { BomTable } from '../../src/ui/BomTable';
import { DEFAULT_PRICES } from '../../src/quote/config';
import { solve } from '../../src/solver/solve';
import { SPECS } from '../../src/rules';
import type { TankParams } from '../../src/model/types';

afterEach(cleanup);

const base: TankParams = {
  L: 900, W: 450, H: 450, sideT: 10, bottomT: 10, baffleT: 6, gap: 1,
  baffleCount: 2, baffleCut: 40, overflowW: 0, sandW: 0, pumpW: 0,
  braceW: 19, material: 1,
};

describe('下料清单表面板', () => {
  it('玻璃与缸外结构分成两张表', () => {
    const parts = solve(SPECS.whole, base).parts;
    render(<BomTable parts={parts} prices={DEFAULT_PRICES} />);
    expect(screen.getByRole('heading', { name: '玻璃下料' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '缸外结构（不计玻璃面积）' })).toBeTruthy();
  });

  it('柜体出现在缸外结构表里，不出现在玻璃表里', () => {
    const parts = solve(SPECS.whole, base).parts;
    render(<BomTable parts={parts} prices={DEFAULT_PRICES} />);
    // cabinetRule 的部件名是「柜顶板 / 柜底板 / 柜前后板 / 柜侧板」
    expect(screen.getAllByText('柜顶板').length).toBeGreaterThan(0);
    const tables = document.querySelectorAll('table');
    expect(tables.length).toBe(2);
    const glassTableText = tables[0].textContent ?? '';
    expect(glassTableText).not.toContain('柜');
  });

  it('jar 缸没有 extern 表', () => {
    const parts = solve(SPECS.jar, base).parts;
    render(<BomTable parts={parts} prices={DEFAULT_PRICES} />);
    expect(screen.queryByRole('heading', { name: '缸外结构（不计玻璃面积）' })).toBeNull();
  });

  it('列表里出现超白与浮法两种材质', () => {
    const parts = solve(SPECS.jar, base).parts;
    render(<BomTable parts={parts} prices={DEFAULT_PRICES} />);
    const body = document.body.textContent ?? '';
    expect(body).toContain('超白');
    expect(body).toContain('浮法');
  });

  it('报价合计等于分项之和', () => {
    const parts = solve(SPECS.jar, base).parts;
    render(<BomTable parts={parts} prices={DEFAULT_PRICES} />);
    const dds = Array.from(document.querySelectorAll('.eng-quote dd')).map((n) => n.textContent ?? '');
    const nums = dds.map((t) => Number(t.replace(/[¥,]/g, '')));
    expect(nums).toHaveLength(4);
    expect(nums[3]).toBeCloseTo(nums[0] + nums[1] + nums[2], 2);
  });
});
