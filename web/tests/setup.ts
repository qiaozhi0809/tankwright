import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

/**
 * 每个用例后卸载 React 根。
 *
 * 不能省：vitest 未开 `globals`，`@testing-library/react` 的自动 cleanup 因此**从未注册**。
 * 少了这一步，同一文件里的第二次 `render()` 会得到一个挂不上事件处理器的根 ——
 * `fireEvent` 表面成功、回调却一次都不触发，测试会以一种极难定位的方式失败。
 */
afterEach(() => {
  cleanup();
});
