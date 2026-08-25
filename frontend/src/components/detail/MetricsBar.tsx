import type { ExtractionMetrics } from '../../types';

interface MetricsBarProps {
  metrics: ExtractionMetrics | null | undefined;
}

function formatCny(value: number): string {
  if (value <= 0) return '—';
  if (value < 0.01) return `¥${value.toFixed(4)}`;
  return `¥${value.toFixed(3)}`;
}

export function MetricsBar({ metrics }: MetricsBarProps) {
  if (!metrics) return null;
  const groundedHint =
    metrics.retries > 0 ? `JSON 重试 ${metrics.retries} 次` : metrics.model;

  return (
    <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-subtle">
      <div className="flex items-center gap-1">
        <dt>Token</dt>
        <dd className="font-medium text-ink">
          {metrics.total_tokens.toLocaleString()}
          <span className="ml-1 font-normal text-subtle">
            ({metrics.prompt_tokens.toLocaleString()}+{metrics.completion_tokens.toLocaleString()})
          </span>
        </dd>
      </div>
      <div className="flex items-center gap-1">
        <dt>耗时</dt>
        <dd className="font-medium text-ink">{(metrics.elapsed_ms / 1000).toFixed(1)}s</dd>
      </div>
      <div className="flex items-center gap-1">
        <dt>估算</dt>
        <dd className="font-medium text-ink">{formatCny(metrics.estimated_cny)}</dd>
      </div>
      <div className="flex items-center gap-1">
        <dt className="sr-only">模型</dt>
        <dd>{groundedHint}</dd>
      </div>
    </dl>
  );
}
