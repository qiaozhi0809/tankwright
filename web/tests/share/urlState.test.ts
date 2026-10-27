import { describe, it, expect } from 'vitest';
import { encodeState, decodeState, shareUrl, readStateFromSearch } from '../../src/share/urlState';
import { TANK_KINDS } from '../../src/rules';
import type { TankParams } from '../../src/model/types';

const p: TankParams = {
  L: 500, W: 300, H: 400, sideT: 8, bottomT: 10, baffleT: 6, gap: 1,
  baffleCount: 3, baffleCut: 40, overflowW: 69, sandW: 139, pumpW: 49,
  braceW: 19, material: 0,
};

describe('URL 状态', () => {
  it('往返一致', () => {
    const back = decodeState(encodeState(p, 'jar'));
    expect(back?.p).toEqual(p);
    expect(back?.kind).toBe('jar');
  });

  it('编码可安全入 URL', () => {
    expect(encodeState(p, 'filter')).toMatch(/^[A-Za-z0-9._~-]+$/);
  });

  it('坏数据返回 null', () => {
    expect(decodeState('')).toBeNull();
    expect(decodeState('garbage!!')).toBeNull();
  });

  it('八种缸型都能往返', () => {
    for (const kind of TANK_KINDS) {
      expect(decodeState(encodeState(p, kind))?.kind).toBe(kind);
    }
  });

  it('十进制参数不被截断', () => {
    const q: TankParams = { ...p, sideT: 7.5, baffleCut: 12.5 };
    const back = decodeState(encodeState(q, 'whole'));
    expect(back?.p.sideT).toBe(7.5);
    expect(back?.p.baffleCut).toBe(12.5);
  });

  it('四种玻璃等级都能还原', () => {
    for (const m of [0, 1, 2, 3] as const) {
      expect(decodeState(encodeState({ ...p, material: m }, 'jar'))?.p.material).toBe(m);
    }
  });

  it('未知缸型返回 null 而不是猜一个', () => {
    const s = encodeState(p, 'jar');
    expect(decodeState(`nope${s.slice(s.indexOf('.'))}`)).toBeNull();
  });

  it('缺少分隔符返回 null', () => {
    expect(decodeState('jar')).toBeNull();
    expect(decodeState('.abc')).toBeNull();
  });

  it('截断的载荷返回 null（字段数不符）', () => {
    const s = encodeState(p, 'jar');
    expect(decodeState(s.slice(0, s.length - 6))).toBeNull();
  });
});

describe('分享链接', () => {
  it('shareUrl 带上 s 参数', () => {
    const url = shareUrl(p, 'jar', 'https://example.test/app');
    expect(url.startsWith('https://example.test/app?s=')).toBe(true);
    expect(decodeState(url.split('?s=')[1])?.p).toEqual(p);
  });

  it('从 search 里读回', () => {
    const url = shareUrl(p, 'sys', '');
    const search = url.slice(url.indexOf('?'));
    const back = readStateFromSearch(search);
    expect(back?.kind).toBe('sys');
    expect(back?.p).toEqual(p);
  });

  it('没有 s 参数时返回 null', () => {
    expect(readStateFromSearch('?x=1&y=2')).toBeNull();
    expect(readStateFromSearch('')).toBeNull();
  });
});

/**
 * `?s=` 是全站唯一从页面外进来的参数通道。`decodeState` 只保证"是有限数字"，
 * 不保证"这个缸立得住"—— 所以 `readStateFromSearch` 必须补上表单那道夹紧，
 * 否则一条手改的链接就能把 Infinity / 负几何直接送进 derive 和场景。
 */
describe('分享链接不能绕过夹紧', () => {
  it('隔板数 0 的链接被夹到 1，而不是让 derive 除零', () => {
    const bad = { ...p, baffleCount: 0 };
    const got = readStateFromSearch(`?s=${encodeState(bad, 'jar')}`);
    expect(got?.p.baffleCount).toBe(1);
  });

  it('负数边长被拒，调用方拿到 null 回退默认参数', () => {
    const bad = { ...p, L: -1 };
    expect(readStateFromSearch(`?s=${encodeState(bad, 'jar')}`)).toBeNull();
  });

  it('玻璃厚吃掉内腔时被拒', () => {
    const bad = { ...p, H: 10, bottomT: 6, sideT: 8 };
    expect(readStateFromSearch(`?s=${encodeState(bad, 'jar')}`)).toBeNull();
  });

  it('隔板数超上限时被夹到 ⌊L/125⌋', () => {
    const bad = { ...p, L: 500, baffleCount: 99 };
    expect(readStateFromSearch(`?s=${encodeState(bad, 'jar')}`)?.p.baffleCount).toBe(4);
  });

  it('沙缸与泵仓同时加宽时被解冲突', () => {
    const bad = { ...p, sandW: 150, pumpW: 90 };
    expect(readStateFromSearch(`?s=${encodeState(bad, 'jar')}`)?.p.pumpW).toBe(49);
  });

  it('合法链接原样通过', () => {
    expect(readStateFromSearch(`?s=${encodeState(p, 'jar')}`)?.p).toEqual(p);
  });
});

describe('解码的空字段', () => {
  it('空槽不会被当成 0', () => {
    // String('') === ''，编码后该槽为空；解码时 Number('') 得 0 且有限，
    // 只查有限性会放行 —— 必须显式挡住空串。
    const broken = { ...p, baffleCount: '' as unknown as number };
    expect(decodeState(encodeState(broken, 'jar'))).toBeNull();
  });
});
