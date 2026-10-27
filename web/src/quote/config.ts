import type { PriceConfig } from './pricing';

/**
 * 默认定价，仅作为面板的初始值 —— Task 12 的表单会把它整体覆盖掉。
 * 数值取行业内常见的超白/浮法价差关系，不是任何一家的实际报价。
 */
export const DEFAULT_PRICES: PriceConfig = {
  ultraPerM2: 380,
  floatPerM2: 180,
  cutPerPart: 5,
  /** 玻璃钻孔比切割慢得多，单价取切割费的近两倍 */
  holesPerPart: 9,
  glue: 60,
};
