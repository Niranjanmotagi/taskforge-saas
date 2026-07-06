'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { CheckCircle2, Play, Plus, Target, Zap } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Area,
  AreaChart,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART_PALETTE } from '@taskforge/shared-ui';
import { get, post, patch, apiErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress, Skeleton, Textarea } from '@/components/ui/misc';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';

interface SprintRow {
  id: string;
  name: string;
  goal: string | null;
  status: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  startDate: string;
  endDate: string;
  taskCount: number;
  completedCount: number;
}

interface BurndownData {
  unit: string;
  totalWork: number;
  series: Array<{ date: string; remaining: number | null; ideal: number }>;
}

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'secondary'> = {
  ACTIVE: 'default',
  COMPLETED: 'success',
  PLANNED: 'secondary',
  CANCELLED: 'secondary',
};

function Burndown({ workspaceId, projectId, sprintId }: { workspaceId: string; projectId: string; sprintId: string }) {
  const { data } = useQuery({
    queryKey: ['burndown', workspaceId, projectId, sprintId],
    queryFn: () => get<BurndownData>(`/workspaces/${workspaceId}/projects/${projectId}/reports/burndown/${sprintId}`),
  });

  if (!data) return <Skeleton className="h-44" />;
  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data.series} margin={{ left: -24, right: 8, top: 4 }}>
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) => format(new Date(d), 'd')}
            fontSize={10}
            tickLine={false}
            axisLine={false}
          />
          <YAxis fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
          <ChartTooltip
            contentStyle={{
              background: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Line type="monotone" dataKey="ideal" stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" dot={false} name={`Ideal (${data.unit})`} />
          <Line type="monotone" dataKey="remaining" stroke={CHART_PALETTE[0]} strokeWidth={2} dot={false} connectNulls={false} name={`Remaining (${data.unit})`} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SprintsPanel({ workspaceId, projectId }: { workspaceId: string; projectId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', goal: '', startDate: '', endDate: '' });

  const { data: sprints, isPending } = useQuery({
    queryKey: ['sprints', workspaceId, projectId],
    queryFn: () => get<SprintRow[]>(`/workspaces/${workspaceId}/projects/${projectId}/sprints`),
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['sprints', workspaceId, projectId] });

  const create = useMutation({
    mutationFn: () =>
      post(`/workspaces/${workspaceId}/projects/${projectId}/sprints`, {
        name: form.name,
        goal: form.goal || undefined,
        startDate: form.startDate,
        endDate: form.endDate,
      }),
    onSuccess: () => {
      setOpen(false);
      setForm({ name: '', goal: '', startDate: '', endDate: '' });
      invalidate();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const activate = useMutation({
    mutationFn: (sprintId: string) =>
      patch(`/workspaces/${workspaceId}/projects/${projectId}/sprints/${sprintId}`, { status: 'ACTIVE' }),
    onSuccess: invalidate,
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const complete = useMutation({
    mutationFn: (sprintId: string) =>
      post(`/workspaces/${workspaceId}/projects/${projectId}/sprints/${sprintId}/complete`, {}),
    onSuccess: (data) => {
      const moved = (data as { openTasksMoved: number }).openTasksMoved;
      toast.success(`Sprint completed${moved ? ` — ${moved} open task(s) returned to backlog` : ''}`);
      invalidate();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <div className="space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Sprints</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus /> New sprint
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create sprint</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate();
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Sprint 1" required />
              </div>
              <div className="space-y-1.5">
                <Label>Goal</Label>
                <Textarea value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} rows={2} placeholder="What does success look like?" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Start</Label>
                  <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
                </div>
                <div className="space-y-1.5">
                  <Label>End</Label>
                  <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required />
                </div>
              </div>
              <Button type="submit" className="w-full" loading={create.isPending}>
                Create sprint
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isPending ? (
        <Skeleton className="h-64" />
      ) : sprints?.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {sprints.map((sprint) => (
            <Card key={sprint.id}>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Zap className="h-4 w-4 text-primary" /> {sprint.name}
                    <Badge variant={STATUS_VARIANT[sprint.status]}>{sprint.status}</Badge>
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {format(new Date(sprint.startDate), 'MMM d')} → {format(new Date(sprint.endDate), 'MMM d')}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  {sprint.status === 'PLANNED' && (
                    <Button size="sm" variant="outline" onClick={() => activate.mutate(sprint.id)}>
                      <Play /> Start
                    </Button>
                  )}
                  {sprint.status === 'ACTIVE' && (
                    <Button size="sm" variant="outline" onClick={() => complete.mutate(sprint.id)}>
                      <CheckCircle2 /> Complete
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {sprint.goal && (
                  <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                    <Target className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {sprint.goal}
                  </p>
                )}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {sprint.completedCount}/{sprint.taskCount} tasks
                    </span>
                    <span>{sprint.taskCount ? Math.round((sprint.completedCount / sprint.taskCount) * 100) : 0}%</span>
                  </div>
                  <Progress value={sprint.taskCount ? (sprint.completedCount / sprint.taskCount) * 100 : 0} />
                </div>
                {sprint.status !== 'PLANNED' && (
                  <Burndown workspaceId={workspaceId} projectId={projectId} sprintId={sprint.id} />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Zap}
          title="No sprints yet"
          description="Create a sprint, assign backlog tasks to it, and track the burndown here."
        />
      )}
    </div>
  );
}
