import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  UploadCloud,
  ListTodo,
  Settings,
  PanelLeft,
  MessageSquare,
  Boxes,
  ShieldCheck,
} from 'lucide-react';
import { useWorkspace } from './useWorkspace';

const NAV_GROUPS = [
  {
    label: '工作台',
    items: [
      { to: '/', label: '总览', icon: LayoutDashboard, end: true },
      { to: '/upload', label: '上传研报', icon: UploadCloud, end: false },
      { to: '/pipeline', label: '处理流水线', icon: Boxes, end: true },
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

interface SidebarNavProps {
  open: boolean;
  onClose: () => void;
}

export function SidebarNav({ open, onClose }: SidebarNavProps) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { pendingCount } = useWorkspace();

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-fg transition-transform duration-200 md:static md:translate-x-0 ${
        collapsed ? 'md:w-[68px]' : 'md:w-64'
      } ${open ? 'translate-x-0' : '-translate-x-full'}`}
    >
      <div className={`flex h-16 items-center gap-2.5 px-4 ${collapsed ? 'md:justify-center md:px-2' : ''}`}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-[13px] font-bold text-white">
          萃
        </div>
        <div className={`min-w-0 leading-tight ${collapsed ? 'md:hidden' : ''}`}>
          <p className="truncate text-[15px] font-semibold tracking-tight">萃报</p>
          <p className="truncate text-[11px] text-sidebar-muted">研报摘要工作台</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-2 pb-3" aria-label="主导航">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className={`px-2.5 pb-1.5 text-[11px] font-medium tracking-wide text-sidebar-muted ${collapsed ? 'md:sr-only' : ''}`}>
              {group.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {group.items.map(({ to, label, icon: Icon, end }) => {
                const isActive = isNavActive(location.pathname, to, end);
                const showBadge = to === '/tasks' && pendingCount > 0;
                return (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    aria-label={showBadge ? `${label}，${pendingCount} 条待确认` : label}
                    aria-current={isActive ? 'page' : undefined}
                    title={collapsed ? label : undefined}
                    onClick={onClose}
                    className={`relative flex items-center rounded-md py-2 text-[13px] font-medium transition-colors ${
                      collapsed ? 'gap-2.5 px-2.5 md:justify-center md:px-0' : 'gap-2.5 px-2.5'
                    } ${
                      isActive
                        ? 'bg-sidebar-active text-white'
                        : 'text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-fg'
                    }`}
                  >
                    {isActive ? (
                      <span className="absolute left-0 h-4 w-0.5 rounded-r bg-brand" aria-hidden="true" />
                    ) : null}
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className={`truncate ${collapsed ? 'md:sr-only' : ''}`}>{label}</span>
                    {showBadge ? (
                      <span
                        className={`ml-auto grid h-5 min-w-5 place-items-center rounded-md bg-brand px-1 text-[10px] font-semibold text-white ${
                          collapsed ? 'md:absolute md:right-1.5 md:top-1.5 md:ml-0 md:h-1.5 md:min-w-0 md:bg-brand md:p-0 md:text-transparent' : ''
                        }`}
                      >
                        {pendingCount > 99 ? '99+' : pendingCount}
                      </span>
                    ) : null}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className={`mx-2 mb-2 rounded-lg border border-white/10 px-3 py-2.5 ${collapsed ? 'md:hidden' : ''}`}>
        <div className="flex items-start gap-2 text-sidebar-fg">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
          <div>
            <p className="text-[11px] font-medium">人工确认后才发送</p>
            <p className="mt-1 text-[10px] leading-relaxed text-sidebar-muted">飞书卡片不会在提取完成时自动推送。</p>
          </div>
        </div>
      </div>

      <div className={`hidden border-t border-white/10 p-2 md:flex ${collapsed ? 'md:justify-center' : ''}`}>
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
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
