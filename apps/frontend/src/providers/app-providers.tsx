'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { refreshAccessToken, get } from '@/lib/api';
import { useAuthStore, type SessionUser } from '@/stores/auth-store';

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}

/** Attempts a silent session restore from the refresh cookie on first load. */
function SessionHydrator({ children }: { children: ReactNode }) {
  const setUser = useAuthStore((s) => s.setUser);
  const setHydrated = useAuthStore((s) => s.setHydrated);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = await refreshAccessToken();
      if (token && !cancelled) {
        try {
          const me = await get<SessionUser & { workspaces: unknown[] }>('/auth/me');
          if (!cancelled) setUser(me);
        } catch {
          /* profile fetch failure is non-fatal */
        }
      }
      if (!cancelled) setHydrated();
    })();
    return () => {
      cancelled = true;
    };
  }, [setUser, setHydrated]);

  return <>{children}</>;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <SessionHydrator>{children}</SessionHydrator>
        <Toaster richColors position="bottom-right" closeButton />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
