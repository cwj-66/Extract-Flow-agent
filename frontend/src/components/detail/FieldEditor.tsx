import type { ReactNode } from 'react';
import { Plus, Trash2, MapPin } from 'lucide-react';
import type {
  BusinessSegment,
  ExtractionFields,
  FieldEvidence,
  MetricPair,
  ProfitForecastRow,
} from '../../types';
import { FIELD_LABELS, hasSource, sameValue } from '../../lib/fields';

interface FieldEditorProps {
  fields: ExtractionFields;
  originalFields: ExtractionFields;
  readOnly?: boolean;
  onChange: (fields: ExtractionFields) => void;
  onSave: (fields: ExtractionFields) => void;
  onDiscard: () => void;
  dirty: boolean;
  selectedField?: string | null;
  onSelectField?: (field: string) => void;
  evidenceByField?: Record<string, FieldEvidence>;
}

function DiffBadge({ changed }: { changed: boolean }) {
  if (!changed) return null;
  return (
    <span className="rounded bg-amber-100 px-1 py-px text-[10px] font-medium text-amber-700">
      已改
    </span>
  );
}

function LocateButton({
  field,
  evidence,
  onSelect,
}: {
  field: string;
  evidence?: FieldEvidence;
  onSelect?: (field: string) => void;
}) {
  const ok = hasSource(evidence);
  return (
    <button
      type="button"
      onClick={() => onSelect?.(field)}
      disabled={!ok}
      title={ok ? '在原文中高亮出处' : '未找到原文出处'}
      aria-label={`${FIELD_LABELS[field] ?? field} 定位原文`}
      className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[11px] text-[#3370FF] hover:bg-[#E8F0FF] disabled:cursor-not-allowed disabled:text-slate-300"
    >
      <MapPin className="h-3 w-3" aria-hidden="true" />
      原文
    </button>
  );
}

function FieldHead({
  field,
  changed,
  selected,
  evidence,
  onSelect,
}: {
  field: string;
  changed: boolean;
  selected: boolean;
  evidence?: FieldEvidence;
  onSelect?: (field: string) => void;
}) {
  return (
    <div className="mb-1 flex items-center gap-1.5">
      <span className={`text-xs font-medium ${selected ? 'text-[#3370FF]' : 'text-slate-600'}`}>
        {FIELD_LABELS[field] ?? field}
      </span>
      <DiffBadge changed={changed} />
      <LocateButton field={field} evidence={evidence} onSelect={onSelect} />
    </div>
  );
}

function MetricInputs({
  field,
  pair,
  original,
  readOnly,
  selected,
  evidence,
  onSelect,
  onChange,
}: {
  field: keyof ExtractionFields;
  pair: MetricPair;
  original: MetricPair;
  readOnly?: boolean;
  selected: boolean;
  evidence?: FieldEvidence;
  onSelect?: (field: string) => void;
  onChange: (pair: MetricPair) => void;
}) {
  return (
    <div className={`rounded-md px-1 py-1 ${selected ? 'bg-[#E8F0FF]/60' : ''}`}>
      <FieldHead
        field={field}
        changed={!sameValue(pair, original)}
        selected={selected}
        evidence={evidence}
        onSelect={onSelect}
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          className="rounded-md border border-[#DEE0E3] px-2.5 py-1.5 text-sm disabled:bg-slate-50"
          value={pair.value}
          disabled={readOnly}
          placeholder="数值"
          onFocus={() => onSelect?.(field)}
          onChange={(e) => onChange({ ...pair, value: e.target.value })}
        />
        <input
          className="rounded-md border border-[#DEE0E3] px-2.5 py-1.5 text-sm disabled:bg-slate-50"
          value={pair.change}
          disabled={readOnly}
          placeholder="变动"
          onFocus={() => onSelect?.(field)}
          onChange={(e) => onChange({ ...pair, change: e.target.value })}
        />
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2 rounded-lg border border-[#DEE0E3] bg-white p-3">
      <h3 className="text-sm font-semibold text-[#1F2329]">{title}</h3>
      {children}
    </section>
  );
}

export function FieldEditor({
  fields,
  originalFields,
  readOnly,
  onChange,
  onSave,
  onDiscard,
  dirty,
  selectedField,
  onSelectField,
  evidenceByField = {},
}: FieldEditorProps) {
  const patch = (partial: Partial<ExtractionFields>) => onChange({ ...fields, ...partial });

  const updateSegment = (index: number, row: BusinessSegment) => {
    patch({
      business_segments: fields.business_segments.map((s, i) => (i === index ? row : s)),
    });
  };

  const addSegment = () => {
    patch({
      business_segments: [...fields.business_segments, { name: '', value: '', growth: '' }],
    });
  };

  const removeSegment = (index: number) => {
    patch({
      business_segments: fields.business_segments.filter((_, i) => i !== index),
    });
  };

  const updateForecast = (index: number, row: ProfitForecastRow) => {
    patch({
      profit_forecast: fields.profit_forecast.map((r, i) => (i === index ? row : r)),
    });
  };

  const inputClass = 'w-full rounded-md border border-[#DEE0E3] px-2.5 py-1.5 text-sm disabled:bg-slate-50';

  return (
    <div className="space-y-3">
      {!readOnly && dirty && (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onDiscard}
            className="rounded-md border border-[#DEE0E3] px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
          >
            放弃修改
          </button>
          <button
            type="button"
            onClick={() => onSave(fields)}
            className="rounded-md bg-[#3370FF] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#245BDB]"
          >
            保存修改
          </button>
        </div>
      )}

      <Section title="基础信息">
        <div className="grid gap-3 sm:grid-cols-2">
          {(['company_name', 'stock_code', 'report_period', 'rating'] as const).map((key) => (
            <label key={key} className={`block rounded-md px-1 py-1 ${selectedField === key ? 'bg-[#E8F0FF]/60' : ''}`}>
              <FieldHead
                field={key}
                changed={!sameValue(fields[key], originalFields[key])}
                selected={selectedField === key}
                evidence={evidenceByField[key]}
                onSelect={onSelectField}
              />
              <input
                className={inputClass}
                value={fields[key]}
                disabled={readOnly}
                onFocus={() => onSelectField?.(key)}
                onChange={(e) => patch({ [key]: e.target.value })}
              />
            </label>
          ))}
        </div>
      </Section>

      <Section title="核心财务指标">
        <div className="space-y-2">
          <MetricInputs
            field="revenue"
            pair={fields.revenue}
            original={originalFields.revenue}
            readOnly={readOnly}
            selected={selectedField === 'revenue'}
            evidence={evidenceByField.revenue}
            onSelect={onSelectField}
            onChange={(revenue) => patch({ revenue })}
          />
          <MetricInputs
            field="net_profit"
            pair={fields.net_profit}
            original={originalFields.net_profit}
            readOnly={readOnly}
            selected={selectedField === 'net_profit'}
            evidence={evidenceByField.net_profit}
            onSelect={onSelectField}
            onChange={(net_profit) => patch({ net_profit })}
          />
          <MetricInputs
            field="roe"
            pair={fields.roe}
            original={originalFields.roe}
            readOnly={readOnly}
            selected={selectedField === 'roe'}
            evidence={evidenceByField.roe}
            onSelect={onSelectField}
            onChange={(roe) => patch({ roe })}
          />
        </div>
      </Section>

      <Section title="资产负债">
        <div className="space-y-2">
          <MetricInputs
            field="total_assets"
            pair={fields.total_assets}
            original={originalFields.total_assets}
            readOnly={readOnly}
            selected={selectedField === 'total_assets'}
            evidence={evidenceByField.total_assets}
            onSelect={onSelectField}
            onChange={(total_assets) => patch({ total_assets })}
          />
          <MetricInputs
            field="net_assets"
            pair={fields.net_assets}
            original={originalFields.net_assets}
            readOnly={readOnly}
            selected={selectedField === 'net_assets'}
            evidence={evidenceByField.net_assets}
            onSelect={onSelectField}
            onChange={(net_assets) => patch({ net_assets })}
          />
        </div>
      </Section>

      <Section title="业务板块表现">
        <div className="mb-1 flex items-center gap-1.5">
          <DiffBadge changed={!sameValue(fields.business_segments, originalFields.business_segments)} />
        </div>
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
                className="rounded-md border border-[#DEE0E3] px-2.5 py-1.5 text-sm disabled:bg-slate-50"
                value={seg.name}
                disabled={readOnly}
                onChange={(e) => updateSegment(index, { ...seg, name: e.target.value })}
              />
              <input
                className="rounded-md border border-[#DEE0E3] px-2.5 py-1.5 text-sm disabled:bg-slate-50"
                value={seg.value}
                disabled={readOnly}
                onChange={(e) => updateSegment(index, { ...seg, value: e.target.value })}
              />
              <input
                className="rounded-md border border-[#DEE0E3] px-2.5 py-1.5 text-sm disabled:bg-slate-50"
                value={seg.growth}
                disabled={readOnly}
                onChange={(e) => updateSegment(index, { ...seg, growth: e.target.value })}
              />
              {!readOnly && (
                <button
                  type="button"
                  aria-label="删除行"
                  onClick={() => removeSegment(index)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600"
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
            className="mt-2 inline-flex items-center gap-1 rounded-md border border-dashed border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:border-[#3370FF] hover:text-[#3370FF]"
          >
            <Plus className="h-3.5 w-3.5" />
            添加业务板块
          </button>
        )}
      </Section>

      <Section title="盈利预测（百万元）">
        <DiffBadge changed={!sameValue(fields.profit_forecast, originalFields.profit_forecast)} />
        <div className="mb-1 grid grid-cols-3 gap-2 text-[11px] text-slate-400">
          <span>年份</span>
          <span>营业收入</span>
          <span>净利润</span>
        </div>
        <div className="space-y-2">
          {fields.profit_forecast.map((row, index) => (
            <div key={index} className="grid grid-cols-3 gap-2">
              <input
                className="rounded-md border border-[#DEE0E3] px-2.5 py-1.5 text-sm disabled:bg-slate-50"
                value={row.year}
                disabled={readOnly}
                onChange={(e) => updateForecast(index, { ...row, year: e.target.value })}
              />
              <input
                className="rounded-md border border-[#DEE0E3] px-2.5 py-1.5 text-sm disabled:bg-slate-50"
                value={row.revenue}
                disabled={readOnly}
                onChange={(e) => updateForecast(index, { ...row, revenue: e.target.value })}
              />
              <input
                className="rounded-md border border-[#DEE0E3] px-2.5 py-1.5 text-sm disabled:bg-slate-50"
                value={row.net_profit}
                disabled={readOnly}
                onChange={(e) => updateForecast(index, { ...row, net_profit: e.target.value })}
              />
            </div>
          ))}
        </div>
      </Section>

      <Section title="观点与风险">
        <label className={`block rounded-md px-1 ${selectedField === 'core_view' ? 'bg-[#E8F0FF]/60' : ''}`}>
          <FieldHead
            field="core_view"
            changed={!sameValue(fields.core_view, originalFields.core_view)}
            selected={selectedField === 'core_view'}
            evidence={evidenceByField.core_view}
            onSelect={onSelectField}
          />
          <textarea
            className={`min-h-[72px] ${inputClass}`}
            value={fields.core_view}
            disabled={readOnly}
            onFocus={() => onSelectField?.('core_view')}
            onChange={(e) => patch({ core_view: e.target.value })}
          />
        </label>
        <label className={`mt-3 block rounded-md px-1 ${selectedField === 'risks' ? 'bg-[#E8F0FF]/60' : ''}`}>
          <FieldHead
            field="risks"
            changed={!sameValue(fields.risks, originalFields.risks)}
            selected={selectedField === 'risks'}
            evidence={evidenceByField.risks}
            onSelect={onSelectField}
          />
          <textarea
            className={`min-h-[72px] ${inputClass}`}
            value={fields.risks}
            disabled={readOnly}
            onFocus={() => onSelectField?.('risks')}
            onChange={(e) => patch({ risks: e.target.value })}
          />
        </label>
      </Section>
    </div>
  );
}
