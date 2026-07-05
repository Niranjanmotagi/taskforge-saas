import { daysBetween, startOfDay, endOfDay, addDays } from '@taskforge/shared-utils';
import { prisma } from '@/lib/prisma';
import { ApiError } from '@/utils/api-error';

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

/** Headline stats + charts data for the workspace dashboard. */
export async function dashboard(workspaceId: string, userId: string) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekAhead = addDays(now, 7);

  const [
    projectCounts,
    taskTotal,
    taskDone,
    taskOverdue,
    dueToday,
    dueThisWeek,
    myOpenTasks,
    memberCount,
    recentActivity,
    upcomingDeadlines,
    tasksByStatus,
    tasksByPriority,
    workspace,
  ] = await Promise.all([
    prisma.project.groupBy({
      by: ['status'],
      where: { workspaceId, deletedAt: null, isTemplate: false },
      _count: true,
    }),
    prisma.task.count({ where: { workspaceId, deletedAt: null } }),
    prisma.task.count({ where: { workspaceId, deletedAt: null, statusCategory: 'DONE' } }),
    prisma.task.count({
      where: { workspaceId, deletedAt: null, statusCategory: { not: 'DONE' }, dueDate: { lt: now } },
    }),
    prisma.task.count({
      where: {
        workspaceId,
        deletedAt: null,
        statusCategory: { not: 'DONE' },
        dueDate: { gte: todayStart, lte: todayEnd },
      },
    }),
    prisma.task.count({
      where: {
        workspaceId,
        deletedAt: null,
        statusCategory: { not: 'DONE' },
        dueDate: { gt: todayEnd, lte: weekAhead },
      },
    }),
    prisma.task.count({
      where: {
        workspaceId,
        deletedAt: null,
        statusCategory: { not: 'DONE' },
        assignees: { some: { userId } },
      },
    }),
    prisma.workspaceMember.count({ where: { workspaceId } }),
    prisma.activity.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 15,
      include: { actor: { select: { id: true, name: true, avatarUrl: true } } },
    }),
    prisma.task.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        statusCategory: { not: 'DONE' },
        dueDate: { gte: now, lte: weekAhead },
      },
      orderBy: { dueDate: 'asc' },
      take: 10,
      select: {
        id: true,
        title: true,
        number: true,
        dueDate: true,
        priority: true,
        projectId: true,
        project: { select: { key: true, name: true, color: true } },
        assignees: { select: { user: { select: { id: true, name: true, avatarUrl: true } } }, take: 3 },
      },
    }),
    prisma.task.groupBy({
      by: ['statusCategory'],
      where: { workspaceId, deletedAt: null },
      _count: true,
    }),
    prisma.task.groupBy({
      by: ['priority'],
      where: { workspaceId, deletedAt: null, statusCategory: { not: 'DONE' } },
      _count: true,
    }),
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        storageUsedBytes: true,
        subscription: {
          select: {
            status: true,
            currentPeriodEnd: true,
            cancelAtPeriodEnd: true,
            plan: { select: { tier: true, name: true, storageLimitBytes: true } },
          },
        },
      },
    }),
  ]);

  // 14-day completion trend for the dashboard chart.
  const trendStart = startOfDay(addDays(now, -13));
  const completions = await prisma.task.findMany({
    where: { workspaceId, deletedAt: null, completedAt: { gte: trendStart } },
    select: { completedAt: true },
  });
  const trend: Array<{ date: string; completed: number }> = [];
  for (let i = 0; i < 14; i += 1) {
    const day = addDays(trendStart, i);
    const next = addDays(day, 1);
    trend.push({
      date: day.toISOString().slice(0, 10),
      completed: completions.filter((c) => c.completedAt! >= day && c.completedAt! < next).length,
    });
  }

  return {
    stats: {
      projects: {
        total: projectCounts.reduce((s, g) => s + g._count, 0),
        byStatus: Object.fromEntries(projectCounts.map((g) => [g.status, g._count])),
      },
      tasks: { total: taskTotal, completed: taskDone, overdue: taskOverdue, dueToday, dueThisWeek },
      myOpenTasks,
      members: memberCount,
    },
    charts: {
      tasksByStatus: Object.fromEntries(tasksByStatus.map((g) => [g.statusCategory, g._count])),
      tasksByPriority: Object.fromEntries(tasksByPriority.map((g) => [g.priority, g._count])),
      completionTrend: trend,
    },
    recentActivity,
    upcomingDeadlines,
    subscription: workspace?.subscription
      ? {
          status: workspace.subscription.status,
          planTier: workspace.subscription.plan.tier,
          planName: workspace.subscription.plan.name,
          currentPeriodEnd: workspace.subscription.currentPeriodEnd,
          cancelAtPeriodEnd: workspace.subscription.cancelAtPeriodEnd,
        }
      : null,
    storage: {
      usedBytes: Number(workspace?.storageUsedBytes ?? 0),
      limitBytes: Number(workspace?.subscription?.plan.storageLimitBytes ?? 0),
    },
  };
}

