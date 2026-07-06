'use client';

import { useState } from 'react';
import { BarChart3, Clock, TrendingUp, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatDuration } from '@taskforge/shared-utils';
import { CHART_PALETTE, PRIORITY_COLORS } from '@taskforge/shared-ui';
import { get } from '@/lib/api';
import { useProjects } from '@/hooks/use-projects';
import { Topbar } from '@/components/shell/topbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/misc';
import { UserAvatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface WorkloadRow {
  user: { id: string; name: string; avatarUrl: string | null };
  role: string;
  openTasks: number;
  overdueTasks: number;
  estimatedMinutes: number;
  storyPoints: number;
  byPriority: Record<string, number>;
}

interface VelocityData {
  series: Array<{ sprintId: string; name: string; completedPoints: number; completedTasks: number }>;
  averageVelocity: number;
}

interface TimeReport {
  totalMinutes: number;
  billableMinutes: number;
  billableAmountCents: number;
  byUser: Array<{ user: { id: string; name: string; avatarUrl: string | null }; minutes: number; billableMinutes: number }>;
  byProject: Array<{ project: { id: string; name: string; key: string; color: string }; minutes: number }>;
}

const chartTooltipStyle = {
  background: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  fontSize: 12,
};

export default function ReportsPage({ params }: { params: { workspaceId: string } }) {
  const { workspaceId } = params;
  const { data: projects } = useProjects(workspaceId);
  const [projectId, setProjectId] = useState<string>('all');

  const { data: workload, isPending: workloadPending } = useQuery({
    queryKey: ['workload', workspaceId, projectId],
    queryFn: () =>
      get<WorkloadRow[]>(`/workspaces/${workspaceId}/reports/workload`, {
        projectId: projectId === 'all' ? undefined : projectId,
      }),
  });

  const { data: velocity } = useQuery({
    queryKey: ['velocity', workspaceId, projectId],
    queryFn: () => get<VelocityData>(`/workspaces/${workspaceId}/projects/${projectId}/reports/velocity`),
    enabled: projectId !== 'all',
  });

  const { data: timeReport } = useQuery({
    queryKey: ['time-report', workspaceId, projectId],
    queryFn: () =>
      get<TimeReport>(`/workspaces/${workspaceId}/reports/time`, {
        projectId: projectId === 'all' ? undefined : projectId,
      }),
  });

  return (
    <>
      <Topbar title="Reports" />
      <div className="flex-1 space-y-5 overflow-y-auto p-5 scrollbar-thin">
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger className="w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {projects?.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Workload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-primary" /> Team workload
            </CardTitle>
          </CardHeader>
          <CardContent>
            {workloadPending ? (
              <Skeleton className="h-48" />
            ) : workload?.length ? (
              <div className="space-y-3">
                {workload.map((row) => (
                  <div key={row.user.id} className="flex items-center gap-3">
                    <UserAvatar user={row.user} className="h-8 w-8" />
                    <div className="w-40 min-w-0">
                      <p className="truncate text-sm font-medium">{row.user.name}</p>
                      <p className="text-[11px] text-muted-foreground">{row.role}</p>
                    </div>
                    <div className="flex h-5 flex-1 overflow-hidden rounded-full bg-secondary">
                      {(['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE'] as const).map((priority) => {
                        const count = row.byPriority[priority] ?? 0;
                        const max = Math.max(...workload.map((w) => w.openTasks), 1);
                        return count > 0 ? (
                          <div
                            key={priority}
                            className="h-full"
                            style={{ width: `${(count / max) * 100}%`, backgroundColor: PRIORITY_COLORS[priority] }}
                            title={`${priority}: ${count}`}
                          />
                        ) : null;
                      })}
                    </div>
                    <div className="w-32 text-right text-xs text-muted-foreground">
                      {row.openTasks} open
                      {row.overdueTasks > 0 && (
                        <Badge variant="destructive" className="ml-1.5 text-[10px]">
                          {row.overdueTasks} overdue
                        </Badge>
                      )}
                    </div>
                    <div className="w-20 text-right text-xs text-muted-foreground">
                      {formatDuration(row.estimatedMinutes)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={Users} title="No workload data" className="py-8" />
            )}
          </CardContent>
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* Velocity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4 text-primary" /> Velocity
                {velocity && velocity.series.length > 0 && (
                  <Badge variant="secondary" className="ml-auto">
                    avg {velocity.averageVelocity} pts
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              {projectId === 'all' ? (
                <EmptyState icon={TrendingUp} title="Pick a project" description="Velocity is measured per project." className="py-8" />
              ) : velocity?.series.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={velocity.series} margin={{ left: -24, top: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <ChartTooltip contentStyle={chartTooltipStyle} cursor={{ fill: 'hsl(var(--accent))' }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="completedPoints" name="Story points" fill={CHART_PALETTE[0]} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="completedTasks" name="Tasks" fill={CHART_PALETTE[2]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState icon={TrendingUp} title="No completed sprints yet" className="py-8" />
              )}
            </CardContent>
          </Card>

          {/* Time by project */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-primary" /> Time by project
                {timeReport && (
                  <Badge variant="secondary" className="ml-auto">
                    {formatDuration(timeReport.totalMinutes)} total
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              {timeReport?.byProject.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timeReport.byProject.map((p) => ({ name: p.project.key, minutes: p.minutes, color: p.project.color }))} layout="vertical" margin={{ left: -12, top: 4 }}>
                    <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatDuration(v)} />
                    <YAxis type="category" dataKey="name" fontSize={11} tickLine={false} axisLine={false} width={60} />
                    <ChartTooltip contentStyle={chartTooltipStyle} formatter={(v) => formatDuration(Number(v))} cursor={{ fill: 'hsl(var(--accent))' }} />
                    <Bar dataKey="minutes" name="Tracked" radius={[0, 4, 4, 0]}>
                      {timeReport.byProject.map((p) => (
                        <Cell key={p.project.id} fill={p.project.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState icon={BarChart3} title="No time tracked" className="py-8" />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Time by person */}
        {timeReport?.byUser.length ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Time by person</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {timeReport.byUser.map((row) => {
                const max = Math.max(...timeReport.byUser.map((u) => u.minutes), 1);
                return (
                  <div key={(row.user as { id: string }).id} className="flex items-center gap-3">
                    <UserAvatar user={row.user as { id: string; name: string; avatarUrl: string | null }} className="h-7 w-7" />
                    <span className="w-40 truncate text-sm">{(row.user as { name: string }).name}</span>
                    <div className="h-4 flex-1 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${(row.minutes / max) * 100}%` }}
                      />
                    </div>
                    <span className="w-24 text-right font-mono text-xs text-muted-foreground">
                      {formatDuration(row.minutes)}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}
