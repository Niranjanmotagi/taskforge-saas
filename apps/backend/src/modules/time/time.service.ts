import type { Prisma } from '@prisma/client';
import { PERMISSIONS, roleHasPermission, TimerStatus, type WorkspaceRole } from '@taskforge/shared-types';
import { prisma } from '@/lib/prisma';
import { ApiError } from '@/utils/api-error';
import { toSkipTake, type Pagination } from '@/utils/pagination';

const ENTRY_INCLUDE = {
  task: { select: { id: true, title: true, number: true, project: { select: { id: true, key: true, name: true } } } },
  user: { select: { id: true, name: true, avatarUrl: true } },
} as const;

async function assertTask(workspaceId: string, taskId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, workspaceId, deletedAt: null },
    select: { id: true },
  });
  if (!task) throw ApiError.notFound('Task');
}

/** Minutes elapsed since `from`, rounded to the nearest minute. */
function minutesSince(from: Date): number {
  return Math.max(0, Math.round((Date.now() - from.getTime()) / 60_000));
}

// ---------------------------------------------------------------------------
// Timer lifecycle — one running timer per user
// ---------------------------------------------------------------------------

export async function getActiveTimer(workspaceId: string, userId: string) {
  return prisma.timeEntry.findFirst({
    where: { workspaceId, userId, status: { in: [TimerStatus.RUNNING, TimerStatus.PAUSED] }, deletedAt: null },
    include: ENTRY_INCLUDE,
  });
}

export async function startTimer(
  workspaceId: string,
  userId: string,
  input: { taskId: string; description?: string; isBillable?: boolean; hourlyRateCents?: number }
) {
  await assertTask(workspaceId, input.taskId);

  // Stop any running/paused timer anywhere for this user (single active timer).
  const existing = await prisma.timeEntry.findFirst({
    where: { userId, status: { in: [TimerStatus.RUNNING, TimerStatus.PAUSED] }, deletedAt: null },
  });
  let stoppedPrevious: string | null = null;
  if (existing) {
    await stopTimerInternal(existing.id);
    stoppedPrevious = existing.id;
  }

  const entry = await prisma.timeEntry.create({
    data: {
      workspaceId,
      taskId: input.taskId,
      userId,
      description: input.description,
      startedAt: new Date(),
      status: TimerStatus.RUNNING,
      isBillable: input.isBillable ?? false,
      hourlyRateCents: input.hourlyRateCents,
    },
    include: ENTRY_INCLUDE,
  });

  return { entry, stoppedPrevious };
}

export async function pauseTimer(workspaceId: string, userId: string) {
  const entry = await prisma.timeEntry.findFirst({
    where: { workspaceId, userId, status: TimerStatus.RUNNING, deletedAt: null },
  });
  if (!entry) throw ApiError.notFound('Running timer');

  // Bank elapsed time, remember pause moment.
  const lastResume = entry.pausedAt ?? entry.startedAt;
  return prisma.timeEntry.update({
    where: { id: entry.id },
    data: {
      status: TimerStatus.PAUSED,
      durationMinutes: entry.durationMinutes + minutesSince(lastResume),
      pausedAt: new Date(),
    },
    include: ENTRY_INCLUDE,
  });
}

export async function resumeTimer(workspaceId: string, userId: string) {
  const entry = await prisma.timeEntry.findFirst({
    where: { workspaceId, userId, status: TimerStatus.PAUSED, deletedAt: null },
  });
  if (!entry) throw ApiError.notFound('Paused timer');

  // pausedAt becomes the new "running since" marker.
  return prisma.timeEntry.update({
    where: { id: entry.id },
    data: { status: TimerStatus.RUNNING, pausedAt: new Date() },
    include: ENTRY_INCLUDE,
  });
}

async function stopTimerInternal(entryId: string) {
  const entry = await prisma.timeEntry.findUniqueOrThrow({ where: { id: entryId } });
  let duration = entry.durationMinutes;
  if (entry.status === TimerStatus.RUNNING) {
    const lastResume = entry.pausedAt ?? entry.startedAt;
    duration += minutesSince(lastResume);
  }
  return prisma.timeEntry.update({
    where: { id: entryId },
    data: {
      status: TimerStatus.STOPPED,
      endedAt: new Date(),
      durationMinutes: Math.max(duration, 1),
      pausedAt: null,
    },
    include: ENTRY_INCLUDE,
  });
}

