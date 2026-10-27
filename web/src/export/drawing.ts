import type { BuildResult, Part } from '../model/types';

/** 一条落图纸上的标注：文本 + 屏幕坐标（左上角原点，Y 向下） */
export interface AnnotationPlan {
  text: string;
  x: number;
  y: number;
}

/** 四周留白，避免标注压在缸体轮廓上 */
const MARGIN = 0.06;

const isTank = (p: Part): boolean => (p.envelope ?? 'tank') !== 'extern';

/**
 * 把三维标注位置投影成屏幕坐标（纯函数，不碰 canvas）。
 *
 * 这是**正视图**的粗略布局：只取每个板件中心的 x/y，按缸体包络归一化。
 * 它不追求透视正确 —— 图纸要的是"这个尺寸标在哪个板件旁边"，而精确投影
 * 依赖相机姿态，参数一变标注就会漂。固定正视、按包络缩放，标注位置才稳定可复现。
 *
 * 旋转的板件按未旋转的 `l/w` 取半宽：这是**视觉排版**而非几何计算，
 * 真实包围盒由 `solver/assertions.ts` 的 `worldExtent` 负责，两者不要混用。
 */
export function planAnnotations(
  result: BuildResult,
  width: number,
  height: number,
): AnnotationPlan[] {
  const parts = result.parts.filter(isTank);
  if (parts.length === 0 || width <= 0 || height <= 0) return [];

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const p of parts) {
    minX = Math.min(minX, p.x - p.l / 2);
    maxX = Math.max(maxX, p.x + p.l / 2);
    minY = Math.min(minY, p.y - p.w / 2);
    maxY = Math.max(maxY, p.y + p.w / 2);
  }

  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);
  const mx = width * MARGIN;
  const my = height * MARGIN;
  const sx = (width - mx * 2) / spanX;
  const sy = (height - my * 2) / spanY;

  return result.dims.map((d) => ({
    text: d.text,
    x: mx + (d.x - minX) * sx,
    // 屏幕 Y 向下、缸体 Y 向上，这里翻转
    y: my + (maxY - d.y) * sy,
  }));
}

/** 把标注画到 2D 上下文上，带一层半透明底衬保证可读 */
export function drawAnnotations(
  ctx: CanvasRenderingContext2D,
  plan: AnnotationPlan[],
): void {
  ctx.save();
  ctx.font = '12px ui-sans-serif, system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  for (const a of plan) {
    const w = ctx.measureText(a.text).width;
    const padX = 4;
    const halfH = 9;
    ctx.fillStyle = 'rgba(10, 14, 18, 0.72)';
    ctx.fillRect(a.x - padX, a.y - halfH, w + padX * 2, halfH * 2);
    ctx.fillStyle = '#e8f2f0';
    ctx.fillText(a.text, a.x, a.y);
  }
  ctx.restore();
}

/**
 * 导出带标注的 PNG。
 *
 * 渲染用的 WebGL canvas 不能直接写入，先复制到一张 2D 画布再叠加标注。
 * 拿不到 2D 上下文时直接抛错，而不是返回一张空白图 —— 静默产出空白图纸
 * 比报错更难排查。
 */
export async function exportDrawing(
  canvas: HTMLCanvasElement,
  result: BuildResult,
): Promise<Blob> {
  const width = canvas.width || 1024;
  const height = canvas.height || 768;

  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;

  // jsdom 之类没有 canvas 实现的环境会直接抛，包起来当作"没有上下文"处理
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = out.getContext('2d');
  } catch {
    ctx = null;
  }
  if (!ctx) throw new Error('导出图纸需要 2D 画布上下文');

  // 复制 WebGL 画布。跨源污染的画布会抛 SecurityError —— 包起来让它走调用方的
  // 错误分支（面板会显示出来），而不是变成未处理的 rejection。
  try {
    ctx.drawImage(canvas, 0, 0, width, height);
  } catch (e) {
    throw new Error(`画布复制失败：${e instanceof Error ? e.message : String(e)}`);
  }

  drawAnnotations(ctx, planAnnotations(result, width, height));

  return await new Promise<Blob>((resolve, reject) => {
    out.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('PNG 编码失败'))),
      'image/png',
    );
  });
}

/** 触发浏览器下载。文件名带时间戳，连续导出不会互相覆盖 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // 立即 revoke 会让部分浏览器来不及取数据
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
