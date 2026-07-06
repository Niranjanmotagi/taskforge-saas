'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Activity as ActivityIcon,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  FolderKanban,
  HardDrive,
  ListTodo,
  Users,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatBytes } from '@taskforge/shared-utils';
import { CHART_PALETTE, STATUS_CATEGORY_COLORS } from '@taskforge/shared-ui';
import { get } from '@/lib/api';
import { Topbar } from '@/components/shell/topbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress, Skeleton } from '@/components/ui/misc';
import { UserAvatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';

interface DashboardData {
  stats: {
    projects: { total: number; byStatus: Record<string, number> };
    tasks: { total: number; completed: number; overdue: number; dueToday: number; dueThisWeek: number };
    myOpenTasks: number;
    members: number;
  };
  charts: {
    tasksByStatus: Record<string, number>;
    tasksByPriority: Record<string, number>;
    completionTrend: Array<{ date: string; completed: number }>;
  };
  recentActivity: Array<{
    id: string;
    action: string;
    entityType: string;
    entityLabel: string | null;
    createdAt: string;
    actor: { id: string; name: string; avatarUrl: string | null };
  }>;
  upcomingDeadlines: Array<{
    id: string;
    title: string;
    dueDate: string;
    priority: string;
    projectId: string;
    project: { key: string; name: string; color: string };
    assignees: Array<{ user: { id: string; name: string; avatarUrl: string | null } }>;
  }>;
  subscription: { planName: string; status: string; planTier: string } | null;
  storage: { usedBytes: number; limitBytes: number };
}

const ACTION_LABELS: Record<string, string> = {
  CREATED: 'created',
  UPDATED: 'updated',
  DELETED: 'deleted',
  MOVED: 'moved',
  COMPLETED: 'completed',
  COMMENTED: 'commented on',
  ARCHIVED: 'archived',
  INVITED: 'invited',
  JOINED: 'joined',
  UPLOADED: 'uploaded',
};

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof ListTodo;
  label: string;
  value: number | string;
  hint?: string;
  tone?: 'default' | 'destructive';
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
            tone === 'destructive' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold leading-tight">{value}</p>
          <p className="truncate text-xs text-muted-foreground">
            {label}
            {hint ? ` · ${hint}` : ''}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage({ params }: { params: { workspaceId: string } }) {
  const { workspaceId } = params;
  const { data, isPending } = useQuery({
    queryKey: ['dashboard', workspaceId],
    queryFn: () => get<DashboardData>(`/workspaces/${workspaceId}/reports/dashboard`),
  });

  const statusData = data
    ? Object.entries(data.charts.tasksByStatus).map(([name, value]) => ({ name, value }))
    : [];

  return (
    <>
      <Topbar title="Dashboard" />
      <div className="flex-1 space-y-5 overflow-y-auto p-5 scrollbar-thin">
        {isPending || !data ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : (
          <>
            {/* Stat cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard icon={FolderKanban} label="Active projects" value={data.stats.projects.byStatus.ACTIVE ?? 0} hint={`${data.stats.projects.total} total`} />
              <StatCard icon={ListTodo} label="Open tasks" value={data.stats.tasks.total - data.stats.tasks.completed} hint={`${data.stats.myOpenTasks} assigned to me`} />
              <StatCard icon={CalendarClock} label="Due today" value={data.stats.tasks.dueToday} hint={`${data.stats.tasks.dueThisWeek} this week`} />
              <StatCard icon={AlertTriangle} label="Overdue" value={data.stats.tasks.overdue} tone={data.stats.tasks.overdue > 0 ? 'destructive' : 'default'} />
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              {/* Completion trend */}
              <Card className="lg:col-span-2">
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle className="text-sm">Completed tasks — last 14 days</CardTitle>
                  <Badge variant="success">
                    <CheckCircle2 className="h-3 w-3" />
                    {data.stats.tasks.completed} done all-time
                  </Badge>
                </CardHeader>
                <CardContent className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.charts.completionTrend} margin={{ left: -24, right: 8, top: 4 }}>
                      <defs>
                        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={CHART_PALETTE[0]} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={CHART_PALETTE[0]} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="date"
                        tickFormatter={(d: string) => format(new Date(d), 'MMM d')}
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                      <ChartTooltip
                        contentStyle={{
                          background: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        labelFormatter={(d) => format(new Date(String(d)), 'EEEE, MMM d')}
                      />
                      <Area
                        type="monotone"
                        dataKey="completed"
                        stroke={CHART_PALETTE[0]}
                        strokeWidth={2}
                        fill="url(#trendFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Status donut */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Tasks by status</CardTitle>
                </CardHeader>
                <CardContent className="h-56">
                  {statusData.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={3}>
                          {statusData.map((entry) => (
                            <Cell key={entry.name} fill={STATUS_CATEGORY_COLORS[entry.name] ?? CHART_PALETTE[0]} />
                          ))}
                        </Pie>
                        <ChartTooltip
                          contentStyle={{
                            background: 'hsl(var(--popover))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState icon={ListTodo} title="No tasks yet" className="py-8" />
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              {/* Upcoming deadlines */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-sm">Upcoming deadlines</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {data.upcomingDeadlines.length ? (
                    data.upcomingDeadlines.map((task) => (
                      <Link
                        key={task.id}
                        href={`/w/${workspaceId}/projects/${task.projectId}?task=${task.id}`}
                        className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-accent"
                      >
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: task.project.color }} />
                        <span className="font-mono text-xs text-muted-foreground">{task.project.key}</span>
                        <span className="min-w-0 flex-1 truncate text-sm">{task.title}</span>
                        <div className="flex -space-x-1.5">
                          {task.assignees.slice(0, 3).map((a) => (
                            <UserAvatar key={a.user.id} user={a.user} className="h-6 w-6 ring-2 ring-background" />
                          ))}
                        </div>
                        <Badge variant="warning" className="shrink-0">
                          {format(new Date(task.dueDate), 'MMM d')}
                        </Badge>
                      </Link>
                    ))
                  ) : (
                    <EmptyState icon={CalendarClock} title="Nothing due soon" description="Tasks with due dates in the next 7 days show up here." className="py-8" />
                  )}
                </CardContent>
              </Card>

              {/* Activity + storage + plan */}
              <div className="space-y-5">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Recent activity</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {data.recentActivity.length ? (
                      data.recentActivity.slice(0, 8).map((a) => (
                        <div key={a.id} className="flex items-start gap-2.5">
                          <UserAvatar user={a.actor} className="mt-0.5 h-6 w-6" />
                          <div className="min-w-0 text-sm leading-snug">
                            <span className="font-medium">{a.actor.name}</span>{' '}
                            <span className="text-muted-foreground">{ACTION_LABELS[a.action] ?? a.action.toLowerCase()}</span>{' '}
                            <span className="break-words">{a.entityLabel ?? a.entityType}</span>
                            <p className="text-[11px] text-muted-foreground">
                              {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <EmptyState icon={ActivityIcon} title="No activity yet" className="py-6" />
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="space-y-4 p-5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Users className="h-4 w-4" /> Members
                      </span>
                      <span className="font-semibold">{data.stats.members}</span>
                    </div>
                    {data.subscription && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Plan</span>
                        <Badge>{data.subscription.planName}</Badge>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <HardDrive className="h-4 w-4" /> Storage
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatBytes(data.storage.usedBytes)} / {formatBytes(data.storage.limitBytes)}
                        </span>
                      </div>
                      <Progress value={data.storage.limitBytes ? (data.storage.usedBytes / data.storage.limitBytes) * 100 : 0} />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
