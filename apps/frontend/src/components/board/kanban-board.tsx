'use client';

import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { Plus } from 'lucide-react';
import { Kanban } from 'lucide-react';
import { useBoard, useCreateTask, useMoveTask, type BoardColumn, type TaskCard } from '@/hooks/use-tasks';
import { SortableTaskCard, TaskCardView } from './task-card';
import { Skeleton } from '@/components/ui/misc';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';

interface KanbanBoardProps {
  workspaceId: string;
  projectId: string;
  onOpenTask: (taskId: string) => void;
}

function ColumnShell({ column, children, count }: { column: BoardColumn; children: React.ReactNode; count: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id, data: { type: 'column' } });
  const overLimit = column.wipLimit !== null && count > column.wipLimit;

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-xl bg-sidebar/80">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: column.color }} />
        <span className="text-sm font-semibold">{column.name}</span>
        <Badge variant={overLimit ? 'destructive' : 'secondary'} className="ml-auto">
          {count}
          {column.wipLimit ? `/${column.wipLimit}` : ''}
        </Badge>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2 scrollbar-thin transition-colors',
          isOver && 'rounded-lg bg-primary/5'
        )}
      >
        {children}
      </div>
    </div>
  );
}

function QuickAdd({ workspaceId, projectId, columnId }: { workspaceId: string; projectId: string; columnId: string }) {
  const [title, setTitle] = useState('');
  const create = useCreateTask(workspaceId, projectId);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = title.trim();
        if (!trimmed) return;
        create.mutate({ title: trimmed, columnId });
        setTitle('');
      }}
      className="px-2 pb-2"
    >
      <div className="flex items-center gap-1 rounded-md border border-dashed bg-card/60 px-2 focus-within:border-solid focus-within:border-ring">
        <Plus className="h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add task"
          className="h-8 border-0 px-1 shadow-none focus-visible:ring-0"
        />
      </div>
    </form>
  );
}

export function KanbanBoard({ workspaceId, projectId, onOpenTask }: KanbanBoardProps) {
  const { data: columns, isPending } = useBoard(workspaceId, projectId);
  const moveTask = useMoveTask(workspaceId, projectId);
  const [active, setActive] = useState<TaskCard | null>(null);
  // Local board state during drag for smooth cross-column preview.
  const [draft, setDraft] = useState<BoardColumn[] | null>(null);

  const board = draft ?? columns ?? [];
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const taskById = useMemo(() => {
    const map = new Map<string, TaskCard>();
    for (const col of board) for (const t of col.tasks) map.set(t.id, t);
    return map;
  }, [board]);

  function findColumn(taskOrColumnId: string): BoardColumn | undefined {
    return (
      board.find((c) => c.id === taskOrColumnId) ??
      board.find((c) => c.tasks.some((t) => t.id === taskOrColumnId))
    );
  }

  function handleDragStart(event: DragStartEvent) {
    const task = taskById.get(String(event.active.id));
    setActive(task ?? null);
    setDraft(columns ? columns.map((c) => ({ ...c, tasks: [...c.tasks] })) : null);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active: a, over } = event;
    if (!over || !draft) return;
    const activeId = String(a.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const fromCol = draft.find((c) => c.tasks.some((t) => t.id === activeId));
    const toCol = draft.find((c) => c.id === overId) ?? draft.find((c) => c.tasks.some((t) => t.id === overId));
    if (!fromCol || !toCol) return;

    const task = fromCol.tasks.find((t) => t.id === activeId)!;
    const next = draft.map((c) => ({ ...c, tasks: c.tasks.filter((t) => t.id !== activeId) }));
    const target = next.find((c) => c.id === toCol.id)!;

    const overIndex = target.tasks.findIndex((t) => t.id === overId);
    const insertAt = overIndex >= 0 ? overIndex : target.tasks.length;
    target.tasks.splice(insertAt, 0, { ...task, columnId: target.id });
    setDraft(next);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active: a } = event;
    setActive(null);
    if (!draft || !columns) {
      setDraft(null);
      return;
    }

    const activeId = String(a.id);
    const toCol = draft.find((c) => c.tasks.some((t) => t.id === activeId));
    if (!toCol) {
      setDraft(null);
      return;
    }
    const index = toCol.tasks.findIndex((t) => t.id === activeId);
    const before = toCol.tasks[index - 1]?.id;
    const after = toCol.tasks[index + 1]?.id;

    // Skip no-op drops (same column, same neighbours as server state).
    const original = columns.find((c) => c.tasks.some((t) => t.id === activeId));
    const originalIndex = original?.tasks.findIndex((t) => t.id === activeId) ?? -1;
    if (original?.id === toCol.id && originalIndex === index) {
      setDraft(null);
      return;
    }

    moveTask.mutate({
      taskId: activeId,
      columnId: toCol.id,
      afterTaskId: before,
      beforeTaskId: after,
      optimistic: draft,
    });
    setDraft(null);
  }

  if (isPending) {
    return (
      <div className="flex gap-4 overflow-x-auto p-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-96 w-72 shrink-0" />
        ))}
      </div>
    );
  }

  if (!board.length) {
    return <EmptyState icon={Kanban} title="No board columns" description="This project has no columns configured." />;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActive(null);
        setDraft(null);
      }}
    >
      <div className="flex h-full gap-4 overflow-x-auto p-5 scrollbar-thin">
        {board.map((column) => (
          <ColumnShell key={column.id} column={column} count={column.tasks.length}>
            <SortableContext items={column.tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              {column.tasks.map((task) => (
                <SortableTaskCard key={task.id} task={task} onOpen={onOpenTask} />
              ))}
            </SortableContext>
            <QuickAdd workspaceId={workspaceId} projectId={projectId} columnId={column.id} />
          </ColumnShell>
        ))}
      </div>
      <DragOverlay>{active ? <TaskCardView task={active} onOpen={() => undefined} dragOverlay /> : null}</DragOverlay>
    </DndContext>
  );
}
