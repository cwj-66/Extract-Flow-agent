const STAGES = [
  { title: 'PDF 接入', hint: '单份 / 批量' },
  { title: 'MinerU 解析', hint: '版面本地识别' },
  { title: '多模态分解', hint: '表 / 图分路' },
  { title: 'Schema 提取', hint: 'DashScope JSON' },
  { title: '人工确认', hint: '出处可回溯' },
  { title: '飞书 Card', hint: 'Webhook 推送' },
];

interface PipelineStripProps {
  compact?: boolean;
}

export function PipelineStrip({ compact = false }: PipelineStripProps) {
  if (compact) {
    return (
      <ol className="space-y-1" aria-label="处理管线">
        {STAGES.map((stage, index) => (
          <li key={stage.title} className="flex items-start gap-2.5 py-1">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[10px] font-semibold tabular-nums text-brand">
              {index + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink">{stage.title}</span>
              <span className="block text-xs text-subtle">{stage.hint}</span>
            </span>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6" aria-label="处理管线">
      {STAGES.map((stage, index) => (
        <li key={stage.title} className="relative min-w-0">
          <div className="rounded-xl bg-canvas/80 px-3 py-3">
            <p className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-[11px] font-semibold text-white">
              {index + 1}
            </p>
            <p className="mt-2.5 truncate text-sm font-medium text-ink">{stage.title}</p>
            <p className="mt-0.5 truncate text-xs text-subtle">{stage.hint}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