export async function stopTimer(workspaceId: string, userId: string) {
  const entry = await prisma.timeEntry.findFirst({
    where: {
      workspaceId,
      userId,
      status: { in: [TimerStatus.RUNNING, TimerStatus.PAUSED] },
      deletedAt: null,
    },
  });
  if (!entry) throw ApiError.notFound('Active timer');
  return stopTimerInternal(entry.id);
}

// ---------------------------------------------------------------------------
// Manual entries & listing
// ---------------------------------------------------------------------------

export async function createManualEntry(
  workspaceId: string,
  userId: string,
  input: {
    taskId: string;
    description?: string;
    startedAt: Date;
    endedAt: Date;
    isBillable?: boolean;
    hourlyRateCents?: number;
  }
) {
  await assertTask(workspaceId, input.taskId);
  const durationMinutes = Math.max(
    1,
    Math.round((input.endedAt.getTime() - input.startedAt.getTime()) / 60_000)
  );
  return prisma.timeEntry.create({
    data: {
      workspaceId,
      taskId: input.taskId,
      userId,
      description: input.description,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      durationMinutes,
      status: TimerStatus.STOPPED,
      isBillable: input.isBillable ?? false,
      hourlyRateCents: input.hourlyRateCents,
      isManual: true,
    },
    include: ENTRY_INCLUDE,
  });
}

export async function listEntries(
  workspaceId: string,
  actor: { userId: string; role: WorkspaceRole },
  query: Pagination & {
    taskId?: string;
    userId?: string;
    projectId?: string;
    from?: Date;
    to?: Date;
    billableOnly?: boolean;
  }
) {
  // Members without TIME_VIEW_ALL only ever see their own entries.
  const canViewAll = roleHasPermission(actor.role, PERMISSIONS.TIME_VIEW_ALL);
  const userFilter = canViewAll ? query.userId : actor.userId;

  const where: Prisma.TimeEntryWhereInput = {
    workspaceId,
    deletedAt: null,
    ...(userFilter ? { userId: userFilter } : {}),
    ...(query.taskId ? { taskId: query.taskId } : {}),
    ...(query.projectId ? { task: { projectId: query.projectId } } : {}),
    ...(query.from || query.to
      ? { startedAt: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } }
      : {}),
    ...(query.billableOnly ? { isBillable: true } : {}),
  };

  const [rows, total, totals] = await Promise.all([
    prisma.timeEntry.findMany({
      where,
      include: ENTRY_INCLUDE,
      orderBy: { startedAt: 'desc' },
      ...toSkipTake(query),
    }),
    prisma.timeEntry.count({ where }),
    prisma.timeEntry.aggregate({ where, _sum: { durationMinutes: true } }),
  ]);

  // Billable amount = sum(duration/60 * rate) — computed per row to respect rates.
  const billableRows = await prisma.timeEntry.findMany({
    where: { ...where, isBillable: true, hourlyRateCents: { not: null } },
    select: { durationMinutes: true, hourlyRateCents: true },
  });
  const billableAmountCents = Math.round(
    billableRows.reduce((sum, r) => sum + (r.durationMinutes / 60) * (r.hourlyRateCents ?? 0), 0)
  );

  return {
    entries: rows,
    total,
    totalMinutes: totals._sum.durationMinutes ?? 0,
    billableAmountCents,
  };
}

export async function deleteEntry(
  workspaceId: string,
  entryId: string,
  actor: { userId: string; role: WorkspaceRole }
): Promise<void> {
  const entry = await prisma.timeEntry.findFirst({
    where: { id: entryId, workspaceId, deletedAt: null },
  });
  if (!entry) throw ApiError.notFound('Time entry');
  const canManageAll = roleHasPermission(actor.role, PERMISSIONS.TIME_VIEW_ALL);
  if (entry.userId !== actor.userId && !canManageAll) {
    throw ApiError.forbidden('You can only delete your own time entries');
  }
  await prisma.timeEntry.update({ where: { id: entryId }, data: { deletedAt: new Date() } });
}
