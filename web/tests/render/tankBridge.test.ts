import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { mountStructure, unmountStructure, cutHoles, paneMaterial, toBaseDef } from '../../src/render/tankBridge';
import type { BuildResult, Part } from '../../src/model/types';

function fakeTank() {
  return { glassGroup: new THREE.Group(), def: { w: 0.4, d: 0.4, h: 0.4, glass: 0.008 } };
}

const result: BuildResult = {
  kind: 'jar',
  volumeL: 60,
  dims: [],
  parts: [
    { rule: 'floor', label: '底板', l: 384, w: 384, h: 8, x: 0, y: 4, z: 0, rx: 2, material: 'float' },
    { rule: 'frontBack', label: '前后', l: 400, w: 400, h: 8, x: 0, y: 200, z: 196, material: 'ultra' },
  ],
};

/** 一个无孔的独立板件，供 CSG 用例使用 */
const cleanPart: Part = {
  rule: 'frontBack', label: '前后', l: 500, w: 400, h: 8,
  x: 0, y: 200, z: 154, material: 'ultra',
};

describe('结构挂载', () => {
  it('挂载后网格数正确', () => {
    const t = fakeTank();
    mountStructure(t, result);
    expect(t.glassGroup.children).toHaveLength(2);
  });

  it('重复挂载不叠加', () => {
    const t = fakeTank();
    mountStructure(t, result);
    mountStructure(t, result);
    expect(t.glassGroup.children).toHaveLength(2);
  });

  it('卸载释放几何', () => {
    const t = fakeTank();
    mountStructure(t, result);
    const geo = (t.glassGroup.children[0] as THREE.Mesh).geometry;
    const spy = vi.spyOn(geo, 'dispose');
    unmountStructure(t);
    expect(t.glassGroup.children).toHaveLength(0);
    expect(spy).toHaveBeenCalled();
  });

  it('网格沿用板件的中文名与来源规则', () => {
    const t = fakeTank();
    mountStructure(t, result);
    const names = t.glassGroup.children.map((c) => c.name);
    expect(names).toContain('前后');
    const rules = t.glassGroup.children.map((c) => (c.userData as any).rule);
    expect(rules).toContain('floor');
  });

  it('每块板件拿到独立的 shader 材质', () => {
    const t = fakeTank();
    mountStructure(t, result);
    const mats = t.glassGroup.children.map((c) => (c as THREE.Mesh).material as THREE.ShaderMaterial);
    expect(mats[0]).not.toBe(mats[1]);
    expect(mats[0].uniforms.uOut).toBeDefined();
    expect(mats[0].uniforms.uAxis).toBeDefined();
  });
});

describe('朝外法线', () => {
  it('底板朝下、正面朝 +Z', () => {
    const t = fakeTank();
    mountStructure(t, result);
    const floor = t.glassGroup.children[0] as THREE.Mesh;
    const front = t.glassGroup.children[1] as THREE.Mesh;

    const floorOut = (floor.material as THREE.ShaderMaterial).uniforms.uOut.value as THREE.Vector3;
    const frontOut = (front.material as THREE.ShaderMaterial).uniforms.uOut.value as THREE.Vector3;

    expect(floorOut.y).toBeLessThan(-0.9);       // 朝下
    expect(Math.abs(floorOut.z)).toBeLessThan(0.1);
    expect(frontOut.z).toBeGreaterThan(0.9);      // 朝 +Z
  });

  it('背面板朝 -Z，正面板朝 +Z', () => {
    const t = fakeTank();
    mountStructure(t, {
      ...result,
      parts: [
        { rule: 'frontBack', label: '前后', l: 400, w: 400, h: 8, x: 0, y: 200, z: 196, material: 'float' },
        { rule: 'frontBack', label: '前后', l: 400, w: 400, h: 8, x: 0, y: 200, z: -196, material: 'float' },
      ],
    });
    const frontOut = (t.glassGroup.children[0] as THREE.Mesh).material as THREE.ShaderMaterial;
    const backOut = (t.glassGroup.children[1] as THREE.Mesh).material as THREE.ShaderMaterial;
    expect((frontOut.uniforms.uOut.value as THREE.Vector3).z).toBeGreaterThan(0.9);
    expect((backOut.uniforms.uOut.value as THREE.Vector3).z).toBeLessThan(-0.9);
  });

  it('左右板朝 ±X 而不是 ±Z', () => {
    const t = fakeTank();
    mountStructure(t, {
      ...result,
      parts: [{ rule: 'leftRight', label: '左右', l: 384, w: 400, h: 8, x: 196, y: 200, z: 0, ry: 2, material: 'float' }],
    });
    const out = (t.glassGroup.children[0] as THREE.Mesh).material as THREE.ShaderMaterial;
    const v = out.uniforms.uOut.value as THREE.Vector3;
    expect(v.x).toBeGreaterThan(0.9);
    expect(Math.abs(v.z)).toBeLessThan(0.1);
  });
});

