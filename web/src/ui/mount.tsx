import { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { TankKind, TankParams } from '../model/types';
import { DEFAULT_KIND, DEFAULT_PARAMS } from '../model/params';
import { SPECS } from '../rules';
import { solve } from '../solver/solve';
import { buildBOM, buildExternBOM } from '../quote/bom';
import { priceBOM, type PriceConfig } from '../quote/pricing';
import { DEFAULT_PRICES } from '../quote/config';
import { exportDrawing, downloadBlob } from '../export/drawing';
import { exportXlsx } from '../export/xlsx';
import { shareUrl, readStateFromSearch } from '../share/urlState';
import { ParamForm } from './ParamForm';
import { SpecPicker } from './SpecPicker';
import { BomTable } from './BomTable';
import { MaterialPanel, DEFAULT_SCENE, type SceneSettings } from './MaterialPanel';

export interface MountPanelOptions {
  /** 参数或缸型变化时回调。调用方负责 3D 重建，顺序见 main.js 的注释。 */
  onRebuild: (p: TankParams, kind: TankKind) => void;
  /** 外观变化时回调：背景 / 灯色 / 灯光强度 */
  onScene?: (s: SceneSettings) => void;
  /** 取当前 3D 画布用于导出图纸；拿不到就只是禁用导出按钮 */
  getCanvas?: () => HTMLCanvasElement | null;
  prices?: PriceConfig;
  initial?: TankParams;
  initialKind?: TankKind;
}

function Panel({
  onRebuild,
  onScene,
  getCanvas,
  prices = DEFAULT_PRICES,
  initial,
  initialKind,
}: MountPanelOptions) {
  const [params, setParams] = useState<TankParams>(initial ?? DEFAULT_PARAMS);
  const [kind, setKind] = useState<TankKind>(initialKind ?? DEFAULT_KIND);
  const [scene, setScene] = useState<SceneSettings>(DEFAULT_SCENE);
  const [status, setStatus] = useState('');

  // 面板自己算一份 build result 用于清单；3D 侧拿到的是同一套参数，
  // 两边不会因为各自推导而漂移。
  const result = useMemo(() => solve(SPECS[kind], params), [kind, params]);

  // 清单用**未过滤**的 parts：场景里为了不重复画柜体而剔掉 extern，
  // 那是渲染去重，不是发票去重。
  const glassRows = useMemo(() => buildBOM(result.parts), [result]);
  const externRows = useMemo(() => buildExternBOM(result.parts), [result]);
  const quote = useMemo(() => priceBOM(glassRows, prices), [glassRows, prices]);

  useEffect(() => {
    onRebuild(params, kind);
  }, [params, kind, onRebuild]);

  useEffect(() => {
    onScene?.(scene);
  }, [scene, onScene]);

  const doExportDrawing = useCallback(async () => {
    const canvas = getCanvas?.() ?? null;
    if (!canvas) {
      setStatus('画布未就绪，稍后再试');
      return;
    }
    try {
      downloadBlob(await exportDrawing(canvas, result), `缸体图纸-${Date.now()}.png`);
      setStatus('图纸已导出');
    } catch (e) {
      setStatus(e instanceof Error ? e.message : '导出图纸失败');
    }
  }, [getCanvas, result]);

  const doExportXlsx = useCallback(async () => {
    try {
      downloadBlob(
        await exportXlsx(glassRows, externRows, quote),
        `下料清单-${Date.now()}.xlsx`,
      );
      setStatus('下料清单已导出');
    } catch (e) {
      setStatus(e instanceof Error ? e.message : '导出清单失败');
    }
  }, [glassRows, externRows, quote]);

  const doShare = useCallback(async () => {
    const url = shareUrl(params, kind);
    try {
      await navigator.clipboard.writeText(url);
      setStatus('分享链接已复制');
    } catch {
      // 没有剪贴板权限时退化成可复制的只读输入
      setStatus(url);
    }
  }, [params, kind]);

  return (
    <section className="eng-panel-inner" aria-label="缸体工程">
      <header className="eng-head">
        <h2>缸体工程</h2>
        <span className="eng-vol">{result.volumeL.toFixed(1)} L</span>
      </header>
      <SpecPicker value={kind} onChange={setKind} />
      <ParamForm value={params} onChange={setParams} />
      <MaterialPanel
        material={params.material}
        onMaterial={(m) => setParams({ ...params, material: m })}
        scene={scene}
        onScene={setScene}
      />
      <div className="eng-actions">
        <button type="button" onClick={doExportDrawing}>
          导出图纸
        </button>
        <button type="button" onClick={doExportXlsx}>
          导出 Excel
        </button>
        <button type="button" onClick={doShare}>
          分享链接
        </button>
      </div>
      <p className="eng-status" role="status">
        {status}
      </p>
      <BomTable parts={result.parts} prices={prices} />
    </section>
  );
}

/** 把工程面板挂到 `#eng-panel`。重复调用会复用同一个根。 */
let root: ReturnType<typeof createRoot> | null = null;

export function mountPanel(opts: MountPanelOptions): void {
  const host = document.getElementById('eng-panel');
  if (!host) return;

  // 分享链接优先：`?s=...` 解析成功就用它当初始参数，失败静默退回默认值。
  let initial = opts.initial;
  let initialKind = opts.initialKind;
  if (!initial && typeof location !== 'undefined') {
    const fromUrl = readStateFromSearch(location.search);
    if (fromUrl) {
      initial = fromUrl.p;
      initialKind = fromUrl.kind;
    }
  }

  if (!root) root = createRoot(host);
  root.render(<Panel {...opts} initial={initial} initialKind={initialKind} />);
}

export function unmountPanel(): void {
  root?.unmount();
  root = null;
}
