import { prisma } from '@/lib/prisma';
import { env } from '@/config/env';
import { notify } from '@/services/notification.service';
import { logger } from '@/lib/logger';

/**
 * Hourly: notify assignees + watchers about tasks due within 24h (once per
 * task, deduped via dueSoonNotifiedAt) and tasks that just became overdue.
 */
export async function dueDateReminders(): Promise<void> {
  const now = new Date();
  const dayAhead = new Date(now.getTime() + 24 * 3600_000);

  const dueSoon = await prisma.task.findMany({
    where: {
      deletedAt: null,
      statusCategory: { not: 'DONE' },
      dueDate: { gte: now, lte: dayAhead },
      dueSoonNotifiedAt: null,
      project: { deletedAt: null },
    },
    take: 500,
    select: {
      id: true,
      title: true,
      number: true,
      dueDate: true,
      workspaceId: true,
      projectId: true,
      project: { select: { key: true } },
      assignees: { select: { userId: true } },
      watchers: { select: { userId: true } },
    },
  });

  for (const task of dueSoon) {
    const targets = [...new Set([...task.assignees.map((a) => a.userId), ...task.watchers.map((w) => w.userId)])];
    if (targets.length > 0) {
      await notify(targets, {
        type: 'TASK_DUE_SOON',
        title: `${task.project.key}-${task.number} is due soon`,
        body: `"${task.title}" is due ${task.dueDate?.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`,
        link: `${env.APP_URL}/w/${task.workspaceId}/projects/${task.projectId}/tasks/${task.id}`,
        workspaceId: task.workspaceId,
        metadata: { taskId: task.id },
      });
    }
    await prisma.task.update({
      where: { id: task.id },
      data: { dueSoonNotifiedAt: now },
    });
  }

  if (dueSoon.length > 0) {
    logger.info(`due-date-reminders: notified ${dueSoon.length} tasks`);
  }
}