describe('布尔切除', () => {
  it('无孔板件保持 24 个顶点（不触发切除路径）', () => {
    const mesh = cutHoles(
      (() => {
        const m = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 0.4, 0.008),
          paneMaterial(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 1)),
        );
        m.userData = { rule: 'frontBack', material: 'ultra', thickness: 8, holes: [] };
        return m;
      })(),
    );
    const pos = mesh.geometry.getAttribute('position');
    expect(pos.count).toBe(24);
  });

  it('有孔的板件顶点数变多，证明真的切了', () => {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.4, 0.008),
      paneMaterial(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 1)),
    );
    m.userData = {
      rule: 'frontBack',
      material: 'ultra',
      thickness: 8,
      holes: [{ kind: 'circle', l: 30, w: 30, h: 10, x: 0, y: 0, z: 0, style: 'drill' }],
    };
    const cut = cutHoles(m);
    expect(cut.geometry.getAttribute('position').count).toBeGreaterThan(24);
  });

  it('圆孔比方孔切掉更多几何，证明走的是圆柱分支', () => {
    // 只断言「顶点数 > 24」抓不住分支写错：矩形孔同样能让顶点数上涨。
    // 圆孔 24 段径向边 vs 方孔 4 面，顶点数差距是量级性的。
    const cutCount = (kind: 'circle' | 'rect') => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.4, 0.008),
        paneMaterial(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 1)),
      );
      m.userData = {
        rule: 'frontBack',
        material: 'ultra',
        thickness: 8,
        holes: [
          {
            kind,
            l: 30,
            w: 30,
            h: 10,
            x: 0,
            y: 0,
            z: 0,
            style: kind === 'circle' ? 'drill' : 'cutout',
          },
        ],
      };
      return cutHoles(m).geometry.getAttribute('position').count;
    };

    const circle = cutCount('circle');
    const rect = cutCount('rect');
    expect(circle).toBeGreaterThan(rect * 2);
  });

  it('切除结果不超出原板件包围盒', () => {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.4, 0.008),
      paneMaterial(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 1)),
    );
    m.userData = {
      rule: 'frontBack',
      material: 'ultra',
      thickness: 8,
      holes: [{ kind: 'rect', l: 40, w: 40, h: 10, x: 0, y: 0, z: 0, style: 'cutout' }],
    };
    const cut = cutHoles(m);
    cut.geometry.computeBoundingBox();
    const box = cut.geometry.boundingBox!;
    expect(box.max.x).toBeLessThanOrEqual(0.2501);
    expect(box.min.x).toBeGreaterThanOrEqual(-0.2501);
    expect(box.max.y).toBeLessThanOrEqual(0.2001);
    expect(box.min.y).toBeGreaterThanOrEqual(-0.2001);
  });

  it('切除保留板件的名字与 userData', () => {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.4, 0.008),
      paneMaterial(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 1)),
    );
    m.name = '前后';
    m.userData = {
      rule: 'frontBack',
      material: 'ultra',
      thickness: 8,
      holes: [{ kind: 'rect', l: 40, w: 40, h: 10, x: 0, y: 0, z: 0, style: 'cutout' }],
    };
    const cut = cutHoles(m);
    expect(cut.name).toBe('前后');
    expect((cut.userData as any).rule).toBe('frontBack');
  });
});

describe('外部结构', () => {
  const cabinet: Part = {
    rule: 'cabinet', label: '柜体', l: 900, w: 750, h: 18,
    x: 0, y: -375, z: 0, material: 'float', envelope: 'extern',
  };

  function tankWithSolids() {
    return { glassGroup: new THREE.Group(), group: new THREE.Group() };
  }

  it('extern 板件挂进 tank.group，不污染玻璃叠加层', () => {
    const t = tankWithSolids();
    mountStructure(t, { ...result, parts: [cabinet] });
    expect(t.glassGroup.children).toHaveLength(0);
    expect(t.group.children).toHaveLength(1);
  });

  it('extern 板件用不透明材质而非玻璃 shader', () => {
    const t = tankWithSolids();
    mountStructure(t, { ...result, parts: [cabinet] });
    const mat = (t.group.children[0] as THREE.Mesh).material;
    expect((mat as THREE.ShaderMaterial).uniforms).toBeUndefined();
    expect((mat as THREE.Material).type).toBe('MeshStandardMaterial');
  });

  it('卸载只清自己挂的网格，底座原有节点保留', () => {
    const t = tankWithSolids();
    const room = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    room.name = '底座的房间';
    t.group.add(room);

    mountStructure(t, { ...result, parts: [cabinet] });
    expect(t.group.children).toHaveLength(2);

    unmountStructure(t);
    expect(t.group.children).toHaveLength(1);
    expect(t.group.children[0]).toBe(room);
  });

  it('重复挂载外部结构不叠加', () => {
    const t = tankWithSolids();
    mountStructure(t, { ...result, parts: [cabinet] });
    mountStructure(t, { ...result, parts: [cabinet] });
    expect(t.group.children).toHaveLength(1);
  });

  it('没有 tank.group 时回退到玻璃组，不丢件', () => {
    const t = fakeTank();
    mountStructure(t, { ...result, parts: [cabinet] });
    expect(t.glassGroup.children).toHaveLength(1);
    expect(((t.glassGroup.children[0] as THREE.Mesh).material as THREE.Material).type).toBe('MeshStandardMaterial');
  });
});

describe('未挂载场景', () => {
  it('没有 glassGroup 时不抛错', () => {
    expect(() => mountStructure({}, result)).not.toThrow();
    expect(() => unmountStructure({})).not.toThrow();
  });
});

describe('毫米 → 底座米制定义', () => {
  const p = {
    L: 900, W: 450, H: 450,
    sideT: 10, bottomT: 10, baffleT: 6, gap: 1,
    baffleCount: 2, baffleCut: 40,
    overflowW: 80, sandW: 0, pumpW: 0, braceW: 19,
    material: 1 as const,
  };

  it('三边与玻璃厚都换算成米', () => {
    expect(toBaseDef(p)).toEqual({ w: 0.9, d: 0.45, h: 0.45, glass: 0.01 });
  });

  it('不是把毫米直接递给底座（漏换算会得到 900）', () => {
    expect(toBaseDef(p).w).not.toBe(900);
    expect(toBaseDef(p).w).toBeLessThan(10);
  });

  it('整数毫米不产生浮点尾巴', () => {
    expect(toBaseDef(p).glass).toBe(0.01);
  });
});
