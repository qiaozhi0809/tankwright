import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';
import { glassVS, glassFS } from '../../third_party/aquarium-editor/tank.js';
import type { BuildResult, Part, Hole, TankParams } from '../model/types';
import { partToMesh, MM } from './parts';

// 毫米→米的比例只从 `parts.ts` 导入，不在这里另起一份：
// 两边各定义一次时，孔位与几何体会各按各的比例落位。

/**
 * 毫米参数 → 底座要的米制缸体定义。
 *
 * 这是全工程里**唯一**的 mm→m 交接点（渲染侧自己的换算同样用 `parts.ts` 的 `MM`）。
 * 放在这里而不是散在 `main.js` 的调用点上：那四处 `/1000` 既是第四份换算，
 * 又完全测不到。
 */
export function toBaseDef(p: TankParams): { w: number; d: number; h: number; glass: number } {
  return { w: p.L * MM, d: p.W * MM, h: p.H * MM, glass: p.sideT * MM };
}

/** 决定造景是否值得保留的包络字段：缸体尺寸与玻璃厚 */
const ENVELOPE_KEYS = ['L', 'W', 'H', 'sideT', 'bottomT'] as const;

/**
 * 新旧参数是否共享同一个缸体包络。
 *
 * 只有包络变了，底床才真的坐不住（缸变小石头会穿出去、缸变大底床会悬空），
 * 那时才该丢弃造景。调隔板数量、换溢流宽度、改材质都不改变缸的外廓，
 * 没有任何理由把用户摆了半天的水草和鱼清空。
 *
 * 只比较 `ENVELOPE_KEYS` 这几项，其余字段一律忽略。
 */
export function envelopeUnchanged(
  prev: TankParams | null | undefined,
  next: TankParams,
): boolean {
  if (!prev) return false;
  return ENVELOPE_KEYS.every((k) => prev[k] === next[k]);
}

/**
 * 玻璃叠加层的布尔求值器。`three-bvh-csg` 的 `Evaluator` 内部持有 BVH 缓存，
 * 复用同一个实例比每次新建省内存。
 */
const evaluator = new Evaluator();

/** `partToMesh` 用 `BoxGeometry(l, w, h)`，所以三个轴分别是 X/Y/Z；薄轴取最小者。 */
function thinAxisObject(part: Part): THREE.Vector3 {
  const dims = [part.l, part.w, part.h];
  let minIdx = 0;
  for (let i = 1; i < 3; i++) if (dims[i] < dims[minIdx]) minIdx = i;
  return [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)][minIdx];
}

/** `rx/ry/rz` 是分母，角度 = π/n。 */
function eulerOf(part: Part): THREE.Euler {
  return new THREE.Euler(
    part.rx ? Math.PI / part.rx : 0,
    part.ry ? Math.PI / part.ry : 0,
    part.rz ? Math.PI / part.rz : 0,
  );
}

/** 旋转后的世界轴对齐半尺寸，用于求结构整体包围盒。 */
function halfExtentsWorld(part: Part): THREE.Vector3 {
  const geo = new THREE.BoxGeometry(part.l * MM, part.w * MM, part.h * MM);
  geo.computeBoundingBox();
  const box = geo.boundingBox!.clone();
  geo.dispose();
  box.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(eulerOf(part)));
  return box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
}

/** 所有板件包围盒的中心——朝外方向的参考原点。 */
function structureCenter(parts: Part[]): THREE.Vector3 {
  const box = new THREE.Box3();
  for (const p of parts) {
    const c = new THREE.Vector3(p.x * MM, p.y * MM, p.z * MM);
    const he = halfExtentsWorld(p);
    box.expandByPoint(c.clone().sub(he));
    box.expandByPoint(c.clone().add(he));
  }
  return box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3());
}

/**
 * 板件的朝外法线（世界坐标）。
 *
 * 玻璃 shader 用 `dot(n, uOut) < 0` 丢弃内表面——所以 `uOut` 必须是这块板
 * **背离缸体中心**的那个方向。取板件薄轴的世界方向，再用它到中心的位移定正负，
 * 这样底板朝下、前后板朝前后、左右板朝左右，隔板与拉筋也各自朝外。
 */
function outwardNormal(part: Part, center: THREE.Vector3): THREE.Vector3 {
  const world = thinAxisObject(part).applyEuler(eulerOf(part)).normalize();
  const pos = new THREE.Vector3(part.x * MM, part.y * MM, part.z * MM);
  const toOut = pos.sub(center);
  const dot = world.dot(toOut);
  return Math.abs(dot) < 1e-9 ? world : world.multiplyScalar(Math.sign(dot));
}

/** 底座的玻璃材质：uniform 名与混合模式必须与 `tank.js::build()` 里的一致。 */
export function paneMaterial(
  axisObject: THREE.Vector3,
  outWorld: THREE.Vector3,
  lamp = 1,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uAxis: { value: axisObject.clone() },
      uOut: { value: outWorld.clone() },
      uLamp: { value: lamp },
    },
    vertexShader: glassVS,
    fragmentShader: glassFS,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: THREE.FrontSide,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
}

