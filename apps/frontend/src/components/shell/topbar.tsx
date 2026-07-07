'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, LogOut, Menu, Moon, Search, Sun, User } from 'lucide-react';
import { useTheme } from 'next-themes';
import { formatDistanceToNow } from 'date-fns';
import { get, post } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { useUiStore } from '@/stores/ui-store';
import { useLogout } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/overlays';
import { EmptyState } from '@/components/ui/empty-state';
import { ScrollArea } from '@/components/ui/misc';
import { getSocket } from '@/lib/socket';
import { SOCKET_EVENTS } from '@taskforge/shared-types';

interface NotificationRow {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

function NotificationsBell() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => get<{ notifications: NotificationRow[]; unreadCount: number }>('/notifications', { limit: 15 }),
    refetchInterval: 60_000,
  });

  // Live updates: any new notification refreshes the bell.
  useEffect(() => {
    const socket = getSocket();
    const onNew = () => void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    socket.on(SOCKET_EVENTS.NOTIFICATION_NEW, onNew);
    return () => {
      socket.off(SOCKET_EVENTS.NOTIFICATION_NEW, onNew);
    };
  }, [queryClient]);

  const unread = data?.unreadCount ?? 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <span className="text-sm font-semibold">Notifications</span>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await post('/notifications/read-all');
                void queryClient.invalidateQueries({ queryKey: ['notifications'] });
              }}
            >
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-96">
          {data?.notifications.length ? (
            <div className="divide-y">
              {data.notifications.map((n) => (
                <button
                  key={n.id}
                  className="flex w-full flex-col gap-0.5 px-4 py-3 text-left transition-colors hover:bg-accent"
                  onClick={async () => {
                    if (!n.isRead) {
                      await post(`/notifications/${n.id}/read`);
                      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
                    }
                    if (n.link) router.push(n.link.replace(/^https?:\/\/[^/]+/, ''));
                  }}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {!n.isRead && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                    {n.title}
                  </span>
                  {n.body && <span className="line-clamp-2 text-xs text-muted-foreground">{n.body}</span>}
                  <span className="text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState icon={Bell} title="All caught up" description="No notifications yet." className="py-10" />
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export function Topbar({ title }: { title?: string }) {
  const user = useAuthStore((s) => s.user);
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const setMobileSidebarOpen = useUiStore((s) => s.setMobileSidebarOpen);
  const { resolvedTheme, setTheme } = useTheme();
  const logout = useLogout();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b bg-background px-4">
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="-ml-1 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        {title ? <h1 className="truncate text-sm font-semibold">{title}</h1> : null}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setCommandOpen(true)}
          className="hidden h-8 w-64 items-center gap-2 rounded-md border bg-muted/50 px-3 text-sm text-muted-foreground transition-colors hover:bg-accent md:flex"
        >
          <Search className="h-3.5 w-3.5" />
          Search…
          <Badge variant="outline" className="ml-auto rounded px-1.5 font-mono text-[10px]">
            Ctrl K
          </Badge>
        </button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
        >
          <Sun className="h-4 w-4 dark:hidden" />
          <Moon className="hidden h-4 w-4 dark:block" />
        </Button>

        <NotificationsBell />

        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger className="outline-none">
              <UserAvatar user={user} className="h-8 w-8 ring-2 ring-transparent transition-shadow hover:ring-primary/40" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs font-normal text-muted-foreground">{user.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>
                <User /> Profile (in settings)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => logout.mutate()}>
                <LogOut /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
