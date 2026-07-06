'use client';

import { useMemo, useState } from 'react';
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PRIORITY_COLORS } from '@taskforge/shared-ui';
import { get } from '@/lib/api';
import type { TaskCard } from '@/hooks/use-tasks';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';

interface ProjectCalendarProps {
  workspaceId: string;
  /** When omitted, shows tasks across the whole workspace. */
  projectId?: string;
  onOpenTask: (taskId: string) => void;
}

type ViewMode = 'month' | 'week' | 'day';

export function ProjectCalendar({ workspaceId, projectId, onOpenTask }: ProjectCalendarProps) {
  const [cursor, setCursor] = useState(new Date());
  const [mode, setMode] = useState<ViewMode>('month');

  const range = useMemo(() => {
    if (mode === 'month') {
      return {
        start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }),
      };
    }
    if (mode === 'week') {
      return { start: startOfWeek(cursor, { weekStartsOn: 1 }), end: endOfWeek(cursor, { weekStartsOn: 1 }) };
    }
    return { start: cursor, end: cursor };
  }, [cursor, mode]);

  const { data: tasks, isPending } = useQuery({
    queryKey: ['calendar', workspaceId, projectId, range.start.toISOString(), range.end.toISOString()],
    queryFn: () =>
      get<TaskCard[]>(`/workspaces/${workspaceId}/tasks`, {
        projectId,
        limit: 100,
        dueAfter: range.start.toISOString(),
        dueBefore: addDays(range.end, 1).toISOString(),
      }),
  });

  const days = eachDayOfInterval(range);
  const tasksOn = (day: Date) => tasks?.filter((t) => t.dueDate && isSameDay(new Date(t.dueDate), day)) ?? [];

  const navigate = (dir: 1 | -1) => {
    if (mode === 'month') setCursor((c) => addMonths(c, dir));
    else if (mode === 'week') setCursor((c) => addWeeks(c, dir));
    else setCursor((c) => addDays(c, dir));
  };

  return (
    <div className="space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon-sm" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon-sm" onClick={() => navigate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCursor(new Date())}>
            Today
          </Button>
          <h2 className="ml-1 text-sm font-semibold">
            {mode === 'day' ? format(cursor, 'EEEE, MMMM d yyyy') : format(cursor, 'MMMM yyyy')}
          </h2>
        </div>
        <div className="flex rounded-lg bg-muted p-0.5">
          {(['month', 'week', 'day'] as ViewMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors',
                mode === m ? 'bg-background shadow' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {isPending ? (
        <Skeleton className="h-96" />
      ) : mode === 'day' ? (
        <div className="space-y-2">
          {tasksOn(cursor).length ? (
            tasksOn(cursor).map((task) => (
              <button
                key={task.id}
                onClick={() => onOpenTask(task.id)}
                className="flex w-full items-center gap-2 rounded-lg border bg-card px-3 py-2.5 text-left text-sm shadow-card hover:shadow-popover"
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PRIORITY_COLORS[task.priority] }} />
                <span className="font-mono text-xs text-muted-foreground">{task.key}</span>
                <span className="truncate">{task.title}</span>
              </button>
            ))
          ) : (
            <EmptyState icon={CalendarDays} title="Nothing due this day" />
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <div className="grid grid-cols-7 border-b bg-muted/50 text-center text-xs font-medium text-muted-foreground">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <div className={cn('grid grid-cols-7', mode === 'month' ? 'auto-rows-[minmax(96px,1fr)]' : 'auto-rows-[minmax(280px,1fr)]')}>
            {days.map((day) => {
              const dayTasks = tasksOn(day);
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'border-b border-r p-1.5 last:border-r-0',
                    mode === 'month' && !isSameMonth(day, cursor) && 'bg-muted/30 text-muted-foreground'
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px]',
                      isToday(day) && 'bg-primary font-semibold text-primary-foreground'
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                  <div className="mt-1 space-y-1">
                    {dayTasks.slice(0, mode === 'month' ? 3 : 12).map((task) => (
                      <button
                        key={task.id}
                        onClick={() => onOpenTask(task.id)}
                        className="flex w-full items-center gap-1 truncate rounded bg-primary/10 px-1.5 py-0.5 text-left text-[11px] font-medium text-primary hover:bg-primary/20"
                        title={task.title}
                      >
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: PRIORITY_COLORS[task.priority] }} />
                        <span className="truncate">{task.title}</span>
                      </button>
                    ))}
                    {dayTasks.length > 3 && mode === 'month' && (
                      <p className="px-1 text-[10px] text-muted-foreground">+{dayTasks.length - 3} more</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
