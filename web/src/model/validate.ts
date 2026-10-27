import type { TankParams } from './types';

export type ClampResult =
  | { ok: true; value: TankParams }
  | { ok: false; reason: string };

/** 沙缸与泵仓的默认宽度：用来判断哪一个被改动得偏离了可行布局 */
export const SAND_DEFAULT = 139;
export const PUMP_DEFAULT = 49;

/** 沙缸被视为「加宽」的起始宽度 */
export const SAND_WIDE = 140;
/** 泵仓被视为「加宽」的起始宽度 */
export const PUMP_WIDE = 50;

/** 每个隔间至少需要的维护开口（伸手进去清理） */
export const MIN_BAFFLE_SPAN = 125;

/** 拉筋的最小可加工宽度 */
export const MIN_BRACE_W = 19;

/**
 * 把一组用户输入夹紧到加工可行范围内。
 *
 * 拒绝（返回 ok:false）只用于无法靠夹紧救回来的输入：尺寸非正、玻璃厚度吃掉
 * 全部内腔。凡是「可以改小一点继续用」的冲突，都返回夹紧后的参数。
 */
export function clampParams(input: TankParams): ClampResult {
  const p = { ...input };

  if (p.L <= 0 || p.W <= 0 || p.H <= 0) {
    return { ok: false, reason: '长宽高必须大于 0' };
  }
  if (p.sideT <= 0 || p.bottomT <= 0 || p.baffleT <= 0) {
    return { ok: false, reason: '玻璃厚度必须大于 0' };
  }
  if (p.bottomT + 2 * p.sideT >= p.H) {
    return { ok: false, reason: '玻璃厚度超过缸高的可行范围' };
  }

  // 每段至少 125mm 才够伸手维护。下界同样是硬约束：derive() 拿 baffleCount 做
  // 除数，0 会让 baffleSpan 变成 Infinity。
  const maxBaffle = Math.max(Math.floor(p.L / MIN_BAFFLE_SPAN), 1);
  p.baffleCount = Math.min(Math.max(p.baffleCount, 1), maxBaffle);

  // 沙缸与泵仓互斥：两者同时加宽会挤占主缸空间。函数是无状态的，无法知道用户
  // 最后改的是哪一个，因此按「谁偏离默认值更远，谁就是不合理的那一个」来推回；
  // 偏离相同时让沙缸让步，因为泵仓是过滤回路的必经环节。
  if (p.sandW >= SAND_WIDE && p.pumpW >= PUMP_WIDE) {
    const sandDeviation = Math.abs(p.sandW - SAND_DEFAULT);
    const pumpDeviation = Math.abs(p.pumpW - PUMP_DEFAULT);
    if (pumpDeviation > sandDeviation) p.pumpW = PUMP_DEFAULT;
    else p.sandW = SAND_DEFAULT;
  }

  // 切口不足两倍玻璃厚时拉筋无处安放；够高但填了过窄的值，则抬到可加工下限。
  if (p.baffleCut < 2 * p.sideT) p.braceW = 0;
  else if (p.braceW > 0 && p.braceW < MIN_BRACE_W) p.braceW = MIN_BRACE_W;

  return { ok: true, value: p };
}
