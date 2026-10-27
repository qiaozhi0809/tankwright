import * as THREE from 'three';
import type { Part, GlassGrade, Hole } from '../model/types';

/**
 * 单位边界。
 *
 * 上游（model / rules / solver / quote）全部用毫米；three.js 用米。
 * 换算是**这一层唯一的职责**，`MM` 只定义在这一处，由 `tankBridge` 导入复用，
 * 且只用于几何尺寸、位置与孔位。上游任何一处觉得"数值太大"都不是去改上游的理由。
 */
export const MM = 0.001;

/** 供 Task 10 的布尔切除接管：网格携带原始孔位与板厚，切除时在局部空间成形。 */
export interface PartUserData {
  rule: string;
  material: GlassGrade;
  /** 板件自身厚度（毫米），布尔切除的过切计算要用 */
  thickness: number;
  /** 孔位为板件局部坐标，见规格 §3.0；本任务不切除，仅携带 */
  holes: Hole[];
}

/**
 * 板件 → 单个网格。
 *
 * 旋转 `rx/ry/rz` 是**分母**：角度 = `Math.PI / n`。这是规格的约定，
 * 不是弧度值，也不做任何归一化。
 */
export function partToMesh(part: Part, material: THREE.Material): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(part.l * MM, part.w * MM, part.h * MM);
  const mesh = new THREE.Mesh(geometry, material);

  mesh.position.set(part.x * MM, part.y * MM, part.z * MM);
  if (part.rx) mesh.rotation.x = Math.PI / part.rx;
  if (part.ry) mesh.rotation.y = Math.PI / part.ry;
  if (part.rz) mesh.rotation.z = Math.PI / part.rz;

  mesh.name = part.label;

  const userData: PartUserData = {
    rule: part.rule,
    material: part.material,
    thickness: part.h,
    holes: part.holes ?? [],
  };
  mesh.userData = userData;

  // 此处刻意不调用布尔切除：本任务只建基础立方体。
  // Task 10 应在拿到 mesh 之后、加入场景之前调用 applyBoolean(mesh)，
  // 读 mesh.userData.holes 与 mesh.userData.thickness 完成切除。
  return mesh;
}

/**
 * 板件数组 → 场景组。
 *
 * 材质按玻璃等级查表；缺失等级时回落到表内任意一个材质，而不是抛错——
 * 渲染层不该因为报价侧少配了一档材质就把整个场景打掉。
 * `envelope` 为 `'extern'` 的附属结构同样建网格（柜子必须看得见），
 * 但下料清单必须在按 `material` 汇总**之前**先按 `envelope` 分流。
 */
export function partsToGroup(
  parts: Part[],
  mats: Map<GlassGrade, THREE.Material>,
): THREE.Group {
  const group = new THREE.Group();
  const fallback = mats.values().next().value as THREE.Material | undefined;

  for (const part of parts) {
    const material = mats.get(part.material) ?? fallback;
    group.add(partToMesh(part, material as THREE.Material));
  }

  return group;
}
