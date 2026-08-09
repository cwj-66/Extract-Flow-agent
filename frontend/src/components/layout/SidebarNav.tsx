import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  UploadCloud,
  List,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
  Users,
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/upload', label: '上传研报', icon: UploadCloud },
  { to: '/tasks', label: '任务列表', icon: List },
  { to: '/config/groups', label: '飞书通知', icon: Users },
  { to: '/settings', label: '设置', icon: Settings },
];

function isNavActive(pathname: string, to: string): boolean {
  if (to === '/tasks') {
    return (
      pathname === '/tasks' ||
      pathname.startsWith('/tasks/') ||
      pathname.startsWith('/batches/')
    );
  }
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function SidebarNav() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <aside
      className={`relative flex flex-col border-r border-stone-200/80 transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
      style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)' }}
    >
      <div className="flex h-14 items-center gap-2.5 border-b border-stone-200/80 px-4">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 to-teal-500 shadow-sm">
          <Zap className="h-4 w-4 text-white" />
        </div>
        {!collapsed && (
          <div>
            <span className="truncate text-sm font-semibold text-slate-900">萃报</span>
            <span className="ml-1.5 inline-flex items-center rounded-full bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700 border border-teal-100">
              AI
            </span>
          </div>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 p-2" aria-label="主导航">
        {!collapsed && (
          <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-stone-400">
            工作台
          </p>
        )}
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
          const isActive = isNavActive(location.pathname, to);
          return (
            <NavLink
              key={to}
              to={to}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-teal-50 text-teal-700 shadow-sm border border-teal-100'
                  : 'text-slate-600 hover:bg-stone-100/80 hover:text-slate-900'
              }`}
            >
              <Icon
                className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-teal-600' : 'text-slate-400'}`}
              />
              {!collapsed && <span className="truncate">{label}</span>}
              {!collapsed && isActive && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-teal-500" aria-hidden="true" />
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-stone-200/80 p-3">
        <div className="flex items-center gap-2.5 rounded-xl bg-stone-50 px-3 py-2">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-teal-400 text-xs font-bold text-white shadow-sm">
            萃
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-slate-700">萃报</p>
              <p className="truncate text-[10px] text-slate-400">研报摘要工作台</p>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? '展开侧栏' : '折叠侧栏'}
        className="absolute -right-3 top-16 flex h-6 w-6 items-center justify-center rounded-full border border-stone-200 bg-white text-slate-400 shadow-sm hover:bg-teal-50 hover:text-teal-600 transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </button>
    </aside>
  );
}