// ---------------------------------------------------------------------------
// Burndown
// ---------------------------------------------------------------------------

/**
 * Sprint burndown: for each day of the sprint, remaining (not-yet-completed)
 * work in story points (falls back to task count when no points are set).
 */
export async function burndown(workspaceId: string, projectId: string, sprintId: string) {
  const sprint = await prisma.sprint.findFirst({
    where: { id: sprintId, projectId, project: { workspaceId, deletedAt: null } },
  });
  if (!sprint) throw ApiError.notFound('Sprint');

  const tasks = await prisma.task.findMany({
    where: { sprintId, deletedAt: null },
    select: { storyPoints: true, completedAt: true, createdAt: true },
  });

  const usePoints = tasks.some((t) => (t.storyPoints ?? 0) > 0);
  const weight = (t: { storyPoints: number | null }) => (usePoints ? (t.storyPoints ?? 0) : 1);
  const totalWork = tasks.reduce((s, t) => s + weight(t), 0);

  const days = Math.max(1, daysBetween(sprint.startDate, sprint.endDate));
  const series: Array<{ date: string; remaining: number; ideal: number }> = [];
  const today = new Date();

  for (let i = 0; i <= days; i += 1) {
    const day = endOfDay(addDays(sprint.startDate, i));
    const completedByDay = tasks
      .filter((t) => t.completedAt && t.completedAt <= day)
      .reduce((s, t) => s + weight(t), 0);
    series.push({
      date: day.toISOString().slice(0, 10),
      // Future days carry null-ish remaining (chart stops at today).
      remaining: day <= endOfDay(today) ? totalWork - completedByDay : NaN,
      ideal: Math.round((totalWork - (totalWork * i) / days) * 10) / 10,
    });
  }

  return {
    sprint: { id: sprint.id, name: sprint.name, startDate: sprint.startDate, endDate: sprint.endDate },
    unit: usePoints ? 'points' : 'tasks',
    totalWork,
    series: series.map((p) => ({ ...p, remaining: Number.isNaN(p.remaining) ? null : p.remaining })),
  };
}

// ---------------------------------------------------------------------------
// Velocity
// ---------------------------------------------------------------------------

/** Story points completed per finished sprint (last 8). */
export async function velocity(workspaceId: string, projectId: string) {
  const sprints = await prisma.sprint.findMany({
    where: { projectId, project: { workspaceId, deletedAt: null }, status: 'COMPLETED' },
    orderBy: { endDate: 'desc' },
    take: 8,
  });

  const series = await Promise.all(
    sprints.reverse().map(async (sprint) => {
      const agg = await prisma.task.aggregate({
        where: { sprintId: sprint.id, deletedAt: null, statusCategory: 'DONE' },
        _sum: { storyPoints: true },
        _count: true,
      });
      return {
        sprintId: sprint.id,
        name: sprint.name,
        endDate: sprint.endDate,
        completedPoints: agg._sum.storyPoints ?? 0,
        completedTasks: agg._count,
      };
    })
  );

  const average =
    series.length > 0
      ? Math.round((series.reduce((s, p) => s + p.completedPoints, 0) / series.length) * 10) / 10
      : 0;

  return { series, averageVelocity: average };
}

