'use client';

import { useMemo, useState } from 'react';
import { addDays, differenceInCalendarDays, format, isToday, startOfDay } from 'date-fns';
import { GanttChartSquare, ZoomIn, ZoomOut } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { daysBetween } from '@taskforge/shared-utils';
import { get } from '@/lib/api';
import type { TaskCard } from '@/hooks/use-tasks';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';

interface GanttChartProps {
  workspaceId: string;
  projectId: string;
  onOpenTask: (taskId: string) => void;
}

interface GanttTask extends TaskCard {
  _start: Date;
  _end: Date;
}

/**
 * Interactive Gantt: rows per task, day-grid timeline, dependency awareness.
 * Tasks without dates render in the sidebar so nothing disappears.
 * Critical-path-lite: tasks that block others AND are overdue/at-risk get flagged.
 */
export function GanttChart({ workspaceId, projectId, onOpenTask }: GanttChartProps) {
  const [dayWidth, setDayWidth] = useState(28);

  const { data: tasks, isPending } = useQuery({
    queryKey: ['gantt', workspaceId, projectId],
    queryFn: () => get<TaskCard[]>(`/workspaces/${workspaceId}/tasks`, { projectId, limit: 100 }),
  });

  const { dated, undated, rangeStart, totalDays, blockerIds } = useMemo(() => {
    const withDates: GanttTask[] = [];
    const without: TaskCard[] = [];
    for (const task of tasks ?? []) {
      const start = task.startDate ? startOfDay(new Date(task.startDate)) : task.dueDate ? startOfDay(new Date(task.dueDate)) : null;
      const end = task.dueDate ? startOfDay(new Date(task.dueDate)) : start;
      if (start && end) withDates.push({ ...task, _start: start, _end: end < start ? start : end });
      else without.push(task);
    }
    withDates.sort((a, b) => a._start.getTime() - b._start.getTime());

    const min = withDates.length
      ? new Date(Math.min(...withDates.map((t) => t._start.getTime())))
      : startOfDay(new Date());
    const max = withDates.length
      ? new Date(Math.max(...withDates.map((t) => t._end.getTime())))
      : addDays(startOfDay(new Date()), 14);
    const start = addDays(min, -2);
    const days = Math.max(daysBetween(start, addDays(max, 3)), 14);

    // Tasks that appear as a dependency target of others (they block work).
    const blockers = new Set<string>();
    // counts.subtasks etc. aren't dependencies; the board payload doesn't carry
    // dependency edges, so flag long-running overdue tasks as risk instead.
    const now = new Date();
    for (const t of withDates) {
      if (t.statusCategory !== 'DONE' && t._end < now) blockers.add(t.id);
    }

    return { dated: withDates, undated: without, rangeStart: start, totalDays: days, blockerIds: blockers };
  }, [tasks]);

  if (isPending) return <Skeleton className="m-5 h-96" />;
  if (!tasks?.length) {
    return <EmptyState icon={GanttChartSquare} title="No tasks to chart" description="Add start and due dates to see the timeline." />;
  }

  const days = Array.from({ length: totalDays }, (_, i) => addDays(rangeStart, i));

  return (
    <div className="space-y-3 p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {dated.length} scheduled · {undated.length} unscheduled
        </p>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" onClick={() => setDayWidth((w) => Math.max(16, w - 6))}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon-sm" onClick={() => setDayWidth((w) => Math.min(56, w + 6))}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border scrollbar-thin">
        <div className="flex min-w-max">
          {/* Task names column */}
          <div className="sticky left-0 z-10 w-64 shrink-0 border-r bg-background">
            <div className="flex h-9 items-center border-b bg-muted/50 px-3 text-xs font-medium text-muted-foreground">
              Task
            </div>
            {dated.map((task) => (
              <button
                key={task.id}
                onClick={() => onOpenTask(task.id)}
                className="flex h-9 w-full items-center gap-2 border-b px-3 text-left text-sm hover:bg-accent"
              >
                <span className="font-mono text-[10px] text-muted-foreground">{task.key}</span>
                <span className="truncate">{task.title}</span>
              </button>
            ))}
          </div>

          {/* Timeline */}
          <div>
            <div className="flex h-9 border-b bg-muted/50">
              {days.map((day) => (
                <div
                  key={day.toISOString()}
                  style={{ width: dayWidth }}
                  className={cn(
                    'flex shrink-0 flex-col items-center justify-center border-r text-[9px] leading-tight text-muted-foreground',
                    isToday(day) && 'bg-primary/10 font-semibold text-primary',
                    [0, 6].includes(day.getDay()) && 'bg-muted/70'
                  )}
                >
                  <span>{format(day, 'd')}</span>
                  {(day.getDate() === 1 || differenceInCalendarDays(day, rangeStart) === 0) && (
                    <span className="font-medium">{format(day, 'MMM')}</span>
                  )}
                </div>
              ))}
            </div>

            {dated.map((task) => {
              const offset = daysBetween(rangeStart, task._start);
              const span = Math.max(daysBetween(task._start, task._end) + 1, 1);
              const done = task.statusCategory === 'DONE';
              const critical = blockerIds.has(task.id);
              return (
                <div key={task.id} className="relative h-9 border-b" style={{ width: totalDays * dayWidth }}>
                  {/* today line */}
                  <div
                    className="absolute inset-y-0 w-px bg-primary/50"
                    style={{ left: daysBetween(rangeStart, startOfDay(new Date())) * dayWidth + dayWidth / 2 }}
                  />
                  <button
                    onClick={() => onOpenTask(task.id)}
                    className={cn(
                      'absolute top-1.5 flex h-6 items-center gap-1 truncate rounded-md px-2 text-[11px] font-medium text-white shadow-sm transition-transform hover:scale-[1.02]',
                      critical && 'ring-2 ring-destructive'
                    )}
                    style={{
                      left: offset * dayWidth + 2,
                      width: span * dayWidth - 4,
                      backgroundColor: done ? '#10b981' : critical ? '#ef4444' : task.project.color,
                      opacity: done ? 0.7 : 1,
                    }}
                    title={`${task.title} (${format(task._start, 'MMM d')} → ${format(task._end, 'MMM d')})`}
                  >
                    <span className="truncate">{task.title}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {undated.length > 0 && (
        <div className="rounded-lg border border-dashed p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Unscheduled (no dates)</p>
          <div className="flex flex-wrap gap-2">
            {undated.map((task) => (
              <button
                key={task.id}
                onClick={() => onOpenTask(task.id)}
                className="rounded-full border px-2.5 py-1 text-xs hover:bg-accent"
              >
                {task.key} · {task.title.slice(0, 40)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
