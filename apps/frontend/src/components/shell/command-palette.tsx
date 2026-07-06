'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  CalendarDays,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  MessageSquare,
  Settings,
  SquareCheck,
  Users,
} from 'lucide-react';
import { get } from '@/lib/api';
import { useUiStore } from '@/stores/ui-store';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';

interface SearchResults {
  tasks: Array<{ id: string; title: string; key: string; projectId: string }>;
  projects: Array<{ id: string; name: string; key: string }>;
  members: Array<{ id: string; user: { id: string; name: string; email: string } }>;
}

const PAGES = [
  { label: 'Dashboard', segment: 'dashboard', icon: LayoutDashboard },
  { label: 'Projects', segment: 'projects', icon: FolderKanban },
  { label: 'My Tasks', segment: 'my-tasks', icon: ListTodo },
  { label: 'Calendar', segment: 'calendar', icon: CalendarDays },
  { label: 'Chat', segment: 'chat', icon: MessageSquare },
  { label: 'Reports', segment: 'reports', icon: BarChart3 },
  { label: 'Settings', segment: 'settings', icon: Settings },
];

export function CommandPalette({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const open = useUiStore((s) => s.commandOpen);
  const setOpen = useUiStore((s) => s.setCommandOpen);
  const [query, setQuery] = useState('');

  // Global Ctrl/Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setOpen(!open);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, setOpen]);

  const { data: results } = useQuery({
    queryKey: ['global-search', workspaceId, query],
    queryFn: () => get<SearchResults>(`/workspaces/${workspaceId}/search`, { q: query, limit: 5 }),
    enabled: open && query.trim().length >= 2,
    staleTime: 10_000,
  });

  const go = (path: string) => {
    setOpen(false);
    setQuery('');
    router.push(path);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search tasks, projects, people…" value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {results?.tasks?.length ? (
          <CommandGroup heading="Tasks">
            {results.tasks.map((t) => (
              <CommandItem key={t.id} value={`task-${t.key}-${t.title}`} onSelect={() => go(`/w/${workspaceId}/projects/${t.projectId}?task=${t.id}`)}>
                <SquareCheck />
                <span className="font-mono text-xs text-muted-foreground">{t.key}</span>
                <span className="truncate">{t.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {results?.projects?.length ? (
          <CommandGroup heading="Projects">
            {results.projects.map((p) => (
              <CommandItem key={p.id} value={`project-${p.key}-${p.name}`} onSelect={() => go(`/w/${workspaceId}/projects/${p.id}`)}>
                <FolderKanban />
                <span className="truncate">{p.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {results?.members?.length ? (
          <CommandGroup heading="People">
            {results.members.map((m) => (
              <CommandItem key={m.id} value={`member-${m.user.name}`} onSelect={() => go(`/w/${workspaceId}/settings/members`)}>
                <Users />
                <span className="truncate">{m.user.name}</span>
                <span className="text-xs text-muted-foreground">{m.user.email}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        <CommandSeparator />
        <CommandGroup heading="Go to">
          {PAGES.map((p) => (
            <CommandItem key={p.segment} value={`goto-${p.label}`} onSelect={() => go(`/w/${workspaceId}/${p.segment}`)}>
              <p.icon />
              {p.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
