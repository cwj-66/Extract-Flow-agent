import { Outlet, useLocation } from 'react-router-dom';
import { SidebarNav } from './SidebarNav';
import { NavigationGuard } from './NavigationGuard';

const PAGE_TITLES: Record<string, string> = {
  '/config/groups': '飞书通知',
  '/upload': '上传研报',
  '/batches': '批次进度',
  '/tasks': '任务列表',
  '/settings': '设置',
};

export function AppLayout() {
  const location = useLocation();
  const pathKey = '/' + location.pathname.split('/')[1];
  const title = location.pathname.startsWith('/tasks/')
    ? '任务详情'
    : location.pathname.startsWith('/batches/')
      ? '批次进度'
      : PAGE_TITLES[pathKey] ?? '萃报';

  return (
    <div className="flex h-screen overflow-hidden">
      <NavigationGuard />
      <SidebarNav />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-stone-200/80 px-6"
          style={{ background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)' }}
        >
          <div className="flex items-center gap-3">
            <div className="h-4 w-0.5 rounded-full bg-teal-400" aria-hidden="true" />
            <h1 className="text-sm font-semibold text-slate-800">{title}</h1>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
