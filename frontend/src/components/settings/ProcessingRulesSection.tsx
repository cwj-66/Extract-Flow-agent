import { Activity, Database, FileCheck2, ListChecks, ScrollText, Send, ServerCog } from 'lucide-react';
import type { HealthResponse } from '../../api/health';

/** 从健康检查展示运行状态，并说明当前不可编辑的处理规则。 */
export function ProcessingRulesSection({ health }: { health: HealthResponse | null }) {
  const status = health?.status === 'ok' ? '正常' : health?.status === 'degraded' ? '降级' : '未获取状态';
  const queue = health?.queue === 'celery' ? 'Celery' : health?.queue === 'inprocess' ? '进程内队列' : '未获取状态';
  const redis = health?.redis?.ok === true ? '已连接' : health?.redis?.ok === false ? '未连接' : '未获取状态';
  const rows = [
    { icon: Activity, label: '服务健康', description: '来自健康检查的服务状态。', value: status },
    { icon: ServerCog, label: '任务执行模式', description: '当前配置的执行模式，不代表后台工作进程的运行状态。', value: queue },
    { icon: Database, label: 'Redis', description: '来自健康检查的连通性结果。', value: redis },
    { icon: Send, label: '人工确认', description: '人工确认后才发送到飞书。', value: '需确认' },
    { icon: ListChecks, label: '字段校验', description: '只提示字段问题，不阻止发送。', value: '仅提示' },
    { icon: FileCheck2, label: '导出范围', description: '仅导出已发送任务的确认字段快照。', value: '已限制' },
    { icon: ScrollText, label: '操作审计', description: '操作写入审计记录；写入失败不阻断任务。', value: '已接入' },
  ];

  return (
    <section className="ef-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">运行状态与处理规则</h2>
        <span className="ef-chip">只读</span>
      </div>
      <p className="mt-2 text-xs leading-5 text-muted">运行状态来自最近一次健康检查，其余项目为当前处理规则。</p>
      {!health ? <p className="mt-2 text-xs text-muted" role="status">尚未获取健康检查结果，请稍后重新进入本页查看。</p> : null}
      <dl className="mt-4 divide-y divide-line">
        {rows.map(({ icon: Icon, label, description, value }) => (
          <div key={label} className="flex flex-wrap items-start gap-3 py-4 last:pb-0">
            <span className="ef-icon-tile bg-canvas text-muted"><Icon className="h-4 w-4" aria-hidden="true" /></span>
            <div className="min-w-0 flex-1">
              <dt className="text-sm font-medium text-ink">{label}</dt>
              <dd className="mt-1 text-xs leading-5 text-muted">{description}</dd>
            </div>
            <dd className={`ef-chip ${value === '降级' || value === '未连接' ? 'text-warning' : ''}`}>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
