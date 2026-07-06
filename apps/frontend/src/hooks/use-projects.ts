'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { get, post, patch, del, apiErrorMessage } from '@/lib/api';

export interface ProjectRow {
  id: string;
  name: string;
  key: string;
  description: string | null;
  color: string;
  icon: string | null;
  status: string;
  health: string;
  startDate: string | null;
  dueDate: string | null;
  budgetCents: number | null;
  currency: string;
  clientName: string | null;
  isTemplate: boolean;
  isFavorite: boolean;
  progress: number;
  taskCounts: { total: number; completed: number };
  lead: { id: string; name: string; avatarUrl: string | null } | null;
  members: Array<{ user: { id: string; name: string; avatarUrl: string | null } }>;
  archivedAt: string | null;
  updatedAt: string;
}

export const projectKeys = {
  list: (wsId: string, filters?: object) => ['projects', wsId, filters ?? {}] as const,
  detail: (wsId: string, projectId: string) => ['projects', wsId, 'detail', projectId] as const,
  board: (wsId: string, projectId: string) => ['board', wsId, projectId] as const,
};

export function useProjects(workspaceId: string, filters?: { search?: string; favorites?: boolean; status?: string }) {
  return useQuery({
    queryKey: projectKeys.list(workspaceId, filters),
    queryFn: () => get<ProjectRow[]>(`/workspaces/${workspaceId}/projects`, { limit: 50, ...filters }),
    enabled: Boolean(workspaceId),
  });
}

export function useProject(workspaceId: string, projectId: string) {
  return useQuery({
    queryKey: projectKeys.detail(workspaceId, projectId),
    queryFn: () =>
      get<ProjectRow & { columns: Array<{ id: string; name: string; category: string; color: string; position: number; wipLimit: number | null }> }>(
        `/workspaces/${workspaceId}/projects/${projectId}`
      ),
    enabled: Boolean(workspaceId && projectId),
  });
}

export function useCreateProject(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; description?: string; color?: string; clientName?: string; dueDate?: string }) =>
      post<ProjectRow>(`/workspaces/${workspaceId}/projects`, input),
    onSuccess: (project) => {
      toast.success(`Project "${project.name}" created`);
      void queryClient.invalidateQueries({ queryKey: ['projects', workspaceId] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });
}

export function useUpdateProject(workspaceId: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      patch<ProjectRow>(`/workspaces/${workspaceId}/projects/${projectId}`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects', workspaceId] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });
}

export function useToggleFavorite(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => post(`/workspaces/${workspaceId}/projects/${projectId}/favorite`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['projects', workspaceId] }),
  });
}

export function useDuplicateProject(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { projectId: string; name?: string }) =>
      post<ProjectRow>(`/workspaces/${workspaceId}/projects/${input.projectId}/duplicate`, { name: input.name }),
    onSuccess: (p) => {
      toast.success(`Duplicated as "${p.name}"`);
      void queryClient.invalidateQueries({ queryKey: ['projects', workspaceId] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });
}

export function useDeleteProject(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => del(`/workspaces/${workspaceId}/projects/${projectId}`),
    onSuccess: () => {
      toast.success('Project deleted');
      void queryClient.invalidateQueries({ queryKey: ['projects', workspaceId] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });
}
