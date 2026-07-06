import { prisma } from '@/lib/prisma';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import { registerEmailDispatcher } from '@/services/notification.service';
import { emailTemplates } from '@/lib/email-templates';
import { enqueueEmail, startEmailWorker } from './email.queue';

/**
 * Boot BullMQ workers and register the notification->email bridge.
 */
export function startWorkers(): void {
  if (env.isTest) return;

  startEmailWorker();

  // Notification email fanout goes through the queue.
  registerEmailDispatcher((userId, input) => {
    void (async () => {
      const user = await prisma.user.findFirst({
        where: { id: userId, deletedAt: null, isActive: true },
        select: { email: true },
      });
      if (!user) return;
      const template = emailTemplates.notification(
        input.title,
        input.body ?? '',
        input.link ?? env.APP_URL
      );
      await enqueueEmail({ to: user.email, ...template });
    })().catch((err) => logger.error(`notification email dispatch failed: ${err.message}`));
  });

  logger.info('queues: email worker started');
}
