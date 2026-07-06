'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { get, put, apiErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton, Switch } from '@/components/ui/misc';

interface Preference {
  type: string;
  inApp: boolean;
  email: boolean;
  push: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  TASK_ASSIGNED: 'Task assigned to me',
  TASK_UPDATED: 'Watched task updated',
  TASK_COMPLETED: 'Watched task completed',
  TASK_DUE_SOON: 'Task due soon',
  TASK_OVERDUE: 'Task overdue',
  COMMENT_ADDED: 'New comment on watched task',
  MENTION: 'Someone mentions me',
  PROJECT_INVITE: 'Added to a project',
  WORKSPACE_INVITE: 'Workspace invitations',
  MEMBER_JOINED: 'New member joins',
  CHAT_MESSAGE: 'Chat messages',
  SUBSCRIPTION_UPDATED: 'Subscription changes',
  PAYMENT_FAILED: 'Payment failures',
  SYSTEM: 'System announcements',
};

export default function NotificationSettingsPage() {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: () => get<Preference[]>('/notifications/preferences'),
  });
  const [prefs, setPrefs] = useState<Preference[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data) setPrefs(data);
  }, [data]);

  const save = useMutation({
    mutationFn: () => put('/notifications/preferences', { preferences: prefs }),
    onSuccess: () => {
      toast.success('Preferences saved');
      setDirty(false);
      void queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const toggle = (type: string, channel: 'inApp' | 'email' | 'push', value: boolean) => {
    setPrefs((prev) => prev.map((p) => (p.type === type ? { ...p, [channel]: value } : p)));
    setDirty(true);
  };

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notification preferences</CardTitle>
          <CardDescription>Choose how you want to be notified for each event type.</CardDescription>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <Skeleton className="h-72" />
          ) : (
            <>
              <div className="mb-2 grid grid-cols-[1fr_60px_60px_60px] gap-2 text-xs font-medium text-muted-foreground">
                <span>Event</span>
                <span className="text-center">In-app</span>
                <span className="text-center">Email</span>
                <span className="text-center">Push</span>
              </div>
              <div className="divide-y">
                {prefs.map((pref) => (
                  <div key={pref.type} className="grid grid-cols-[1fr_60px_60px_60px] items-center gap-2 py-2.5 text-sm">
                    <span>{TYPE_LABELS[pref.type] ?? pref.type}</span>
                    <span className="flex justify-center">
                      <Switch checked={pref.inApp} onCheckedChange={(v) => toggle(pref.type, 'inApp', v)} />
                    </span>
                    <span className="flex justify-center">
                      <Switch checked={pref.email} onCheckedChange={(v) => toggle(pref.type, 'email', v)} />
                    </span>
                    <span className="flex justify-center">
                      <Switch checked={pref.push} onCheckedChange={(v) => toggle(pref.type, 'push', v)} />
                    </span>
                  </div>
                ))}
              </div>
              <Button className="mt-4" onClick={() => save.mutate()} loading={save.isPending} disabled={!dirty}>
                Save preferences
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