// ---------------------------------------------------------------------------
// Workload
// ---------------------------------------------------------------------------

/** Open tasks + estimated minutes per member (optionally per project). */
export async function workload(workspaceId: string, projectId?: string) {
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    select: { user: { select: { id: true, name: true, avatarUrl: true } }, role: true },
  });

  const rows = await Promise.all(
    members.map(async (m) => {
      const where = {
        workspaceId,
        deletedAt: null,
        statusCategory: { not: 'DONE' as const },
        assignees: { some: { userId: m.user.id } },
        ...(projectId ? { projectId } : {}),
      };
      const [agg, overdue, byPriority] = await Promise.all([
        prisma.task.aggregate({ where, _count: true, _sum: { estimatedMinutes: true, storyPoints: true } }),
        prisma.task.count({ where: { ...where, dueDate: { lt: new Date() } } }),
        prisma.task.groupBy({ by: ['priority'], where, _count: true }),
      ]);
      return {
        user: m.user,
        role: m.role,
        openTasks: agg._count,
        overdueTasks: overdue,
        estimatedMinutes: agg._sum.estimatedMinutes ?? 0,
        storyPoints: agg._sum.storyPoints ?? 0,
        byPriority: Object.fromEntries(byPriority.map((g) => [g.priority, g._count])),
      };
    })
  );

  return rows.sort((a, b) => b.openTasks - a.openTasks);
}

// ---------------------------------------------------------------------------
// Productivity / time report
// ---------------------------------------------------------------------------

export async function timeReport(
  workspaceId: string,
  query: { from?: Date; to?: Date; projectId?: string; userId?: string }
) {
  const where = {
    workspaceId,
    deletedAt: null,
    status: 'STOPPED' as const,
    ...(query.userId ? { userId: query.userId } : {}),
    ...(query.projectId ? { task: { projectId: query.projectId } } : {}),
    ...(query.from || query.to
      ? { startedAt: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } }
      : {}),
  };

  const entries = await prisma.timeEntry.findMany({
    where,
    select: {
      durationMinutes: true,
      isBillable: true,
      hourlyRateCents: true,
      startedAt: true,
      userId: true,
      user: { select: { id: true, name: true, avatarUrl: true } },
      task: { select: { projectId: true, project: { select: { id: true, name: true, key: true, color: true } } } },
    },
  });

  const totalMinutes = entries.reduce((s, e) => s + e.durationMinutes, 0);
  const billableMinutes = entries.filter((e) => e.isBillable).reduce((s, e) => s + e.durationMinutes, 0);
  const billableAmountCents = Math.round(
    entries
      .filter((e) => e.isBillable && e.hourlyRateCents)
      .reduce((s, e) => s + (e.durationMinutes / 60) * (e.hourlyRateCents ?? 0), 0)
  );

  const byUser = new Map<string, { user: unknown; minutes: number; billableMinutes: number }>();
  const byProject = new Map<string, { project: unknown; minutes: number }>();
  for (const e of entries) {
    const u = byUser.get(e.userId) ?? { user: e.user, minutes: 0, billableMinutes: 0 };
    u.minutes += e.durationMinutes;
    if (e.isBillable) u.billableMinutes += e.durationMinutes;
    byUser.set(e.userId, u);

    const pid = e.task.project.id;
    const p = byProject.get(pid) ?? { project: e.task.project, minutes: 0 };
    p.minutes += e.durationMinutes;
    byProject.set(pid, p);
  }

  return {
    totalMinutes,
    billableMinutes,
    billableAmountCents,
    byUser: [...byUser.values()].sort((a, b) => b.minutes - a.minutes),
    byProject: [...byProject.values()].sort((a, b) => b.minutes - a.minutes),
  };
}