/**
 * 局部空间的布尔切除。
 *
 * 规格 §3.0：孔位是**板件局部坐标**，所以切割在几何体自身的坐标系里做，
 * 切完再由 mesh 的 position/rotation 把结果带到世界——不要在切除前应用变换。
 * 过切已经由 `attachHole` 加过，这里直接用 `hole.h`，不再加余量。
 */
export function cutHoles(mesh: THREE.Mesh): THREE.Mesh {
  const holes = (mesh.userData?.holes ?? []) as Hole[];
  if (holes.length === 0) return mesh;

  let brush = new Brush(mesh.geometry as THREE.BufferGeometry, mesh.material as THREE.Material);
  brush.updateMatrixWorld();

  for (const hole of holes) {
    let cutterGeo: THREE.BufferGeometry;
    if (hole.kind === 'circle') {
      // `kind` 是形状：circle 走圆柱（钻孔），rect 走方盒（开口）。
      // `style` 是加工方式，与 kind 一一对应，几何由 kind 决定。
      const r = Math.min(hole.l, hole.w) * 0.5 * MM;
      cutterGeo = new THREE.CylinderGeometry(r, r, hole.h * MM, 24);
      // 圆柱默认沿 Y；孔位坐标系里孔深沿 Z（板厚方向）。
      cutterGeo.rotateX(Math.PI / 2);
    } else {
      cutterGeo = new THREE.BoxGeometry(hole.l * MM, hole.w * MM, hole.h * MM);
    }

    const cutter = new Brush(cutterGeo, mesh.material as THREE.Material);
    cutter.position.set(hole.x * MM, hole.y * MM, hole.z * MM);
    cutter.updateMatrixWorld();

    brush = evaluator.evaluate(brush, cutter, SUBTRACTION) as Brush;
    cutterGeo.dispose();
  }

  const out = new THREE.Mesh(brush.geometry, mesh.material);
  out.position.copy(mesh.position);
  out.rotation.copy(mesh.rotation);
  out.scale.copy(mesh.scale);
  out.name = mesh.name;
  out.userData = mesh.userData;
  mesh.geometry.dispose();
  return out;
}

/**
 * 把结构板件挂到场景。
 *
 * 幂等：先 `unmountStructure` 再挂，重复调用不会叠加网格。
 *
 * 两条不同的落点，原因是渲染层不同：
 * - 玻璃板件 → `tank.glassGroup`：底座的叠加层，在水面 pass 之后渲染，
 *   `depthTest: false`，专供玻璃 shader 的混合语义。
 * - `envelope === 'extern'` 的附属结构（柜体、灯架、铝架、保温层）→ `tank.group`：
 *   它们是实心不透明体，若留在叠加层里会在水面之后绘制且丢掉深度测试，
 *   遮档关系整个反过来。没有 `tank.group` 时才回退到玻璃组。
 *
 * 每个由本模块挂上去的网格都带 `userData.bridgeOwned = true`，
 * 卸载时只扫自己挂的那些——`tank.group` 里还有底座自己的房间与灯。
 */
export function mountStructure(tank: any, result: BuildResult): void {
  const glassGroup: THREE.Group | undefined = tank?.glassGroup;
  if (!glassGroup) return;

  unmountStructure(tank);

  const solidGroup: THREE.Group | undefined = tank?.group;
  const center = structureCenter(result.parts);

  for (const part of result.parts) {
    let mesh: THREE.Mesh;
    let target: THREE.Group;

    if (part.envelope === 'extern') {
      mesh = partToMesh(
        part,
        new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.72, metalness: 0.08 }),
      );
      target = solidGroup ?? glassGroup;
    } else {
      mesh = partToMesh(part, paneMaterial(thinAxisObject(part), outwardNormal(part, center)));
      mesh = cutHoles(mesh);
      target = glassGroup;
    }

    mesh.userData = { ...mesh.userData, bridgeOwned: true };
    target.add(mesh);
  }
}

/**
 * 释放本模块挂上去的网格。
 *
 * 只清 `bridgeOwned` 的节点：底座在 `tank.group` 里还有房间、灯与阴影目标，
 * 整组清空会把它们一起拆掉。玻璃叠加层里本模块是唯一写入者，
 * 所以那一侧的效果就是清空。
 */
export function unmountStructure(tank: any): void {
  for (const group of [tank?.glassGroup, tank?.group] as (THREE.Group | undefined)[]) {
    if (!group) continue;
    for (let i = group.children.length - 1; i >= 0; i--) {
      const child = group.children[i] as THREE.Mesh;
      if (!child.userData?.bridgeOwned) continue;
      group.remove(child);
      child.geometry?.dispose();
      const mat = child.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose?.();
    }
  }
}
