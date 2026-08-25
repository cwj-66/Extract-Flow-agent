import type { ExtractionFields, FieldEvidence } from '../types';

export const FIELD_LABELS: Record<string, string> = {
  company_name: '公司名称',
  stock_code: '证券代码',
  report_period: '报告期',
  rating: '投资评级',
  revenue: '营业收入',
  net_profit: '归母净利润',
  roe: '加权平均 ROE',
  total_assets: '总资产',
  net_assets: '归母净资产',
  business_segments: '业务板块',
  profit_forecast: '盈利预测',
  core_view: '核心观点',
  risks: '风险提示',
};

export function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function changedKeys(
  current: ExtractionFields | undefined,
  original: ExtractionFields | undefined
): Set<string> {
  const keys = new Set<string>();
  if (!current || !original) return keys;
  (Object.keys(current) as (keyof ExtractionFields)[]).forEach((key) => {
    if (!sameValue(current[key], original[key])) keys.add(key);
  });
  return keys;
}

export function evidenceMap(items: FieldEvidence[] | undefined): Record<string, FieldEvidence> {
  const map: Record<string, FieldEvidence> = {};
  for (const item of items ?? []) {
    map[item.field] = item;
  }
  return map;
}

export function hasSource(item: FieldEvidence | undefined): boolean {
  return Boolean(item && item.start >= 0 && item.end > item.start);
}

function needlesFor(field: string, fields: ExtractionFields): string[] {
  const value = fields[field as keyof ExtractionFields];
  if (typeof value === 'string') return [value];
  if (value && typeof value === 'object' && 'value' in value) {
    const pair = value as { value: string; change: string };
    return [pair.value, pair.change];
  }
  return [];
}

export function locateFieldInText(
  markdown: string,
  field: string,
  fields: ExtractionFields
): FieldEvidence | null {
  for (const raw of needlesFor(field, fields)) {
    const needle = raw.trim();
    if (!needle || needle === '无') continue;
    const start = markdown.indexOf(needle);
    if (start >= 0) {
      return { field, quote: needle, start, end: start + needle.length, confidence: 1 };
    }
  }
  return null;
}

export function mergeEvidence(
  items: FieldEvidence[] | undefined,
  markdown: string,
  fields: ExtractionFields | undefined
): Record<string, FieldEvidence> {
  const map = evidenceMap(items);
  if (!fields || !markdown) return map;
  for (const field of Object.keys(FIELD_LABELS)) {
    if (hasSource(map[field])) continue;
    const found = locateFieldInText(markdown, field, fields);
    if (found) map[field] = found;
  }
  return map;
}
