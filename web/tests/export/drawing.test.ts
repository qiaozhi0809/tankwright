import { describe, it, expect } from 'vitest';
import { planAnnotations, exportDrawing, drawAnnotations } from '../../src/export/drawing';
import type { BuildResult, Part, Dimension } from '../../src/model/types';

function part(over: Partial<Part> = {}): Part {
  return {
    rule: 'floor', label: '底板',
    l: 400, w: 400, h: 8,
    x: 0, y: 0, z: 0,
    material: 'float',
    ...over,
  };
}

const dim = (text: string, x: number, y: number): Dimension => ({ text, x, y, z: 0 });

const result: BuildResult = {
  kind: 'jar',
  volumeL: 60,
  parts: [
    part({ rule: 'floor', label: '底板', y: 4, l: 382, w: 382 }),
    part({ rule: 'frontBack', label: '前后', y: 200, l: 400, w: 400 }),
  ],
  dims: [dim('382x382x8', 0, 4), dim('400x400x8', 0, 200)],
};

describe('标注投影', () => {
  it('每条标注都有对应屏幕位置', () => {
    const plan = planAnnotations(result, 800, 600);
    expect(plan).toHaveLength(result.dims.length);
    expect(plan.map((a) => a.text)).toEqual(['382x382x8', '400x400x8']);
  });

  it('Y 轴翻转：缸体上方映射到屏幕更小的 y', () => {
    const plan = planAnnotations(result, 800, 600);
    const low = plan[0];   // 缸底 y=4
    const high = plan[1];  // 缸中 y=200
    expect(high.y).toBeLessThan(low.y);
  });

  it('坐标落在画布内', () => {
    const plan = planAnnotations(result, 800, 600);
    for (const a of plan) {
      expect(a.x).toBeGreaterThanOrEqual(0);
      expect(a.x).toBeLessThanOrEqual(800);
      expect(a.y).toBeGreaterThanOrEqual(0);
      expect(a.y).toBeLessThanOrEqual(600);
    }
  });

  it('缸外结构不参与包络计算', () => {
    const withCabinet: BuildResult = {
      ...result,
      parts: [
        ...result.parts,
        // 柜体在地面以下、且比缸宽得多；若把它算进包络，标注会被压扁
        part({ rule: 'cabinet', label: '柜顶板', envelope: 'extern', y: -9, l: 490, w: 18 }),
      ],
    };
    const a = planAnnotations(result, 800, 600);
    const b = planAnnotations(withCabinet, 800, 600);
    expect(b.map((x) => x.text)).toEqual(a.map((x) => x.text));
    expect(b.map((x) => Math.round(x.y))).toEqual(a.map((x) => Math.round(x.y)));
  });

  it('空结果不产生标注', () => {
    expect(planAnnotations({ kind: 'jar', parts: [], dims: [], volumeL: 0 }, 800, 600)).toEqual([]);
  });

  it('零尺寸画布不抛异常', () => {
    expect(planAnnotations(result, 0, 0)).toEqual([]);
  });
});

describe('图纸导出', () => {
  it('没有 2D 上下文时抛明确错误，而不是产出空白图', async () => {
    const canvas = document.createElement('canvas');
    await expect(exportDrawing(canvas, result)).rejects.toThrow(/2D 画布上下文/);
  });
});

describe('标注绘制', () => {
  it('按计划逐条绘制，文本原样落笔', () => {
    const drawn: string[] = [];
    const ctx = {
      save() {}, restore() {},
      measureText: (s: string) => ({ width: s.length * 6 }),
      fillRect() {},
      fillText: (s: string) => { drawn.push(s); },
      set font(_v: string) {}, set textBaseline(_v: string) {},
      set fillStyle(_v: string) {},
    } as unknown as CanvasRenderingContext2D;

    drawAnnotations(ctx, planAnnotations(result, 800, 600));
    expect(drawn).toEqual(['382x382x8', '400x400x8']);
  });
});
