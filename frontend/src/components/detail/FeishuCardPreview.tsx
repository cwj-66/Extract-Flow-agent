import type { ExtractionFields, MetricPair } from '../../types';

interface FeishuCardPreviewProps {
  fields: ExtractionFields;
  sourceFile?: string;
}

function cell(v: string | undefined) {
  return v && v.trim() ? v : '—';
}

function MetricTable({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; pair: MetricPair }[];
}) {
  return (
    <div>
      <p className="mb-1.5 text-[13px] font-semibold text-slate-900">{title}</p>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-slate-100 text-left text-slate-600">
            <th className="border border-slate-200 px-2 py-1.5 font-semibold">指标</th>
            <th className="border border-slate-200 px-2 py-1.5 font-semibold">数值</th>
            <th className="border border-slate-200 px-2 py-1.5 font-semibold">变动</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="border border-slate-200 px-2 py-1.5 text-slate-600">{r.label}</td>
              <td className="border border-slate-200 px-2 py-1.5 font-medium text-slate-800">
                {cell(r.pair.value)}
              </td>
              <td className="border border-slate-200 px-2 py-1.5 text-slate-700">
                {cell(r.pair.change)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FeishuCardPreview({ fields, sourceFile }: FeishuCardPreviewProps) {
  const company = fields.company_name !== '无' ? fields.company_name : '';
  const code = fields.stock_code !== '无' ? fields.stock_code : '';
  const period = fields.report_period !== '无' ? fields.report_period : '';
  let title = '【研报摘要】';
  if (company || code) {
    title += code ? `${company}(${code})` : company;
  }
  if (period) title += ` | ${period}点评`;

  const now = new Date().toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
  });

  const segments = fields.business_segments.filter(
    (s) => s.name && s.name.trim() && s.name !== '无'
  );
  const forecasts = fields.profit_forecast.filter((r) => {
    if (!r.year || r.year === '无') return false;
    return !(r.revenue === '无' && r.net_profit === '无');
  });

  return (
    <div className="flex justify-center">
      <div className="w-full max-w-[520px]">
        <p className="mb-3 text-center text-xs text-slate-400">
          飞书卡片预览 · 实际效果以飞书客户端为准
        </p>

        <div className="overflow-hidden rounded-lg shadow-md" aria-label="飞书卡片预览">
          <div style={{ backgroundColor: '#3370FF' }} className="px-4 py-3.5">
            <p className="text-sm font-semibold text-white">{title}</p>
          </div>

          <div className="space-y-3 bg-white px-4 py-4 text-[13px] text-slate-800">
            {fields.rating && fields.rating !== '无' && (
              <p>
                <span className="font-semibold">评级</span>: {fields.rating}
              </p>
            )}

            <MetricTable
              title="核心财务指标"
              rows={[
                { label: '营业收入', pair: fields.revenue },
                { label: '归母净利润', pair: fields.net_profit },
                { label: '加权平均 ROE', pair: fields.roe },
              ]}
            />

            <hr className="border-slate-200" />

            <MetricTable
              title="资产负债"
              rows={[
                { label: '总资产', pair: fields.total_assets },
                { label: '归母净资产', pair: fields.net_assets },
              ]}
            />

            {segments.length > 0 && (
              <>
                <hr className="border-slate-200" />
                <div>
                  <p className="mb-1.5 text-[13px] font-semibold">业务板块表现</p>
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-left text-slate-600">
                        <th className="border border-slate-200 px-2 py-1.5 font-semibold">业务</th>
                        <th className="border border-slate-200 px-2 py-1.5 font-semibold">
                          收入/规模
                        </th>
                        <th className="border border-slate-200 px-2 py-1.5 font-semibold">增速</th>
                      </tr>
                    </thead>
                    <tbody>
                      {segments.map((s, i) => (
                        <tr key={`${s.name}-${i}`}>
                          <td className="border border-slate-200 px-2 py-1.5">{cell(s.name)}</td>
                          <td className="border border-slate-200 px-2 py-1.5 font-medium">
                            {cell(s.value)}
                          </td>
                          <td className="border border-slate-200 px-2 py-1.5">{cell(s.growth)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {forecasts.length > 0 && (
              <>
                <hr className="border-slate-200" />
                <div>
                  <p className="mb-1.5 text-[13px] font-semibold">盈利预测(百万元)</p>
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-left text-slate-600">
                        <th className="border border-slate-200 px-2 py-1.5 font-semibold">年份</th>
                        <th className="border border-slate-200 px-2 py-1.5 font-semibold">
                          营业收入
                        </th>
                        <th className="border border-slate-200 px-2 py-1.5 font-semibold">净利润</th>
                      </tr>
                    </thead>
                    <tbody>
                      {forecasts.map((r) => (
                        <tr key={r.year}>
                          <td className="border border-slate-200 px-2 py-1.5">{r.year}</td>
                          <td className="border border-slate-200 px-2 py-1.5 font-medium">
                            {cell(r.revenue)}
                          </td>
                          <td className="border border-slate-200 px-2 py-1.5 font-medium">
                            {cell(r.net_profit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {fields.core_view && fields.core_view !== '无' && (
              <>
                <hr className="border-slate-200" />
                <div>
                  <p className="mb-1 font-semibold">核心观点</p>
                  <p className="whitespace-pre-wrap text-slate-700">{fields.core_view}</p>
                </div>
              </>
            )}

            {fields.risks && fields.risks !== '无' && (
              <>
                <hr className="border-slate-200" />
                <div>
                  <p className="mb-1 font-semibold">风险提示</p>
                  <p className="whitespace-pre-wrap text-slate-700">{fields.risks}</p>
                </div>
              </>
            )}

            <p className="pt-1 text-[11px] text-slate-400">
              数据来源: {sourceFile || '任务提取结果'} | 提取时间: {now}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
