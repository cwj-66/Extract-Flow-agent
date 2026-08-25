export type TaskStatus =
  | 'queued'
  | 'parsing'
  | 'extracting'
  | 'pending_confirm'
  | 'sending'
  | 'sent'
  | 'failed';

export interface MetricPair {
  value: string;
  change: string;
}

export interface BusinessSegment {
  name: string;
  value: string;
  growth: string;
}

export interface ProfitForecastRow {
  year: string;
  revenue: string;
  net_profit: string;
}

/** 固定研报提取结果（与后端 ExtractionResult 对齐） */
export interface ExtractionFields {
  company_name: string;
  stock_code: string;
  report_period: string;
  rating: string;
  revenue: MetricPair;
  net_profit: MetricPair;
  roe: MetricPair;
  total_assets: MetricPair;
  net_assets: MetricPair;
  business_segments: BusinessSegment[];
  profit_forecast: ProfitForecastRow[];
  core_view: string;
  risks: string;
}

export interface TaskSummary {
  id: string;
  status: TaskStatus;
  source_file: string;
  document_type: string;
  batch_id: string | null;
  relative_path: string | null;
  company_name: string | null;
  stock_code: string | null;
  created_at: string;
  updated_at: string;
  error_message: string | null;
}

export interface TaskListResponse {
  items: TaskSummary[];
  total: number;
}

export interface UploadResponse {
  task_id: string;
  poll_url: string;
  message: string;
}

export interface RejectedUpload {
  filename: string;
  reason: string;
}

export interface BatchUploadResponse {
  batch_id: string;
  task_ids: string[];
  poll_url: string;
  total: number;
  accepted: number;
  rejected: RejectedUpload[];
  message: string;
}

export interface BatchStatusCounts {
  queued: number;
  parsing: number;
  extracting: number;
  pending_confirm: number;
  sending: number;
  sent: number;
  failed: number;
}

export interface BatchResponse {
  batch_id: string;
  name: string;
  total: number;
  created_at: string;
  counts: BatchStatusCounts;
  tasks: TaskSummary[];
}

export interface FieldEvidence {
  field: string;
  quote: string;
  start: number;
  end: number;
  confidence: number;
}

export interface ExtractionMetrics {
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  elapsed_ms: number;
  estimated_cny: number;
  retries: number;
}

export interface TaskResultResponse {
  task_id: string;
  status: TaskStatus;
  source_file: string;
  fields: ExtractionFields;
  evidence: FieldEvidence[];
  metrics: ExtractionMetrics | null;
  extracted_at: string | null;
}

export interface TaskConfirmRequest {
  fields?: ExtractionFields | null;
  group_id?: string | null;
}

export interface TaskConfirmResponse {
  task_id: string;
  status: TaskStatus;
  message: string;
}

export interface TaskContentResponse {
  task_id: string;
  source_file: string;
  content: string;
  char_count: number;
}

export interface GroupConfig {
  id: string;
  name: string;
  webhook_url: string;
  document_type: string;
  is_default: boolean;
}

export interface GroupsConfig {
  groups: GroupConfig[];
}

export interface GeneralSettings {
  apiBaseUrl: string;
  pollIntervalSec: number;
  /** 本机显示名，请求头 X-User-Id */
  userId: string;
}

export function emptyMetric(): MetricPair {
  return { value: '无', change: '' };
}

export function emptyExtractionFields(): ExtractionFields {
  return {
    company_name: '无',
    stock_code: '无',
    report_period: '无',
    rating: '无',
    revenue: emptyMetric(),
    net_profit: emptyMetric(),
    roe: emptyMetric(),
    total_assets: emptyMetric(),
    net_assets: emptyMetric(),
    business_segments: [],
    profit_forecast: [
      { year: '2026E', revenue: '无', net_profit: '无' },
      { year: '2027E', revenue: '无', net_profit: '无' },
      { year: '2028E', revenue: '无', net_profit: '无' },
    ],
    core_view: '无',
    risks: '无',
  };
}
