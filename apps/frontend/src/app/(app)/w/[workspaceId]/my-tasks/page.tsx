'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, isPast, isToday, isTomorrow } from 'date-fns';
import { CheckCircle2, Flag, ListTodo } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PRIORITY_COLORS } from '@taskforge/shared-ui';
import { get } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import type { TaskCard } from '@/hooks/use-tasks';
import { Topbar } from '@/components/shell/topbar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/misc';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';

type Bucket = 'overdue' | 'today' | 'tomorrow' | 'later' | 'noDate';

const BUCKET_META: Record<Bucket, { label: string; tone?: string }> = {
  overdue: { label: 'Overdue', tone: 'text-destructive' },
  today: { label: 'Today' },
  tomorrow: { label: 'Tomorrow' },
  later: { label: 'Upcoming' },
  noDate: { label: 'No due date' },
};

export default function MyTasksPage({ params }: { params: { workspaceId: string } }) {
  const { workspaceId } = params;
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [showDone, setShowDone] = useState(false);

  const { data: tasks, isPending } = useQuery({
    queryKey: ['my-tasks', workspaceId, user?.id, showDone],
    queryFn: () =>
      get<TaskCard[]>(`/workspaces/${workspaceId}/tasks`, {
        assigneeId: user?.id,
        limit: 100,
        includeSubtasks: true,
        ...(showDone ? {} : {}),
      }),
    enabled: Boolean(user?.id),
  });

  const buckets = useMemo(() => {
    const result: Record<Bucket, TaskCard[]> = { overdue: [], today: [], tomorrow: [], later: [], noDate: [] };
    for (const task of tasks ?? []) {
      if (task.statusCategory === 'DONE' && !showDone) continue;
      if (!task.dueDate) result.noDate.push(task);
      else if (isToday(new Date(task.dueDate))) result.today.push(task);
      else if (isTomorrow(new Date(task.dueDate))) result.tomorrow.push(task);
      else if (isPast(new Date(task.dueDate))) result.overdue.push(task);
      else result.later.push(task);
    }
    return result;
  }, [tasks, showDone]);

  const openTask = (task: TaskCard) =>
    router.push(`/w/${workspaceId}/projects/${task.projectId}?task=${task.id}`);

  const total = Object.values(buckets).reduce((s, b) => s + b.length, 0);

  return (
    <>
      <Topbar title="My Tasks" />
      <div className="flex-1 space-y-6 overflow-y-auto p-5 scrollbar-thin">
        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} className="accent-primary" />
          Show completed
        </label>

        {isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : total === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="You're all clear"
            description="Tasks assigned to you across every project will show up here."
          />
        ) : (
          (Object.keys(buckets) as Bucket[]).map((bucket) =>
            buckets[bucket].length ? (
              <section key={bucket}>
                <h2 className={cn('mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground', BUCKET_META[bucket].tone)}>
                  {BUCKET_META[bucket].label} · {buckets[bucket].length}
                </h2>
                <div className="overflow-hidden rounded-lg border">
                  {buckets[bucket].map((task) => (
                    <button
                      key={task.id}
                      onClick={() => openTask(task)}
                      className="flex w-full items-center gap-3 border-b bg-card px-3 py-2.5 text-left text-sm transition-colors last:border-0 hover:bg-accent"
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: task.project.color }} />
                      <span className="font-mono text-xs text-muted-foreground">{task.key}</span>
                      <span className={cn('min-w-0 flex-1 truncate font-medium', task.statusCategory === 'DONE' && 'text-muted-foreground line-through')}>
                        {task.title}
                      </span>
                      {task.priority !== 'NONE' && (
                        <Flag className="h-3.5 w-3.5 shrink-0" style={{ color: PRIORITY_COLORS[task.priority] }} />
                      )}
                      <Badge variant="secondary" className="shrink-0 text-[10px]">
                        {task.statusCategory.replace('_', ' ')}
                      </Badge>
                      {task.dueDate && (
                        <span className={cn('shrink-0 text-xs text-muted-foreground', bucket === 'overdue' && 'font-medium text-destructive')}>
                          {format(new Date(task.dueDate), 'MMM d')}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </section>
            ) : null
          )
        )}
      </div>
    </>
  );
}
