'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Clock, DollarSign, Pause, Play, Square, Timer, Trash2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatDuration, formatMoney } from '@taskforge/shared-utils';
import { get, post, del, apiErrorMessage } from '@/lib/api';
import { Topbar } from '@/components/shell/topbar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/misc';
import { UserAvatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';

interface TimeEntry {
  id: string;
  description: string | null;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number;
  status: 'RUNNING' | 'PAUSED' | 'STOPPED';
  isBillable: boolean;
  hourlyRateCents: number | null;
  isManual: boolean;
  pausedAt?: string | null;
  task: { id: string; title: string; number: number; project: { id: string; key: string; name: string } };
  user: { id: string; name: string; avatarUrl: string | null };
}

/** Live elapsed readout for the active timer (banked minutes + running span). */
function LiveElapsed({ entry }: { entry: TimeEntry }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  let minutes = entry.durationMinutes;
  if (entry.status === 'RUNNING') {
    const runningSince = new Date(entry.pausedAt ?? entry.startedAt);
    minutes += Math.max(0, Math.round((Date.now() - runningSince.getTime()) / 60_000));
  }
  return <span className="font-mono text-2xl font-bold">{formatDuration(Math.max(minutes, 1))}</span>;
}

export default function TimePage({ params }: { params: { workspaceId: string } }) {
  const { workspaceId } = params;
  const queryClient = useQueryClient();

  const { data: active } = useQuery({
    queryKey: ['active-timer', workspaceId],
    queryFn: () => get<TimeEntry | null>(`/workspaces/${workspaceId}/time/active`),
    refetchInterval: 60_000,
  });

  const { data: entries, isPending } = useQuery({
    queryKey: ['time-entries', workspaceId],
    queryFn: () =>
      get<{ entries: TimeEntry[]; totalMinutes: number; billableAmountCents: number }>(
        `/workspaces/${workspaceId}/time/entries`,
        { limit: 50 }
      ),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['active-timer', workspaceId] });
    void queryClient.invalidateQueries({ queryKey: ['time-entries', workspaceId] });
  };

  const timerAction = (action: 'pause' | 'resume' | 'stop') =>
    post(`/workspaces/${workspaceId}/time/${action}`)
      .then(invalidate)
      .catch((err) => toast.error(apiErrorMessage(err)));

  const deleteEntry = useMutation({
    mutationFn: (entryId: string) => del(`/workspaces/${workspaceId}/time/entries/${entryId}`),
    onSuccess: invalidate,
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <>
      <Topbar title="Time Tracking" />
      <div className="flex-1 space-y-5 overflow-y-auto p-5 scrollbar-thin">
        {/* Active timer */}
        {active ? (
          <Card className="border-primary/50">
            <CardContent className="flex flex-wrap items-center gap-4 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Timer className="h-5 w-5 animate-pulse text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {active.task.project.key}-{active.task.number} · {active.task.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  Started {format(new Date(active.startedAt), 'HH:mm')}
                  {active.isBillable ? ' · billable' : ''}
                  {active.status === 'PAUSED' ? ' · paused' : ''}
                </p>
              </div>
              <LiveElapsed entry={active} />
              <div className="flex gap-1.5">
                {active.status === 'RUNNING' ? (
                  <Button variant="outline" size="icon" onClick={() => timerAction('pause')} title="Pause">
                    <Pause />
                  </Button>
                ) : (
                  <Button variant="outline" size="icon" onClick={() => timerAction('resume')} title="Resume">
                    <Play />
                  </Button>
                )}
                <Button variant="destructive" size="icon" onClick={() => timerAction('stop')} title="Stop">
                  <Square />
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" /> No timer running.
            </CardContent>
          </Card>
        )}

        {/* Totals */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatDuration(entries?.totalMinutes ?? 0)}</p>
                <p className="text-xs text-muted-foreground">Tracked (visible entries)</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 text-success">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatMoney(entries?.billableAmountCents ?? 0)}</p>
                <p className="text-xs text-muted-foreground">Billable amount</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Entries table */}
        {isPending ? (
          <Skeleton className="h-64" />
        ) : entries?.entries.length ? (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Task</th>
                  <th className="px-3 py-2 font-medium">Person</th>
                  <th className="px-3 py-2 font-medium">Started</th>
                  <th className="px-3 py-2 font-medium">Duration</th>
                  <th className="px-3 py-2 font-medium">Billable</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {entries.entries.map((entry) => (
                  <tr key={entry.id} className="group">
                    <td className="max-w-xs truncate px-3 py-2.5">
                      <span className="font-mono text-xs text-muted-foreground">
                        {entry.task.project.key}-{entry.task.number}
                      </span>{' '}
                      {entry.task.title}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-1.5">
                        <UserAvatar user={entry.user} className="h-5 w-5" />
                        <span className="text-xs">{entry.user.name}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {format(new Date(entry.startedAt), 'MMM d, HH:mm')}
                      {entry.isManual && ' (manual)'}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs">{formatDuration(entry.durationMinutes)}</td>
                    <td className="px-3 py-2.5">
                      {entry.isBillable ? (
                        <Badge variant="success">
                          {entry.hourlyRateCents
                            ? formatMoney(Math.round((entry.durationMinutes / 60) * entry.hourlyRateCents))
                            : 'billable'}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {entry.status === 'STOPPED' && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={() => deleteEntry.mutate(entry.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={Clock} title="No time tracked yet" description="Start a timer on a task and entries will appear here." />
        )}
      </div>
    </>
  );
}
