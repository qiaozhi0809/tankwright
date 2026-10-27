/**
 * 尺寸文本的**唯一**实现。
 *
 * 图纸标注（`Dimension.text`）和下料清单（`BomRow.size` / `ExternRow.size`）都从这里取，
 * 因此两边不可能各写各的 —— 规格 §3.4 起的所有板件尺寸都靠这个保证一致。
 *
 * 格式：`长x宽x厚`，小写 `x`、无空格、保留到 0.1mm。
 */
export function formatMm(n: number): string {
  return String(Math.round(n * 10) / 10);
}

/** `878x428x10`。任何需要展示板件三围的地方都用它 */
export function sizeText(p: { l: number; w: number; h: number }): string {
  return `${formatMm(p.l)}x${formatMm(p.w)}x${formatMm(p.h)}`;
}
