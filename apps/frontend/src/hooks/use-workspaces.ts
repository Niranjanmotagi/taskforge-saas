'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { get, post, apiErrorMessage } from '@/lib/api';

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  description: string | null;
  ownerId: string;
  role: string;
  memberCount: number;
  projectCount: number;
  planTier: string;
  createdAt: string;
}

export const workspaceKeys = {
  all: ['workspaces'] as const,
  detail: (id: string) => ['workspaces', id] as const,
  members: (id: string) => ['workspaces', id, 'members'] as const,
  invitations: (id: string) => ['workspaces', id, 'invitations'] as const,
};

export function useWorkspaces() {
  return useQuery({
    queryKey: workspaceKeys.all,
    queryFn: () => get<WorkspaceSummary[]>('/workspaces'),
  });
}

export function useWorkspace(workspaceId: string) {
  return useQuery({
    queryKey: workspaceKeys.detail(workspaceId),
    queryFn: () => get<WorkspaceSummary & { storageUsedBytes: number; storageLimitBytes: number | null }>(`/workspaces/${workspaceId}`),
    enabled: Boolean(workspaceId),
  });
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; description?: string }) =>
      post<WorkspaceSummary>('/workspaces', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });
}
