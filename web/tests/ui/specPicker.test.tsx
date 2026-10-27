import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SpecPicker } from '../../src/ui/SpecPicker';
import { TANK_KINDS, SPECS } from '../../src/rules';
import type { TankKind } from '../../src/model/types';

afterEach(cleanup);

describe('缸型选择器', () => {
  it('渲染全部八种', () => {
    render(<SpecPicker value="jar" onChange={() => {}} />);
    for (const k of TANK_KINDS) {
      expect(screen.getByRole('button', { name: SPECS[k].label })).toBeTruthy();
    }
    expect(TANK_KINDS).toHaveLength(8);
  });

  it('点击触发回调并带上缸型', () => {
    const box: { v: TankKind | null } = { v: null };
    render(<SpecPicker value="jar" onChange={(k) => (box.v = k)} />);
    fireEvent.click(screen.getByRole('button', { name: SPECS.filter.label }));
    expect(box.v).toBe('filter');
  });

  it('当前缸型带 aria-pressed', () => {
    render(<SpecPicker value="seafood" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: SPECS.seafood.label }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: SPECS.jar.label }).getAttribute('aria-pressed')).toBe('false');
  });
});
