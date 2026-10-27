import { describe, it, expect } from 'vitest';
import { attachHole } from '../../src/rules/holes';
import type { Part, Hole } from '../../src/model/types';

const plate: Part = {
  rule: 'frontBack', label: '前后', l: 500, w: 400, h: 8,
  x: 0, y: 200, z: 154, material: 'ultra',
};

const overflowSlot: Hole = { kind: 'rect', l: 40, w: 40, h: 8, x: 0, y: 0, z: 0, style: 'cutout' };
const bulkhead: Hole = { kind: 'circle', l: 30, w: 30, h: 20, x: 10, y: 20, z: 0, style: 'drill' };

describe('挖孔', () => {
  it('无孔时原样返回同一对象', () => {
    expect(attachHole(plate, [])).toBe(plate);
  });

  it('挂孔后板件本体尺寸与位置不变', () => {
    const r = attachHole(plate, [bulkhead]);
    expect(r.l).toBe(500);
    expect(r.w).toBe(400);
    expect(r.h).toBe(8);
    expect(r.x).toBe(0);
    expect(r.y).toBe(200);
    expect(r.z).toBe(154);
    expect(r.holes).toHaveLength(1);
  });

  it('矩形开口孔深上下各加 1mm 余量', () => {
    const [h] = attachHole(plate, [overflowSlot]).holes!;
    expect(h.h).toBe(8 + 2);
  });

  it('圆形穿孔同样加余量', () => {
    const [h] = attachHole(plate, [bulkhead]).holes!;
    expect(h.h).toBe(20 + 2);
  });

  it('保留孔的种类与样式', () => {
    const [rect] = attachHole(plate, [overflowSlot]).holes!;
    const [round] = attachHole(plate, [bulkhead]).holes!;
    expect(rect.kind).toBe('rect');
    expect(rect.style).toBe('cutout');
    expect(round.kind).toBe('circle');
    expect(round.style).toBe('drill');
  });

  it('多孔全部加余量', () => {
    const r = attachHole(plate, [overflowSlot, bulkhead]);
    expect(r.holes).toHaveLength(2);
    expect(r.holes!.map((h) => h.h)).toEqual([10, 22]);
  });

  it('不修改传入的孔对象，也不污染原板件', () => {
    const holes = [overflowSlot];
    attachHole(plate, holes);
    expect(holes[0].h).toBe(8);
    expect(plate.holes).toBeUndefined();
  });

  it('返回副本而非原对象', () => {
    expect(attachHole(plate, [bulkhead])).not.toBe(plate);
  });

  it('二次调用追加而不是覆盖', () => {
    // 同一块板可能既要梳齿开口又要穿板钻孔：第二次挂孔不能把第一批吞掉
    const once = attachHole(plate, [overflowSlot]);
    const twice = attachHole(once, [bulkhead]);
    expect(twice.holes).toHaveLength(2);
    expect(twice.holes!.map((h) => h.kind)).toEqual(['rect', 'circle']);
    // 两批各自都带过切余量，不是只有新来的那批
    expect(twice.holes!.map((h) => h.h)).toEqual([10, 22]);
  });

  it('二次调用不修改上一轮的结果', () => {
    const once = attachHole(plate, [overflowSlot]);
    attachHole(once, [bulkhead]);
    expect(once.holes).toHaveLength(1);
  });
});
