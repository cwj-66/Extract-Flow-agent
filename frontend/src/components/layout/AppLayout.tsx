import { Outlet, useLocation } from 'react-router-dom';
import { SidebarNav } from './SidebarNav';
import { NavigationGuard } from './NavigationGuard';

export function AppLayout() {
  const location = useLocation();
  const isWorkbench = /^\/tasks\/[^/]+$/.test(location.pathname);

  return (
    <div className="flex h-screen overflow-hidden bg-sidebar">
      <NavigationGuard />
      <SidebarNav />
      <div className="flex min-w-0 flex-1 flex-col p-2 pl-0">
        <div
          className={
            isWorkbench
              ? 'flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-surface'
              : 'flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-canvas'
          }
        >
          <main
            className={
              isWorkbench
                ? 'min-h-0 flex-1 overflow-hidden'
                : 'flex-1 overflow-y-auto px-8 py-7'
            }
          >
            {isWorkbench ? <Outlet /> : <div className="mx-auto max-w-6xl"><Outlet /></div>}
          </main>
        </div>
      </div>
    </div>
  );
}
