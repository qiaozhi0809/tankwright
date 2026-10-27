import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ParamForm } from '../../src/ui/ParamForm';
import type { TankParams } from '../../src/model/types';

// testing-library 不会自动卸载上一次 render 的树；不 cleanup 的话
// 第二个用例会看到两个 form、两个 role="alert"，回调也会抓到陈旧实例。
afterEach(cleanup);

const initial: TankParams = {
  L: 500, W: 300, H: 400, sideT: 8, bottomT: 10, baffleT: 6, gap: 1,
  baffleCount: 3, baffleCut: 40, overflowW: 69, sandW: 139, pumpW: 49,
  braceW: 19, material: 0,
};

describe('参数面板', () => {
  it('渲染关键字段', () => {
    render(<ParamForm value={initial} onChange={() => {}} />);
    expect(screen.getByLabelText('长度')).toBeTruthy();
    expect(screen.getByLabelText('高度')).toBeTruthy();
    expect(screen.getByLabelText('玻璃等级')).toBeTruthy();
  });

  it('改长度触发回调', () => {
    let got: TankParams | null = null;
    render(<ParamForm value={initial} onChange={(v) => (got = v)} />);
    fireEvent.change(screen.getByLabelText('长度'), { target: { value: '600' } });
    expect(got!.L).toBe(600);
  });

  it('非法值不通过', () => {
    // 用容器而不是裸变量：TS 的控制流分析看不到闭包内的赋值，
    // 会把 `got === null ||` 之后的 got 收窄成 never。
    const box: { v: TankParams | null } = { v: null };
    render(<ParamForm value={initial} onChange={(v) => (box.v = v)} />);
    fireEvent.change(screen.getByLabelText('高度'), { target: { value: '0' } });
    expect(box.v).toBeNull();
  });

  it('显示拒绝原因', () => {
    render(<ParamForm value={initial} onChange={() => {}} />);
    fireEvent.change(screen.getByLabelText('高度'), { target: { value: '0' } });
    expect(screen.getByRole('alert').textContent).toContain('大于 0');
  });

  it('合法输入清空上一次的拒绝原因', () => {
    render(<ParamForm value={initial} onChange={() => {}} />);
    fireEvent.change(screen.getByLabelText('高度'), { target: { value: '0' } });
    expect(screen.getByRole('alert').textContent).not.toBe('');
    fireEvent.change(screen.getByLabelText('高度'), { target: { value: '450' } });
    expect(screen.getByRole('alert').textContent).toBe('');
  });

  it('夹紧后的值才上抛：隔板数超限被压到上限', () => {
    let got: TankParams | null = null;
    render(<ParamForm value={initial} onChange={(v) => (got = v)} />);
    fireEvent.change(screen.getByLabelText('隔板数量'), { target: { value: '99' } });
    // L=500 → max = floor(500/125) = 4
    expect(got!.baffleCount).toBe(4);
  });

  it('材质下拉改到全超白', () => {
    let got: TankParams | null = null;
    render(<ParamForm value={initial} onChange={(v) => (got = v)} />);
    fireEvent.change(screen.getByLabelText('玻璃等级'), { target: { value: '3' } });
    expect(got!.material).toBe(3);
  });
});
