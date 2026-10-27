import { describe, it, expect } from 'vitest';

describe('底座', () => {
  it('catalog 可被导入', async () => {
    const { TANKS } = await import('../third_party/aquarium-editor/catalog.js');
    expect(TANKS.length).toBeGreaterThan(0);
    expect(TANKS[0]).toMatchObject({ id: '30c' });
  });
});
