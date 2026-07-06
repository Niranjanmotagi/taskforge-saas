'use client';

import { formatDistanceToNow } from 'date-fns';
import { Laptop, LogOut, ShieldAlert, Smartphone } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { get, post, del, apiErrorMessage } from '@/lib/api';
import { useLogout } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/misc';

interface SessionRow {
  id: string;
  browser: string | null;
  os: string | null;
  ip: string | null;
  lastActivityAt: string;
  createdAt: string;
  isCurrent: boolean;
}

export default function SessionsSettingsPage() {
  const queryClient = useQueryClient();
  const logout = useLogout();

  const { data: sessions, isPending } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => get<SessionRow[]>('/auth/sessions'),
  });

  const revoke = useMutation({
    mutationFn: (sessionId: string) => del(`/auth/sessions/${sessionId}`),
    onSuccess: () => {
      toast.success('Session revoked');
      void queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const logoutAll = useMutation({
    mutationFn: () => post('/auth/logout-all'),
    onSuccess: () => logout.mutate(),
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active sessions</CardTitle>
          <CardDescription>
            Devices currently signed in to your account. Revoke anything you don&apos;t recognize.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <Skeleton className="h-40" />
          ) : (
            <div className="divide-y">
              {sessions?.map((session) => {
                const isMobile = session.os?.toLowerCase().includes('android') || session.os?.toLowerCase().includes('ios');
                const Icon = isMobile ? Smartphone : Laptop;
                return (
                  <div key={session.id} className="flex items-center gap-3 py-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {session.browser ?? 'Unknown browser'} · {session.os ?? 'Unknown OS'}
                        {session.isCurrent && <Badge className="ml-2">This device</Badge>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {session.ip ?? 'unknown IP'} · active{' '}
                        {formatDistanceToNow(new Date(session.lastActivityAt), { addSuffix: true })}
                      </p>
                    </div>
                    {!session.isCurrent && (
                      <Button variant="outline" size="sm" onClick={() => revoke.mutate(session.id)}>
                        Revoke
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-4 w-4 text-destructive" /> Sign out everywhere
          </CardTitle>
          <CardDescription>
            Revokes every session including this one. Use this if you suspect your account is compromised.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" loading={logoutAll.isPending} onClick={() => logoutAll.mutate()}>
            <LogOut /> Sign out of all devices
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
