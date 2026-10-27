import type { TankSpec } from './types';
import { floorRule, frontBackRule, leftRightRule } from './base';
import { braceRule } from './brace';
import { overflowRule } from './overflow';
import { baffleRule } from './baffle';
import { sandDividerRule, pumpDividerRule } from './divider';

/**
 * 系统组缸：一缸之内同时容纳主养区、沙缸（侧滤）与泵仓。
 *
 * 与标准鱼缸的差别只有两个隔断同时启用：沙缸隔断靠右、泵仓隔断靠左，
 * 中间留给主养区。隔板组仍按 `usableW` 排布，不会穿过溢流仓。
 */
export const sysSpec: TankSpec = {
  kind: 'sys',
  label: '系统组缸',
  rules: [
    floorRule, frontBackRule, leftRightRule,
    braceRule, overflowRule, baffleRule,
    sandDividerRule, pumpDividerRule,
  ],
};
