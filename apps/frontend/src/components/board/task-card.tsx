'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format, isPast } from 'date-fns';
import { CalendarDays, CheckSquare, Flag, MessageSquare, Paperclip } from 'lucide-react';
import { PRIORITY_COLORS } from '@taskforge/shared-ui';
import type { TaskCard as TaskCardType } from '@/hooks/use-tasks';
import { UserAvatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface TaskCardProps {
  task: TaskCardType;
  onOpen: (taskId: string) => void;
  dragOverlay?: boolean;
}

export function TaskCardView({ task, onOpen, dragOverlay }: TaskCardProps) {
  const overdue = task.dueDate && task.statusCategory !== 'DONE' && isPast(new Date(task.dueDate));

  return (
    <button
      type="button"
      onClick={() => onOpen(task.id)}
      className={cn(
        'w-full rounded-lg border bg-card p-3 text-left shadow-card transition-shadow hover:shadow-popover',
        dragOverlay && 'rotate-2 shadow-popover ring-2 ring-primary/40'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-[11px] text-muted-foreground">{task.key}</span>
        {task.priority !== 'NONE' && (
          <Flag className="h-3.5 w-3.5 shrink-0" style={{ color: PRIORITY_COLORS[task.priority] }} fill={PRIORITY_COLORS[task.priority]} />
        )}
      </div>
      <p className="mt-1 text-sm font-medium leading-snug">{task.title}</p>

      {task.labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.labels.map((label) => (
            <span
              key={label.id}
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ backgroundColor: `${label.color}22`, color: label.color }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground">
          {task.dueDate && (
            <span className={cn('flex items-center gap-1', overdue && 'font-medium text-destructive')}>
              <CalendarDays className="h-3 w-3" />
              {format(new Date(task.dueDate), 'MMM d')}
            </span>
          )}
          {task.counts.subtasks > 0 && (
            <span className="flex items-center gap-1">
              <CheckSquare className="h-3 w-3" /> {task.counts.subtasks}
            </span>
          )}
          {task.counts.comments > 0 && (
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" /> {task.counts.comments}
            </span>
          )}
          {task.counts.attachments > 0 && (
            <span className="flex items-center gap-1">
              <Paperclip className="h-3 w-3" /> {task.counts.attachments}
            </span>
          )}
        </div>
        <div className="flex -space-x-1.5">
          {task.assignees.slice(0, 3).map((assignee) => (
            <UserAvatar key={assignee.id} user={assignee} className="h-5 w-5 ring-2 ring-card" />
          ))}
        </div>
      </div>
    </button>
  );
}

export function SortableTaskCard(props: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.task.id,
    data: { type: 'task', columnId: props.task.columnId },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && 'opacity-40')}
      {...attributes}
      {...listeners}
    >
      <TaskCardView {...props} />
    </div>
  );
}
