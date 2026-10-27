import type { Part } from '../model/types';
import { buildBOM, buildExternBOM } from '../quote/bom';
import { priceBOM } from '../quote/pricing';
import type { PriceConfig } from '../quote/pricing';

export interface BomTableProps {
  parts: Part[];
  prices: PriceConfig;
}

const GRADE_LABEL: Record<string, string> = { ultra: '超白', float: '浮法' };

/**
 * 下料清单。玻璃与缸外结构分两张表：
 * `buildBOM` 已经排除 `envelope === 'extern'` 的构件，`buildExternBOM`
 * 返回的 `ExternRow` 没有面积字段，从类型上就不可能被当成玻璃计价。
 */
export function BomTable({ parts, prices }: BomTableProps) {
  const glass = buildBOM(parts);
  const extern = buildExternBOM(parts);
  const quote = priceBOM(glass, prices);

  return (
    <div className="eng-bom">
      <h3>玻璃下料</h3>
      <table>
        <thead>
          <tr>
            <th>材质</th>
            <th>尺寸 mm</th>
            <th>数量</th>
            <th>面积 ㎡</th>
          </tr>
        </thead>
        <tbody>
          {glass.map((r) => (
            <tr key={`${r.grade}-${r.size}`}>
              <td>{GRADE_LABEL[r.grade] ?? r.grade}</td>
              <td>{r.size}</td>
              <td>{r.count}</td>
              <td>{r.areaM2.toFixed(4)}</td>
            </tr>
          ))}
          {glass.length === 0 ? (
            <tr>
              <td colSpan={4}>暂无玻璃</td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <dl className="eng-quote">
        <dt>玻璃</dt>
        <dd>¥{quote.glass.toFixed(2)}</dd>
        <dt>加工</dt>
        <dd>¥{quote.cut.toFixed(2)}</dd>
        <dt>胶</dt>
        <dd>¥{quote.glue.toFixed(2)}</dd>
        <dt>合计</dt>
        <dd>¥{quote.total.toFixed(2)}</dd>
      </dl>

      {extern.length > 0 ? (
        <>
          <h3>缸外结构（不计玻璃面积）</h3>
          <table>
            <thead>
              <tr>
                <th>部件</th>
                <th>尺寸 mm</th>
                <th>数量</th>
              </tr>
            </thead>
            <tbody>
              {extern.map((r) => (
                <tr key={`${r.rule}-${r.size}`}>
                  <td>{r.label}</td>
                  <td>{r.size}</td>
                  <td>{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </div>
  );
}
