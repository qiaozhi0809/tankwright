import { describe, it, expect, afterEach } from 'vitest';
import { act } from 'react';
import { mountPanel, unmountPanel } from '../../src/ui/mount';
import type { TankKind, TankParams } from '../../src/model/types';

const params: TankParams = {
  L: 900, W: 450, H: 450, sideT: 10, bottomT: 10, baffleT: 6, gap: 1,
  baffleCount: 2, baffleCut: 40, overflowW: 0, sandW: 0, pumpW: 0,
  braceW: 19, material: 1,
};

afterEach(() => {
  act(() => unmountPanel());
  document.body.innerHTML = '';
});

function host() {
  const el = document.createElement('div');
  el.id = 'eng-panel';
  document.body.appendChild(el);
  return el;
}

// React 19 的 createRoot().render() 是并发的：不套 act 的话断言会在提交前跑，
// 看到的是空 DOM。
function mount(opts: Parameters<typeof mountPanel>[0]) {
  act(() => mountPanel(opts));
}

describe('面板挂载', () => {
  it('挂到 #eng-panel 上', () => {
    host();
    mount({ onRebuild: () => {}, initial: params, initialKind: 'jar' });
    expect(document.querySelectorAll('.eng-panel-inner')).toHaveLength(1);
  });

  it('重复挂载不会产生两个根', () => {
    host();
    mount({ onRebuild: () => {}, initial: params, initialKind: 'jar' });
    mount({ onRebuild: () => {}, initial: params, initialKind: 'jar' });
    expect(document.querySelectorAll('.eng-panel-inner')).toHaveLength(1);
  });

  it('首次渲染即回调一次，带上参数与缸型', () => {
    host();
    const seen: { p: TankParams; k: TankKind }[] = [];
    mount({
      onRebuild: (p, k) => seen.push({ p, k }),
      initial: params,
      initialKind: 'jar',
    });
    expect(seen.length).toBe(1);
    expect(seen[0].k).toBe('jar');
    expect(seen[0].p.L).toBe(900);
  });

  it('宿主节点不存在时静默返回', () => {
    expect(() => act(() => mountPanel({ onRebuild: () => {} }))).not.toThrow();
    expect(document.querySelectorAll('.eng-panel-inner')).toHaveLength(0);
  });
});
