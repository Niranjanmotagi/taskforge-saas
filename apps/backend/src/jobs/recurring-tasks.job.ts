import { rankBetween } from '@taskforge/shared-utils';
import { RecurrenceFrequency } from '@taskforge/shared-types';
import { prisma } from '@/lib/prisma';
import { computeNextRun } from '@/modules/tasks/task-extras.service';
import { logger } from '@/lib/logger';

/**
 * Hourly: for each recurrence whose nextRunAt has passed, clone the template
 * task into a fresh open task and advance nextRunAt. Expired rules deactivate.
 */
export async function spawnRecurringTasks(): Promise<void> {
  const now = new Date();
  const due = await prisma.taskRecurrence.findMany({
    where: { isActive: true, nextRunAt: { lte: now } },
    take: 200,
    include: {
      task: {
        include: {
          column: { select: { category: true } },
          labels: { select: { labelId: true } },
          assignees: { select: { userId: true } },
          checklist: { orderBy: { position: 'asc' } },
        },
      },
    },
  });

  let spawned = 0;
  for (const rule of due) {
    const template = rule.task;
    if (template.deletedAt) {
      await prisma.taskRecurrence.update({ where: { id: rule.id }, data: { isActive: false } });
      continue;
    }
    if (rule.endsAt && rule.endsAt < now) {
      await prisma.taskRecurrence.update({ where: { id: rule.id }, data: { isActive: false } });
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const bumped = await tx.project.update({
        where: { id: template.projectId },
        data: { taskCounter: { increment: 1 } },
        select: { taskCounter: true },
      });
      const last = await tx.task.findFirst({
        where: { projectId: template.projectId, columnId: template.columnId, deletedAt: null },
        orderBy: { position: 'desc' },
        select: { position: true },
      });

      await tx.task.create({
        data: {
          workspaceId: template.workspaceId,
          projectId: template.projectId,
          columnId: template.columnId,
          number: bumped.taskCounter,
          title: template.title,
          description: template.description,
          priority: template.priority,
          statusCategory: template.column?.category ?? 'TODO',
          position: rankBetween(last?.position ?? null, null),
          estimatedMinutes: template.estimatedMinutes,
          storyPoints: template.storyPoints,
          creatorId: template.creatorId,
          dueDate: rule.nextRunAt,
          assignees: { create: template.assignees.map((a) => ({ userId: a.userId })) },
          labels: { create: template.labels.map((l) => ({ labelId: l.labelId })) },
          checklist: {
            create: template.checklist.map((c) => ({ title: c.title, position: c.position })),
          },
          watchers: { create: template.assignees.map((a) => ({ userId: a.userId })) },
        },
      });

      await tx.taskRecurrence.update({
        where: { id: rule.id },
        data: {
          lastSpawnedAt: now,
          nextRunAt: computeNextRun(
            rule.nextRunAt,
            rule.frequency as RecurrenceFrequency,
            rule.interval,
            rule.daysOfWeek
          ),
        },
      });
    });
    spawned += 1;
  }

  if (spawned > 0) logger.info(`recurring-tasks: spawned ${spawned} tasks`);
}
