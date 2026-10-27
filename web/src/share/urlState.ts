import type { TankKind, TankParams } from '../model/types';
import { TANK_KINDS } from '../model/types';
import { clampParams } from '../model/validate';

/**
 * 线上格式的字段顺序。这是**协议的一部分**：改动顺序会让旧分享链接解错，
 * 新字段只能追加在末尾（并同步提高 `STATE_VERSION`）。
 */
export const STATE_FIELDS = [
  'L', 'W', 'H',
  'sideT', 'bottomT', 'baffleT', 'gap',
  'baffleCount', 'baffleCut',
  'overflowW', 'sandW', 'pumpW', 'braceW',
  'material',
] as const;

/** base64url 字母表：`-` `_` 是 URL 安全区，且不含 `.`，可拿来当分隔符 */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/**
 * 自己实现 base64url，不依赖 `btoa`/`Buffer`。
 *
 * 两个原因：`btoa` 在非浏览器环境并非处处可用；而一旦环境不同（换行、填充、宽字符），
 * 分享链接就会在一台机器上能开、另一台上打不开。这里只有 ASCII 数字与逗号，行为完全确定。
 */
function b64urlEncode(s: string): string {
  let out = '';
  let i = 0;
  for (; i + 2 < s.length; i += 3) {
    const n = (s.charCodeAt(i) << 16) | (s.charCodeAt(i + 1) << 8) | s.charCodeAt(i + 2);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
  }
  const rest = s.length - i;
  if (rest === 1) {
    const n = s.charCodeAt(i) << 16;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
  } else if (rest === 2) {
    const n = (s.charCodeAt(i) << 16) | (s.charCodeAt(i + 1) << 8);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63];
  }
  return out;
}

/** 遇到字母表外的字符返回 `null`，由调用方决定这是"坏链接"而不是异常 */
function b64urlDecode(s: string): string | null {
  let out = '';
  let acc = 0;
  let bits = 0;
  for (const ch of s) {
    const v = B64.indexOf(ch);
    if (v < 0) return null;
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((acc >> bits) & 0xff);
      acc &= (1 << bits) - 1;
    }
  }
  return out;
}

function toMaterial(n: number): TankParams['material'] {
  return n === 1 || n === 2 || n === 3 ? n : 0;
}

/**
 * 把参数与缸型压成一个能塞进 URL 的短串：`<kind>.<base64url(逗号分隔的数值)>`。
 *
 * 不用 JSON：14 个字段的 JSON 展开后长度翻几倍，分享链接会难看到无法粘贴。
 */
export function encodeState(p: TankParams, kind: TankKind): string {
  const raw = STATE_FIELDS.map((k) => String(p[k])).join(',');
  return `${kind}.${b64urlEncode(raw)}`;
}

/**
 * 解析分享串。任何一处不对（缺分隔符、未知缸型、字段数不符、非数字）都返回 `null`，
 * 让调用方退回默认参数 —— 一条坏链接不该让整个页面抛异常。
 */
export function decodeState(s: string): { p: TankParams; kind: TankKind } | null {
  if (typeof s !== 'string' || s.length === 0) return null;

  const dot = s.indexOf('.');
  if (dot <= 0 || dot === s.length - 1) return null;

  const kind = s.slice(0, dot) as TankKind;
  if (!(TANK_KINDS as readonly string[]).includes(kind)) return null;

  const raw = b64urlDecode(s.slice(dot + 1));
  if (raw === null) return null;

  const fields = raw.split(',');
  if (fields.length !== STATE_FIELDS.length) return null;

  // `Number('') === 0` 且是有限数 —— 只查有限性会放过空字段，一个空槽会被静默
  // 当成 0 塞进参数。字段数校验挡得住截断，挡不住空缺。
  if (fields.some((f) => f.trim() === '')) return null;

  const nums = fields.map(Number);
  if (!nums.every((n) => Number.isFinite(n))) return null;

  // 用 STATE_FIELDS 驱动而不是手写索引：字段顺序改了这里自动跟上，
  // 不会出现"顺序变了但解析还按旧下标"的静默错位。
  const p = Object.fromEntries(
    STATE_FIELDS.map((key, i) => [key, nums[i]]),
  ) as unknown as TankParams;
  p.material = toMaterial(nums[STATE_FIELDS.indexOf('material')]);

  return { p, kind };
}

/** 当前页面的完整分享链接 */
export function shareUrl(p: TankParams, kind: TankKind, base?: string): string {
  const origin =
    base ?? (typeof location !== 'undefined' ? `${location.origin}${location.pathname}` : '');
  return `${origin}?s=${encodeState(p, kind)}`;
}

/**
 * 从 `location.search` 里取出 `?s=` 并解析；没有或解析失败都返回 `null`。
 *
 * **这里是全站唯一从页面外进来的参数通道，因此必须和表单走同一道夹紧。**
 * `decodeState` 只保证"是个有限数字"，不保证"这个缸立得住"：`baffleCount=0`
 * 会让 `derive` 除零得到 `Infinity`（`solve` 不夹紧，契约是调用方先夹），
 * `L=-1` 会产出负几何。夹不住就返回 `null`，由调用方退回默认参数 ——
 * 一条坏链接既不该让页面崩，也不该把 Infinity 画到屏幕上。
 */
export function readStateFromSearch(search: string): { p: TankParams; kind: TankKind } | null {
  const q = search.startsWith('?') ? search.slice(1) : search;
  const hit = q.split('&').find((kv) => kv.startsWith('s='));
  if (!hit) return null;

  const decoded = decodeState(decodeURIComponent(hit.slice(2)));
  if (!decoded) return null;

  const clamped = clampParams(decoded.p);
  if (!clamped.ok) return null;

  return { p: clamped.value, kind: decoded.kind };
}
