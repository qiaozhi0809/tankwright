import type { TankSpec } from './types';
import { floorRule, frontBackRule, leftRightRule } from './base';
import { braceRule } from './brace';
import { overflowRule } from './overflow';
import { baffleRule } from './baffle';

/**
 * 标准鱼缸：四壁 + 底板，可选拉筋、溢流仓、隔板组。
 * 缸型只是规则清单，不含任何拼装逻辑。
 */
export const jarSpec: TankSpec = {
  kind: 'jar',
  label: '标准鱼缸',
  rules: [floorRule, frontBackRule, leftRightRule, braceRule, overflowRule, baffleRule],
};
