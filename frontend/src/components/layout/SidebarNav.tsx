import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  UploadCloud,
  ListTodo,
  Settings,
  PanelLeft,
  MessageSquare,
} from 'lucide-react';

const NAV_GROUPS = [
  {
    label: '工作台',
    items: [
      { to: '/', label: '总览', icon: LayoutDashboard, end: true },
      { to: '/upload', label: '上传研报', icon: UploadCloud, end: false },
      { to: '/tasks', label: '任务队列', icon: ListTodo, end: false },
    ],
  },
  {
    label: '投递',
    items: [{ to: '/config/groups', label: '飞书通知', icon: MessageSquare, end: false }],
  },
  {
    label: '系统',
    items: [{ to: '/settings', label: '设置', icon: Settings, end: false }],
  },
];

function isNavActive(pathname: string, to: string, end: boolean): boolean {
  if (to === '/') return pathname === '/';
  if (to === '/tasks') {
    return (
      pathname === '/tasks' ||
      pathname.startsWith('/tasks/') ||
      pathname.startsWith('/batches/')
    );
  }
  if (end) return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function SidebarNav() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <aside
      className={`flex flex-col bg-sidebar text-sidebar-fg transition-[width] duration-200 ${
        collapsed ? 'w-[68px]' : 'w-56'
      }`}
    >
      <div className={`flex h-14 items-center ${collapsed ? 'justify-center px-2' : 'gap-2.5 px-4'}`}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-[13px] font-bold text-white">
          萃
        </div>
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[15px] font-semibold tracking-tight">萃报</p>
            <p className="truncate text-[11px] text-sidebar-muted">研报摘要工作台</p>
          </div>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-2 pb-3 pt-1" aria-label="主导航">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="px-2.5 pb-1.5 text-[11px] font-medium tracking-wide text-sidebar-muted">
                {group.label}
              </p>
            )}
            <div className="flex flex-col gap-0.5">
              {group.items.map(({ to, label, icon: Icon, end }) => {
                const isActive = isNavActive(location.pathname, to, end);
                return (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    aria-label={label}
                    aria-current={isActive ? 'page' : undefined}
                    title={collapsed ? label : undefined}
                    className={`flex items-center rounded-md py-2 text-[13px] font-medium transition-colors ${
                      collapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5'
                    } ${
                      isActive
                        ? 'bg-sidebar-active text-white'
                        : 'text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-fg'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {!collapsed && <span className="truncate">{label}</span>}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className={`border-t border-white/10 p-2 ${collapsed ? 'flex justify-center' : ''}`}>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? '展开侧栏' : '折叠侧栏'}
          className={`flex items-center rounded-md py-2 text-[13px] text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-fg ${
            collapsed ? 'justify-center px-2' : 'w-full gap-2.5 px-2.5'
          }`}
        >
          <PanelLeft className={`h-4 w-4 ${collapsed ? 'rotate-180' : ''}`} aria-hidden="true" />
          {!collapsed && <span>折叠侧栏</span>}
        </button>
      </div>
    </aside>
  );
}
