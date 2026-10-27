/**
 * 全部缸型的**唯一**清单。顺序即界面顺序。
 *
 * 放在 model 层是因为 `rules/` 与 `share/` 都要用它：任何一方各自再写一份，
 * 就会出现"界面列了 8 种、分享链接只认 7 种"这类只在运行时才发现的漂移。
 */
export const TANK_KINDS = [
  'jar', 'rack', 'sys', 'filter',
  'sideback', 'whole', 'seafood', 'upfilter',
] as const;

export type TankKind = (typeof TANK_KINDS)[number];

export type GlassGrade = 'float' | 'ultra';

export interface TankParams {
  L: number; W: number; H: number;
  sideT: number; bottomT: number; baffleT: number; gap: number;
  baffleCount: number; baffleCut: number;
  overflowW: number; sandW: number; pumpW: number; braceW: number;
  material: 0 | 1 | 2 | 3;
}

export interface Geom {
  // 输入直传
  L: number; W: number; H: number;
  sideT: number; bottomT: number; baffleT: number; gap: number;
  baffleCount: number; baffleCut: number;
  overflowW: number; sandW: number; pumpW: number; braceW: number;
  material: number;
  // 派生
  outerL: number; outerW: number;
  innerL: number; innerW: number; innerH: number;
  /** 溢流仓占用的后侧深度：hasOverflow ? overflowW + baffleT : 0 */
  floodW: number;
  /** 可用腔深 = innerW − floodW；横跨腔深的板件只能用到这里 */
  usableW: number;
  /** 可用腔中心 z = −innerW/2 + floodW + usableW/2；无溢流仓时坍缩为 0 */
  usableZ: number;
  floorY: number;
  baffleSpan: number;
  hasOverflow: boolean;
  hasBrace: boolean;
  hasSand: boolean;
  hasPump: boolean;
  volumeL: number;
}

export interface Hole {
  kind: 'rect' | 'circle';
  /**
   * 加工方式。`'cutout'` 是矩形开口（溢流梳齿、走线缺口一类），
   * `'drill'` 是圆形穿孔（穿板接头、下水孔一类）。
   * 仅影响加工与图纸标注，不改变布尔切除的形状规则。
   */
  style: 'cutout' | 'drill';
  l: number; w: number; h: number;
  x: number; y: number; z: number;
}

export interface Part {
  rule: string;
  label: string;
  l: number; w: number; h: number;
  x: number; y: number; z: number;
  /**
   * 旋转**分母**，不是弧度也不是角度：实际旋转量是 `Math.PI / n`。
   * `rx: 2` = 绕 X 轴 90°，`ry: 3` = 绕 Y 轴 60°。省略表示不旋转。
   *
   * 这个约定不直观，但它是几何层与渲染层之间的契约：`render/parts.ts`
   * 直接做 `mesh.rotation.x = Math.PI / part.rx`。
   */
  rx?: number; ry?: number; rz?: number;
  material: GlassGrade;
  holes?: Hole[];
  /**
   * 所属包络。`'tank'`（默认）表示缸体板件，必须落在缸体包络与壁厚带之内；
   * `'extern'` 表示柜体、铝架、顶滤槽、保温层这类**物理上在缸体之外**的附属结构。
   * 若把支撑结构也塞进缸体包络，等于要求柜子长在缸里面。
   */
  envelope?: 'tank' | 'extern';
}

export interface Dimension {
  text: string;
  x: number; y: number; z: number;
  from?: [number, number, number];
  to?: [number, number, number];
  rx?: number; ry?: number; rz?: number;
}

export interface BuildResult {
  kind: TankKind;
  parts: Part[];
  dims: Dimension[];
  volumeL: number;
}
