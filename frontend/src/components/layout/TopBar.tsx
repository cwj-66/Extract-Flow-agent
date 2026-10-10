import { useLocation } from 'react-router-dom';
import { Loader2, Menu, Sparkles } from 'lucide-react';
import { useWorkspace } from './useWorkspace';

const PAGE_META: { test: (path: string) => boolean; title: string; subtitle: string }[] = [
  { test: (path) => path === '/', title: '总览', subtitle: '待确认、处理进度和最近任务。' },
  { test: (path) => path === '/upload', title: '上传研报', subtitle: '拖入 PDF，自动解析并提取，确认后再发送。' },
  { test: (path) => path === '/pipeline', title: '处理流水线', subtitle: '每份研报从排队到发送的阶段。' },
  { test: (path) => path === '/tasks', title: '任务队列', subtitle: '按公司、文件名或状态查找，审阅后再发飞书。' },
  { test: (path) => path.startsWith('/batches/'), title: '批次进度', subtitle: '同一批上传的文件处理到哪一步。' },
  { test: (path) => path === '/config/groups', title: '飞书通知', subtitle: '确认发送后，卡片推送到这些群。' },
  { test: (path) => path === '/settings', title: '设置', subtitle: '本机偏好与版本信息。' },
];

interface TopBarProps {
  onOpenNav: () => void;
}

export function TopBar({ onOpenNav }: TopBarProps) {
  const location = useLocation();
  const { health, seeding, loadSamples } = useWorkspace();
  const meta = PAGE_META.find((item) => item.test(location.pathname)) ?? {
    title: '萃报',
    subtitle: '研报摘要工作台',
  };
  const online = health?.status === 'ok' || health?.status === 'degraded';

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line bg-surface px-4 md:px-6">
      <button
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink hover:bg-canvas md:hidden"
        onClick={onOpenNav}
        aria-label="打开导航"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>
      <div className="min-w-0">
        <h1 className="truncate text-[15px] font-semibold tracking-tight text-ink">{meta.title}</h1>
        <p className="truncate text-xs text-muted">{meta.subtitle}</p>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <p
          className="hidden items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs font-medium text-muted sm:inline-flex"
          title={health ? `队列：${health.queue === 'celery' ? 'Celery' : '进程内'}` : '无法连接 API'}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              health == null ? 'bg-subtle' : online ? 'bg-emerald-500' : 'bg-red-500'
            }`}
            aria-hidden="true"
          />
          {health == null ? 'API 未检测' : online ? 'API 在线' : 'API 离线'}
        </p>
        <button
          type="button"
          className="ef-btn ef-btn-primary"
          onClick={() => void loadSamples()}
          disabled={seeding}
        >
          {seeding ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          )}
          载入样例
        </button>
      </div>
    </header>
  );
}
