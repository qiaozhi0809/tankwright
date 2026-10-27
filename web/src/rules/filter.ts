import type { TankSpec } from './types';
import { floorRule, frontBackRule, leftRightRule } from './base';
import { overflowRule } from './overflow';
import { baffleRule } from './baffle';

/**
 * 底滤缸：底缸本体 + 溢流仓 + 隔板组。
 *
 * 与标准鱼缸的关键差别是**没有拉筋**——底缸通常敞口布置滤材与管路，
 * 上缘拉筋会挡住伸手与抽拉滤盒，所以只保留四壁、底板、溢流板与隔板。
 */
export const filterSpec: TankSpec = {
  kind: 'filter',
  label: '底滤缸',
  rules: [floorRule, frontBackRule, leftRightRule, overflowRule, baffleRule],
};
