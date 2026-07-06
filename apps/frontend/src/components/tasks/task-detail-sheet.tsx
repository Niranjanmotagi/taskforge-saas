'use client';

import { useEffect, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Bell,
  BellOff,
  CalendarDays,
  CheckSquare,
  Eye,
  Flag,
  Link2,
  ListTodo,
  MessageSquare,
  Plus,
  Send,
  Trash2,
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PRIORITY_COLORS } from '@taskforge/shared-ui';
import { post } from '@/lib/api';
import {
  taskKey,
  useAddComment,
  useChecklist,
  useComments,
  useCreateTask,
  useDeleteTask,
  useTask,
  useUpdateTask,
} from '@/hooks/use-tasks';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/overlays';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox, Progress, Separator, Skeleton, Textarea } from '@/components/ui/misc';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserAvatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface TaskDetailSheetProps {
  workspaceId: string;
  projectId: string;
  taskId: string | null;
  onClose: () => void;
}

const PRIORITIES = ['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE'] as const;

export function TaskDetailSheet({ workspaceId, projectId, taskId, onClose }: TaskDetailSheetProps) {
  const { data: task, isPending } = useTask(workspaceId, taskId);
  const update = useUpdateTask(workspaceId, projectId, taskId ?? '');
  const deleteTask = useDeleteTask(workspaceId, projectId);
  const checklist = useChecklist(workspaceId, taskId ?? '');
  const { data: comments } = useComments(workspaceId, taskId);
  const addComment = useAddComment(workspaceId, taskId ?? '');
  const createSubtask = useCreateTask(workspaceId, projectId);
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [newItem, setNewItem] = useState('');
  const [newSubtask, setNewSubtask] = useState('');
  const [commentBody, setCommentBody] = useState('');

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? '');
    }
  }, [task]);

  const toggleWatch = useMutation({
    mutationFn: () => post<{ watching: boolean }>(`/workspaces/${workspaceId}/tasks/${taskId}/watch`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: taskKey(workspaceId, taskId ?? '') }),
  });

  const doneChecklist = task?.checklist.filter((c) => c.isCompleted).length ?? 0;

  return (
    <Sheet open={Boolean(taskId)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        {isPending || !task ? (
          <div className="space-y-4 p-6">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-2 border-b px-6 py-3">
              <Badge variant="outline" className="font-mono">
                {task.key}
              </Badge>
              {task.column && (
                <Badge variant="secondary">
                  <span className="mr-1 h-2 w-2 rounded-full" style={{ backgroundColor: task.column.color }} />
                  {task.column.name}
                </Badge>
              )}
              <div className="ml-auto flex items-center gap-1 pr-8">
                <Button variant="ghost" size="icon-sm" onClick={() => toggleWatch.mutate()} title="Watch/unwatch">
                  {task.watchers.length > 0 ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive"
                  onClick={() => {
                    if (window.confirm('Delete this task and its subtasks?')) {
                      deleteTask.mutate(task.id, { onSuccess: onClose });
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto p-6 scrollbar-thin">
              {/* Title */}
              <SheetTitle asChild>
                <textarea
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => title.trim() && title !== task.title && update.mutate({ title: title.trim() })}
                  rows={1}
                  className="w-full resize-none bg-transparent text-xl font-semibold outline-none"
                />
              </SheetTitle>

              {/* Meta grid */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                <div className="space-y-1.5">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Flag className="h-3.5 w-3.5" /> Priority
                  </p>
                  <Select value={task.priority} onValueChange={(v) => update.mutate({ priority: v })}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p}>
                          <span className="flex items-center gap-2">
                            <Flag className="h-3.5 w-3.5" style={{ color: PRIORITY_COLORS[p] }} />
                            {p.charAt(0) + p.slice(1).toLowerCase()}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" /> Due date
                  </p>
                  <Input
                    type="date"
                    className="h-8"
                    value={task.dueDate ? format(new Date(task.dueDate), 'yyyy-MM-dd') : ''}
                    onChange={(e) => update.mutate({ dueDate: e.target.value ? new Date(e.target.value).toISOString() : null })}
                  />
                </div>

                <div className="space-y-1.5">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Eye className="h-3.5 w-3.5" /> Assignees
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {task.assignees.length ? (
                      task.assignees.map((a) => (
                        <span key={a.id} className="flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2 text-xs">
                          <UserAvatar user={a} className="h-5 w-5" />
                          {a.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">Unassigned</span>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">Story points</p>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    className="h-8 w-24"
                    defaultValue={task.storyPoints ?? ''}
                    onBlur={(e) => {
                      const v = e.target.value === '' ? null : Number(e.target.value);
                      if (v !== task.storyPoints) update.mutate({ storyPoints: v });
                    }}
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Description</p>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={() => (description || null) !== (task.description ?? null) && update.mutate({ description: description || null })}
                  placeholder="Add a description…"
                  rows={4}
                />
              </div>

              {/* Checklist */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <CheckSquare className="h-3.5 w-3.5" /> Checklist{' '}
                    {task.checklist.length > 0 && `${doneChecklist}/${task.checklist.length}`}
                  </p>
                </div>
                {task.checklist.length > 0 && (
                  <Progress value={task.checklist.length ? (doneChecklist / task.checklist.length) * 100 : 0} />
                )}
                <div className="space-y-1">
                  {task.checklist.map((item) => (
                    <div key={item.id} className="group flex items-center gap-2 rounded px-1 py-1 hover:bg-accent">
                      <Checkbox
                        checked={item.isCompleted}
                        onCheckedChange={(c) => checklist.toggle.mutate({ itemId: item.id, isCompleted: c === true })}
                      />
                      <span className={cn('flex-1 text-sm', item.isCompleted && 'text-muted-foreground line-through')}>
                        {item.title}
                      </span>
                      <button
                        onClick={() => checklist.remove.mutate(item.id)}
                        className="opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (newItem.trim()) {
                      checklist.add.mutate(newItem.trim());
                      setNewItem('');
                    }
                  }}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    placeholder="Add checklist item"
                    className="h-8 border-0 px-1 shadow-none focus-visible:ring-0"
                  />
                </form>
              </div>

              {/* Subtasks */}
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <ListTodo className="h-3.5 w-3.5" /> Subtasks {task.subtasks.length > 0 && `(${task.subtasks.length})`}
                </p>
                <div className="space-y-1">
                  {task.subtasks.map((sub) => (
                    <div key={sub.id} className="flex items-center gap-2 rounded border px-2.5 py-1.5 text-sm">
                      <span className="font-mono text-[11px] text-muted-foreground">{sub.key}</span>
                      <span className={cn('flex-1 truncate', sub.statusCategory === 'DONE' && 'text-muted-foreground line-through')}>
                        {sub.title}
                      </span>
                      <Badge variant="secondary" className="text-[10px]">
                        {sub.statusCategory.replace('_', ' ')}
                      </Badge>
                    </div>
                  ))}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (newSubtask.trim()) {
                      createSubtask.mutate(
                        { title: newSubtask.trim(), parentId: task.id, columnId: task.columnId ?? undefined },
                        {
                          onSuccess: () =>
                            void queryClient.invalidateQueries({ queryKey: taskKey(workspaceId, task.id) }),
                        }
                      );
                      setNewSubtask('');
                    }
                  }}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={newSubtask}
                    onChange={(e) => setNewSubtask(e.target.value)}
                    placeholder="Add subtask"
                    className="h-8 border-0 px-1 shadow-none focus-visible:ring-0"
                  />
                </form>
              </div>

              {/* Dependencies */}
              {(task.dependencies.length > 0 || task.dependents.length > 0) && (
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Link2 className="h-3.5 w-3.5" /> Dependencies
                  </p>
                  {task.dependencies.map((dep) => (
                    <div key={dep.id} className="flex items-center gap-2 text-sm">
                      <Badge variant="warning" className="text-[10px]">blocked by</Badge>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {dep.dependsOnTask.project.key}-{dep.dependsOnTask.number}
                      </span>
                      <span className="truncate">{dep.dependsOnTask.title}</span>
                    </div>
                  ))}
                  {task.dependents.map((dep) => (
                    <div key={dep.id} className="flex items-center gap-2 text-sm">
                      <Badge className="text-[10px]">blocks</Badge>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {dep.task.project.key}-{dep.task.number}
                      </span>
                      <span className="truncate">{dep.task.title}</span>
                    </div>
                  ))}
                </div>
              )}

              <Separator />

              {/* Comments */}
              <div className="space-y-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <MessageSquare className="h-3.5 w-3.5" /> Comments
                </p>
                <div className="space-y-4">
                  {comments?.map((comment) => (
                    <div key={comment.id} className="flex gap-2.5">
                      <UserAvatar user={comment.author} className="mt-0.5 h-7 w-7" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">
                          <span className="font-medium">{comment.author.name}</span>{' '}
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                            {comment.isEdited && ' · edited'}
                          </span>
                        </p>
                        <p className="whitespace-pre-wrap text-sm text-foreground/90">{comment.body}</p>
                        {comment.replies?.map((reply) => (
                          <div key={reply.id} className="mt-2 flex gap-2 border-l-2 pl-3">
                            <UserAvatar user={reply.author} className="mt-0.5 h-5 w-5" />
                            <div>
                              <p className="text-xs">
                                <span className="font-medium">{reply.author.name}</span>{' '}
                                <span className="text-muted-foreground">
                                  {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}
                                </span>
                              </p>
                              <p className="whitespace-pre-wrap text-sm">{reply.body}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Comment composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (commentBody.trim()) {
                  addComment.mutate({ body: commentBody.trim() });
                  setCommentBody('');
                }
              }}
              className="flex items-end gap-2 border-t p-4"
            >
              <Textarea
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder="Write a comment…  (@mention teammates)"
                rows={2}
                className="min-h-0 flex-1 resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              <Button type="submit" size="icon" loading={addComment.isPending} disabled={!commentBody.trim()}>
                <Send />
              </Button>
            </form>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
