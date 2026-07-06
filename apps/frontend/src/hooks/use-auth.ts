'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { post, apiErrorMessage } from '@/lib/api';
import { useAuthStore, type SessionUser } from '@/stores/auth-store';
import { disconnectSocket } from '@/lib/socket';

interface AuthPayload {
  user: SessionUser;
  accessToken: string;
  expiresIn: number;
}

interface WorkspaceRef {
  id: string;
  name: string;
  slug: string;
  role: string;
}

/** Where to land after a successful sign-in. */
export async function resolveLandingPath(): Promise<string> {
  try {
    const me = await import('@/lib/api').then((m) =>
      m.get<SessionUser & { workspaces: WorkspaceRef[] }>('/auth/me')
    );
    useAuthStore.getState().setUser(me);
    if (me.workspaces.length > 0) return `/w/${me.workspaces[0].id}/dashboard`;
    return '/onboarding';
  } catch {
    return '/onboarding';
  }
}

export function useLogin() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({
    mutationFn: (input: { email: string; password: string; rememberMe: boolean }) =>
      post<AuthPayload>('/auth/login', input),
    onSuccess: async (data) => {
      setSession(data.accessToken, data.user);
      router.replace(await resolveLandingPath());
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });
}

export function useRegister() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({
    mutationFn: (input: { name: string; email: string; password: string }) =>
      post<AuthPayload>('/auth/register', input),
    onSuccess: (data) => {
      setSession(data.accessToken, data.user);
      toast.success('Welcome to TaskForge! Check your inbox to verify your email.');
      router.replace('/onboarding');
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });
}

export function useLogout() {
  const router = useRouter();
  const clear = useAuthStore((s) => s.clear);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => post('/auth/logout'),
    onSettled: () => {
      clear();
      disconnectSocket();
      queryClient.clear();
      router.replace('/login');
    },
  });
}
