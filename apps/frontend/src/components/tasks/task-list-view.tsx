'use client';

import { useState } from 'react';
import { format, isPast } from 'date-fns';
import { Flag, ListTodo, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PRIORITY_COLORS, STATUS_CATEGORY_COLORS } from '@taskforge/shared-ui';
import { get } from '@/lib/api';
import type { TaskCard } from '@/hooks/use-tasks';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/misc';
import { UserAvatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface TaskListViewProps {
  workspaceId: string;
  projectId: string;
  onOpenTask: (taskId: string) => void;
}

const STATUS_OPTIONS = ['ALL', 'BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'TESTING', 'DONE'];
const PRIORITY_OPTIONS = ['ALL', 'URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE'];

export function TaskListView({ workspaceId, projectId, onOpenTask }: TaskListViewProps) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [priority, setPriority] = useState('ALL');

  const { data: tasks, isPending } = useQuery({
    queryKey: ['tasks-list', workspaceId, projectId, search, status, priority],
    queryFn: () =>
      get<TaskCard[]>(`/workspaces/${workspaceId}/tasks`, {
        projectId,
        limit: 100,
        includeSubtasks: true,
        search: search || undefined,
        statusCategory: status === 'ALL' ? undefined : status,
        priority: priority === 'ALL' ? undefined : priority,
      }),
  });

  return (
    <div className="space-y-4 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Filter tasks…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64 pl-8" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s === 'ALL' ? 'All statuses' : s.replace('_', ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRIORITY_OPTIONS.map((p) => (
              <SelectItem key={p} value={p}>
                {p === 'ALL' ? 'All priorities' : p.charAt(0) + p.slice(1).toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-11" />
          ))}
        </div>
      ) : tasks?.length ? (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Key</th>
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Priority</th>
                <th className="px-3 py-2 font-medium">Due</th>
                <th className="px-3 py-2 font-medium">Assignees</th>
                <th className="px-3 py-2 font-medium">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tasks.map((task) => {
                const overdue = task.dueDate && task.statusCategory !== 'DONE' && isPast(new Date(task.dueDate));
                return (
                  <tr
                    key={task.id}
                    onClick={() => onOpenTask(task.id)}
                    className="cursor-pointer transition-colors hover:bg-accent"
                  >
                    <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                      {task.parentId ? <span className="mr-1 text-muted-foreground/50">↳</span> : null}
                      {task.key}
                    </td>
                    <td className="max-w-md truncate px-3 py-2.5 font-medium">{task.title}</td>
                    <td className="px-3 py-2.5">
                      <Badge
                        variant="secondary"
                        className="text-[10px]"
                        style={{ color: STATUS_CATEGORY_COLORS[task.statusCategory] }}
                      >
                        {task.statusCategory.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      {task.priority !== 'NONE' && (
                        <span className="flex items-center gap-1 text-xs">
                          <Flag className="h-3 w-3" style={{ color: PRIORITY_COLORS[task.priority] }} />
                          {task.priority.charAt(0) + task.priority.slice(1).toLowerCase()}
                        </span>
                      )}
                    </td>
                    <td className={cn('px-3 py-2.5 text-xs', overdue ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                      {task.dueDate ? format(new Date(task.dueDate), 'MMM d') : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex -space-x-1.5">
                        {task.assignees.slice(0, 3).map((a) => (
                          <UserAvatar key={a.id} user={a} className="h-5 w-5 ring-2 ring-background" />
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{task.storyPoints ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={ListTodo} title="No tasks match" description="Adjust the filters or add tasks from the board." />
      )}
    </div>
  );
}
