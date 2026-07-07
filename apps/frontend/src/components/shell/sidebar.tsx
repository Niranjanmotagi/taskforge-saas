'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  CalendarDays,
  FolderKanban,
  GanttChartSquare,
  LayoutDashboard,
  ListTodo,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Clock,
  Settings,
  FolderOpen,
} from 'lucide-react';
import { useUiStore } from '@/stores/ui-store';
import { WorkspaceSwitcher } from './workspace-switcher';
import { Hint } from '@/components/ui/overlays';
import { cn } from '@/lib/utils';

const NAV = [
  { label: 'Dashboard', segment: 'dashboard', icon: LayoutDashboard },
  { label: 'Projects', segment: 'projects', icon: FolderKanban },
  { label: 'My Tasks', segment: 'my-tasks', icon: ListTodo },
  { label: 'Calendar', segment: 'calendar', icon: CalendarDays },
  { label: 'Timeline', segment: 'timeline', icon: GanttChartSquare },
  { label: 'Chat', segment: 'chat', icon: MessageSquare },
  { label: 'Files', segment: 'files', icon: FolderOpen },
  { label: 'Time', segment: 'time', icon: Clock },
  { label: 'Reports', segment: 'reports', icon: BarChart3 },
  { label: 'Settings', segment: 'settings', icon: Settings },
];

export function Sidebar({ workspaceId }: { workspaceId: string }) {
  const pathname = usePathname();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const mobileOpen = useUiStore((s) => s.mobileSidebarOpen);
  const setMobileOpen = useUiStore((s) => s.setMobileSidebarOpen);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col border-r bg-sidebar transition-transform duration-200',
          'lg:static lg:z-auto lg:translate-x-0 lg:transition-[width]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          collapsed ? 'lg:w-16' : 'lg:w-60'
        )}
      >
        <div className="p-3">
          <WorkspaceSwitcher workspaceId={workspaceId} collapsed={collapsed} />
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 scrollbar-thin">
          {NAV.map((item) => {
            const href = `/w/${workspaceId}/${item.segment}`;
            const active = pathname.startsWith(href);
            const link = (
              <Link
                key={item.segment}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-sidebar-foreground transition-colors',
                  active ? 'bg-primary/10 text-primary' : 'hover:bg-accent hover:text-foreground',
                  collapsed && 'lg:justify-center lg:px-0'
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {/* Label hides only on desktop-collapsed; always shown in the mobile drawer. */}
                <span className={cn(collapsed && 'lg:hidden')}>{item.label}</span>
              </Link>
            );
            return collapsed ? (
              <Hint key={item.segment} label={item.label} side="right">
                {link}
              </Hint>
            ) : (
              link
            );
          })}
        </nav>

        {/* Desktop collapse toggle (mobile uses the drawer + backdrop instead). */}
        <div className="hidden border-t p-3 lg:block">
          <button
            onClick={toggle}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
              collapsed && 'justify-center px-0'
            )}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!collapsed && 'Collapse'}
          </button>
        </div>
      </aside>
    </>
  );
}
