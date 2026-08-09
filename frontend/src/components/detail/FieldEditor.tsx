import type { ReactNode } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type {
  BusinessSegment,
  ExtractionFields,
  MetricPair,
  ProfitForecastRow,
} from '../../types';

interface FieldEditorProps {
  fields: ExtractionFields;
  originalFields: ExtractionFields;
  readOnly?: boolean;
  onChange: (fields: ExtractionFields) => void;
  onSave: (fields: ExtractionFields) => void;
  onDiscard: () => void;
  dirty: boolean;
}

function MetricInputs({
  label,
  pair,
  readOnly,
  onChange,
}: {
  label: string;
  pair: MetricPair;
  readOnly?: boolean;
  onChange: (pair: MetricPair) => void;
}) {
  return (
    <div className="grid grid-cols-[7rem_1fr_1fr] items-center gap-2">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <input
        className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm disabled:bg-slate-50"
        value={pair.value}
        disabled={readOnly}
        placeholder="数值"
        onChange={(e) => onChange({ ...pair, value: e.target.value })}
      />
      <input
        className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm disabled:bg-slate-50"
        value={pair.change}
        disabled={readOnly}
        placeholder="变动"
        onChange={(e) => onChange({ ...pair, change: e.target.value })}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-stone-200/80 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {children}
    </section>
  );
}

export function FieldEditor({
  fields,
  readOnly,
  onChange,
  onSave,
  onDiscard,
  dirty,
}: FieldEditorProps) {
  const patch = (partial: Partial<ExtractionFields>) => onChange({ ...fields, ...partial });

  const updateSegment = (index: number, row: BusinessSegment) => {
    const next = fields.business_segments.map((s, i) => (i === index ? row : s));
    patch({ business_segments: next });
  };

  const addSegment = () => {
    patch({
      business_segments: [
        ...fields.business_segments,
        { name: '', value: '', growth: '' },
      ],
    });
  };

  const removeSegment = (index: number) => {
    patch({
      business_segments: fields.business_segments.filter((_, i) => i !== index),
    });
  };

  const updateForecast = (index: number, row: ProfitForecastRow) => {
    const next = fields.profit_forecast.map((r, i) => (i === index ? row : r));
    patch({ profit_forecast: next });
  };

  return (
    <div className="space-y-4">
      {!readOnly && dirty && (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onDiscard}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
          >
            放弃修改
          </button>
          <button
            type="button"
            onClick={() => onSave(fields)}
            className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700"
          >
            保存修改
          </button>
        </div>
      )}

      <Section title="基础信息">
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ['company_name', '公司名称'],
              ['stock_code', '证券代码'],
              ['report_period', '报告期'],
              ['rating', '投资评级'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block space-y-1">
              <span className="text-xs font-medium text-slate-600">{label}</span>
              <input
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm disabled:bg-slate-50"
                value={fields[key]}
                disabled={readOnly}
                onChange={(e) => patch({ [key]: e.target.value })}
              />
            </label>
          ))}
        </div>
      </Section>

      <Section title="核心财务指标">
        <div className="mb-1 grid grid-cols-[7rem_1fr_1fr] gap-2 text-[11px] text-slate-400">
          <span>指标</span>
          <span>数值</span>
          <span>变动</span>
        </div>
        <div className="space-y-2">
          <MetricInputs
            label="营业收入"
            pair={fields.revenue}
            readOnly={readOnly}
            onChange={(revenue) => patch({ revenue })}
          />
          <MetricInputs
            label="归母净利润"
            pair={fields.net_profit}
            readOnly={readOnly}
            onChange={(net_profit) => patch({ net_profit })}
          />
          <MetricInputs
            label="加权平均 ROE"
            pair={fields.roe}
            readOnly={readOnly}
            onChange={(roe) => patch({ roe })}
          />
        </div>
      </Section>

      <Section title="资产负债">
        <div className="space-y-2">
          <MetricInputs
            label="总资产"
            pair={fields.total_assets}
            readOnly={readOnly}
            onChange={(total_assets) => patch({ total_assets })}
          />
          <MetricInputs
            label="归母净资产"
            pair={fields.net_assets}
            readOnly={readOnly}
            onChange={(net_assets) => patch({ net_assets })}
          />
        </div>
      </Section>

      <Section title="业务板块表现">
        <div className="mb-1 grid grid-cols-[1fr_1fr_1fr_2rem] gap-2 text-[11px] text-slate-400">
          <span>业务</span>
          <span>收入/规模</span>
          <span>增速</span>
          <span />
        </div>
        <div className="space-y-2">
          {fields.business_segments.map((seg, index) => (
            <div key={index} className="grid grid-cols-[1fr_1fr_1fr_2rem] items-center gap-2">
              <input
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm disabled:bg-slate-50"
                value={seg.name}
                disabled={readOnly}
                onChange={(e) => updateSegment(index, { ...seg, name: e.target.value })}
              />
              <input
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm disabled:bg-slate-50"
                value={seg.value}
                disabled={readOnly}
                onChange={(e) => updateSegment(index, { ...seg, value: e.target.value })}
              />
              <input
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm disabled:bg-slate-50"
                value={seg.growth}
                disabled={readOnly}
                onChange={(e) => updateSegment(index, { ...seg, growth: e.target.value })}
              />
              {!readOnly && (
                <button
                  type="button"
                  aria-label="删除行"
                  onClick={() => removeSegment(index)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={addSegment}
            className="mt-2 inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:border-teal-400 hover:text-teal-700"
          >
            <Plus className="h-3.5 w-3.5" />
            添加业务板块
          </button>
        )}
      </Section>

      <Section title="盈利预测（百万元）">
        <div className="mb-1 grid grid-cols-3 gap-2 text-[11px] text-slate-400">
          <span>年份</span>
          <span>营业收入</span>
          <span>净利润</span>
        </div>
        <div className="space-y-2">
          {fields.profit_forecast.map((row, index) => (
            <div key={index} className="grid grid-cols-3 gap-2">
              <input
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm disabled:bg-slate-50"
                value={row.year}
                disabled={readOnly}
                onChange={(e) => updateForecast(index, { ...row, year: e.target.value })}
              />
              <input
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm disabled:bg-slate-50"
                value={row.revenue}
                disabled={readOnly}
                onChange={(e) => updateForecast(index, { ...row, revenue: e.target.value })}
              />
              <input
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm disabled:bg-slate-50"
                value={row.net_profit}
                disabled={readOnly}
                onChange={(e) => updateForecast(index, { ...row, net_profit: e.target.value })}
              />
            </div>
          ))}
        </div>
      </Section>

      <Section title="观点与风险">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-600">核心观点</span>
          <textarea
            className="min-h-[72px] w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm disabled:bg-slate-50"
            value={fields.core_view}
            disabled={readOnly}
            onChange={(e) => patch({ core_view: e.target.value })}
          />
        </label>
        <label className="mt-3 block space-y-1">
          <span className="text-xs font-medium text-slate-600">风险提示</span>
          <textarea
            className="min-h-[72px] w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm disabled:bg-slate-50"
            value={fields.risks}
            disabled={readOnly}
            onChange={(e) => patch({ risks: e.target.value })}
          />
        </label>
      </Section>
    </div>
  );
}
