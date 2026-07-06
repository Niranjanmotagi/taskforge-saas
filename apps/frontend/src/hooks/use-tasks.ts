'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { SOCKET_EVENTS } from '@taskforge/shared-types';
import { get, post, patch, del, apiErrorMessage } from '@/lib/api';
import { getSocket } from '@/lib/socket';

export interface TaskCard {
  id: string;
  key: string;
  number: number;
  title: string;
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  statusCategory: string;
  position: string;
  columnId: string | null;
  sprintId: string | null;
  parentId: string | null;
  projectId: string;
  startDate: string | null;
  dueDate: string | null;
  estimatedMinutes: number | null;
  storyPoints: number | null;
  completedAt: string | null;
  assignees: Array<{ id: string; name: string; avatarUrl: string | null }>;
  labels: Array<{ id: string; name: string; color: string }>;
  counts: { comments: number; attachments: number; subtasks: number };
  project: { key: string; name: string; color: string };
}

export interface BoardColumn {
  id: string;
  name: string;
  category: string;
  color: string;
  position: number;
  wipLimit: number | null;
  tasks: TaskCard[];
}

export const boardKey = (workspaceId: string, projectId: string) => ['board', workspaceId, projectId] as const;
export const taskKey = (workspaceId: string, taskId: string) => ['task', workspaceId, taskId] as const;

export function useBoard(workspaceId: string, projectId: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: boardKey(workspaceId, projectId),
    queryFn: () => get<BoardColumn[]>(`/workspaces/${workspaceId}/projects/${projectId}/board`),
    enabled: Boolean(workspaceId && projectId),
  });

  // Live board: join the project room; any task event refreshes the board.
  useEffect(() => {
    const socket = getSocket();
    const join = () => socket.emit(SOCKET_EVENTS.JOIN_PROJECT, { workspaceId, projectId });
    if (socket.connected) join();
    socket.on('connect', join);

    const refresh = () => void queryClient.invalidateQueries({ queryKey: boardKey(workspaceId, projectId) });
    const events = [
      SOCKET_EVENTS.TASK_CREATED,
      SOCKET_EVENTS.TASK_UPDATED,
      SOCKET_EVENTS.TASK_MOVED,
      SOCKET_EVENTS.TASK_DELETED,
    ];
    for (const event of events) socket.on(event, refresh);

    return () => {
      socket.off('connect', join);
      for (const event of events) socket.off(event, refresh);
      socket.emit(SOCKET_EVENTS.LEAVE_PROJECT, { projectId });
    };
  }, [workspaceId, projectId, queryClient]);

  return query;
}

interface MoveInput {
  taskId: string;
  columnId: string;
  beforeTaskId?: string;
  afterTaskId?: string;
  /** Client-computed board state for the optimistic update. */
  optimistic: BoardColumn[];
}

export function useMoveTask(workspaceId: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, columnId, beforeTaskId, afterTaskId }: MoveInput) =>
      post<TaskCard>(`/workspaces/${workspaceId}/tasks/${taskId}/move`, { columnId, beforeTaskId, afterTaskId }),
    onMutate: async ({ optimistic }) => {
      await queryClient.cancelQueries({ queryKey: boardKey(workspaceId, projectId) });
      const previous = queryClient.getQueryData<BoardColumn[]>(boardKey(workspaceId, projectId));
      queryClient.setQueryData(boardKey(workspaceId, projectId), optimistic);
      return { previous };
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(boardKey(workspaceId, projectId), context.previous);
      }
      toast.error(apiErrorMessage(err));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: boardKey(workspaceId, projectId) });
    },
  });
}

export function useCreateTask(workspaceId: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; columnId?: string; priority?: string; parentId?: string; dueDate?: string; assigneeIds?: string[] }) =>
      post<TaskCard>(`/workspaces/${workspaceId}/projects/${projectId}/tasks`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: boardKey(workspaceId, projectId) });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });
}

export function useTask(workspaceId: string, taskId: string | null) {
  return useQuery({
    queryKey: taskKey(workspaceId, taskId ?? ''),
    queryFn: () => get<TaskDetail>(`/workspaces/${workspaceId}/tasks/${taskId}`),
    enabled: Boolean(taskId),
  });
}

export interface TaskDetail extends TaskCard {
  description: string | null;
  column: { id: string; name: string; category: string; color: string } | null;
  sprint: { id: string; name: string; status: string } | null;
  parent: { id: string; title: string; number: number } | null;
  creator: { id: string; name: string; avatarUrl: string | null };
  watchers: Array<{ id: string; name: string; avatarUrl: string | null }>;
  checklist: Array<{ id: string; title: string; isCompleted: boolean; position: number }>;
  subtasks: TaskCard[];
  dependencies: Array<{ id: string; type: string; dependsOnTask: { id: string; title: string; number: number; statusCategory: string; project: { key: string } } }>;
  dependents: Array<{ id: string; type: string; task: { id: string; title: string; number: number; statusCategory: string; project: { key: string } } }>;
}

export function useUpdateTask(workspaceId: string, projectId: string, taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => patch<TaskCard>(`/workspaces/${workspaceId}/tasks/${taskId}`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: taskKey(workspaceId, taskId) });
      void queryClient.invalidateQueries({ queryKey: boardKey(workspaceId, projectId) });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });
}

export function useDeleteTask(workspaceId: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => del(`/workspaces/${workspaceId}/tasks/${taskId}`),
    onSuccess: () => {
      toast.success('Task deleted');
      void queryClient.invalidateQueries({ queryKey: boardKey(workspaceId, projectId) });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export interface CommentRow {
  id: string;
  body: string;
  isEdited: boolean;
  createdAt: string;
  author: { id: string; name: string; avatarUrl: string | null };
  replies?: CommentRow[];
}

export function useComments(workspaceId: string, taskId: string | null) {
  return useQuery({
    queryKey: ['comments', workspaceId, taskId],
    queryFn: () => get<CommentRow[]>(`/workspaces/${workspaceId}/tasks/${taskId}/comments`),
    enabled: Boolean(taskId),
  });
}

export function useAddComment(workspaceId: string, taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { body: string; parentId?: string }) =>
      post<CommentRow>(`/workspaces/${workspaceId}/tasks/${taskId}/comments`, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['comments', workspaceId, taskId] }),
    onError: (err) => toast.error(apiErrorMessage(err)),
  });
}

// ---------------------------------------------------------------------------
// Checklist
// ---------------------------------------------------------------------------

export function useChecklist(workspaceId: string, taskId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: taskKey(workspaceId, taskId) });

  const add = useMutation({
    mutationFn: (title: string) => post(`/workspaces/${workspaceId}/tasks/${taskId}/checklist`, { title }),
    onSuccess: invalidate,
    onError: (err) => toast.error(apiErrorMessage(err)),
  });
  const toggle = useMutation({
    mutationFn: (input: { itemId: string; isCompleted: boolean }) =>
      patch(`/workspaces/${workspaceId}/tasks/${taskId}/checklist/${input.itemId}`, { isCompleted: input.isCompleted }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (itemId: string) => del(`/workspaces/${workspaceId}/tasks/${taskId}/checklist/${itemId}`),
    onSuccess: invalidate,
  });
  return { add, toggle, remove };
}
