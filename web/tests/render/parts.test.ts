import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { partToMesh, partsToGroup } from '../../src/render/parts';
import type { Part, GlassGrade } from '../../src/model/types';

const part: Part = {
  rule: 'frontBack', label: '前后', l: 500, w: 400, h: 8,
  x: 0, y: 200, z: 154, ry: 2, material: 'ultra',
};

function box(mesh: THREE.Mesh) {
  mesh.geometry.computeBoundingBox();
  return mesh.geometry.boundingBox!;
}

describe('毫米转米 —— 唯一的单位边界', () => {
  it('几何尺寸按 0.001 缩放', () => {
    const b = box(partToMesh(part, new THREE.MeshBasicMaterial()));
    expect(b.max.x - b.min.x).toBeCloseTo(0.5, 5);
    expect(b.max.y - b.min.y).toBeCloseTo(0.4, 5);
    expect(b.max.z - b.min.z).toBeCloseTo(0.008, 5);
  });

  it('位置同样按 0.001 缩放', () => {
    const m = partToMesh(part, new THREE.MeshBasicMaterial());
    expect(m.position.y).toBeCloseTo(0.2, 5);
    expect(m.position.z).toBeCloseTo(0.154, 5);
  });

  it('几何不是以毫米为单位的原值', () => {
    const b = box(partToMesh(part, new THREE.MeshBasicMaterial()));
    // 漏掉 MM 会得到 500/400/8，这里明确排除
    expect(b.max.x - b.min.x).not.toBeCloseTo(500, 1);
    expect(b.max.y - b.min.y).not.toBeCloseTo(400, 1);
  });
});

describe('旋转分母转弧度', () => {
  it('ry: 2 得到 π/2，而不是 2 或 2π', () => {
    const m = partToMesh(part, new THREE.MeshBasicMaterial());
    expect(m.rotation.y).toBeCloseTo(Math.PI / 2, 6);
    expect(m.rotation.y).not.toBeCloseTo(2, 3);
    expect(m.rotation.y).not.toBeCloseTo(Math.PI * 2, 3);
  });

  it('rx 与 rz 同样按分母解释', () => {
    const mx = partToMesh({ ...part, ry: undefined, rx: 2 }, new THREE.MeshBasicMaterial());
    expect(mx.rotation.x).toBeCloseTo(Math.PI / 2, 6);
    const mz = partToMesh({ ...part, ry: undefined, rz: 3 }, new THREE.MeshBasicMaterial());
    expect(mz.rotation.z).toBeCloseTo(Math.PI / 3, 6);
  });

  it('未设置旋转时保持 0，不产生 NaN', () => {
    const m = partToMesh({ ...part, ry: undefined }, new THREE.MeshBasicMaterial());
    expect(m.rotation.x).toBe(0);
    expect(m.rotation.y).toBe(0);
    expect(m.rotation.z).toBe(0);
    expect(Number.isNaN(m.rotation.y)).toBe(false);
  });
});

describe('身份信息', () => {
  it('网格名是中文标签', () => {
    expect(partToMesh(part, new THREE.MeshBasicMaterial()).name).toBe('前后');
  });

  it('userData.rule 是机器名，与标签保持区分', () => {
    const m = partToMesh(part, new THREE.MeshBasicMaterial());
    expect(m.userData.rule).toBe('frontBack');
    expect(m.userData.rule).not.toBe(m.name);
  });

  it('userData 带出材质等级', () => {
    const m = partToMesh(part, new THREE.MeshBasicMaterial());
    expect(m.userData.material).toBe('ultra');
  });
});

describe('挖孔暂不切除，留出 Task 10 的接缝', () => {
  it('带孔板件仍是普通立方体', () => {
    const holed: Part = {
      ...part,
      holes: [{ kind: 'circle', style: 'drill', l: 30, w: 30, h: 10, x: 0, y: 0, z: 0 }],
    };
    const m = partToMesh(holed, new THREE.MeshBasicMaterial());
    const pos = m.geometry.getAttribute('position');
    // 一个未被切割的 BoxGeometry 是 6 面 × 4 顶点
    expect(pos.count).toBe(24);
  });

  it('孔信息从网格上可回读，供 Task 10 接管', () => {
    const holed: Part = {
      ...part,
      holes: [{ kind: 'circle', style: 'drill', l: 30, w: 30, h: 10, x: 0, y: 0, z: 0 }],
    };
    const m = partToMesh(holed, new THREE.MeshBasicMaterial());
    expect(m.userData.holes).toHaveLength(1);
  });
});

describe('整组装配', () => {
  const mats = new Map<GlassGrade, THREE.Material>([
    ['float', new THREE.MeshBasicMaterial({ name: 'float' })],
    ['ultra', new THREE.MeshBasicMaterial({ name: 'ultra' })],
  ]);

  const parts: Part[] = [
    part,
    { rule: 'leftRight', label: '左右', l: 382, w: 400, h: 8, x: 196, y: 200, z: 0, ry: 2, material: 'float' },
    { rule: 'floor', label: '底板', l: 384, w: 384, h: 8, x: 0, y: 4, z: 0, rx: 2, material: 'float' },
  ];

  it('每块板件对应一个子节点', () => {
    expect(partsToGroup(parts, mats).children).toHaveLength(parts.length);
  });

  it('按材质等级取对应材质', () => {
    const g = partsToGroup(parts, mats);
    const byRule = (r: string) => g.children.find((c) => c.userData.rule === r) as THREE.Mesh;
    expect((byRule('frontBack').material as THREE.Material).name).toBe('ultra');
    expect((byRule('leftRight').material as THREE.Material).name).toBe('float');
  });

  it('材质表缺少该等级时回落，而不是抛错', () => {
    const onlyFloat = new Map<GlassGrade, THREE.Material>([['float', mats.get('float')!]]);
    expect(() => partsToGroup(parts, onlyFloat)).not.toThrow();
    const g = partsToGroup(parts, onlyFloat);
    expect(g.children).toHaveLength(parts.length);
    for (const c of g.children) expect((c as THREE.Mesh).material).toBeDefined();
  });

  it('缸外附属结构同样参与渲染', () => {
    const cab: Part = {
      rule: 'cabinet', label: '柜体', l: 900, w: 450, h: 750,
      x: 0, y: -375, z: 0, material: 'float', envelope: 'extern',
    };
    const g = partsToGroup([cab], mats);
    expect(g.children).toHaveLength(1);
    expect(g.children[0].name).toBe('柜体');
  });
});
