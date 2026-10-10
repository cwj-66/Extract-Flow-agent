import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { NavigationGuard } from './NavigationGuard';
import { SidebarNav } from './SidebarNav';
import { TopBar } from './TopBar';
import { WorkspaceProvider } from './workspace';

function AppShell() {
  const location = useLocation();
  const isWorkbench = /^\/tasks\/[^/]+$/.test(location.pathname);
  const [navOpen, setNavOpen] = useState(false);
  const closeNav = useCallback(() => setNavOpen(false), []);
  useEffect(() => {
    closeNav();
  }, [location.pathname, closeNav]);

  return (
    <div className="flex h-screen overflow-hidden bg-sidebar">
      <NavigationGuard />
      <SidebarNav open={navOpen} onClose={closeNav} />
      {navOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          aria-label="关闭导航"
          onClick={closeNav}
        />
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col bg-canvas">
        {isWorkbench ? null : <TopBar onOpenNav={() => setNavOpen(true)} />}
        <main
          className={
            isWorkbench ? 'min-h-0 flex-1 overflow-hidden bg-surface' : 'min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-6'
          }
        >
          {isWorkbench ? (
            <Outlet />
          ) : (
            <div className="mx-auto max-w-7xl">
              <Outlet />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

/** 壳层版式参考 ai-document-processing-automation（MIT）。配色与接口为本项目。 */
export function AppLayout() {
  return (
    <WorkspaceProvider>
      <AppShell />
    </WorkspaceProvider>
  );
}
