import type { NotificationType, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export interface NotifyInput {
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  workspaceId?: string;
  metadata?: Prisma.InputJsonValue;
}

type RealtimeEmitter = (userId: string, notification: unknown) => void;
type EmailDispatcher = (userId: string, input: NotifyInput) => void;

// Fan-out hooks are registered by the realtime gateway / email queue at boot,
// keeping this service free of socket/queue imports (no circular deps).
let realtimeEmitter: RealtimeEmitter | null = null;
let emailDispatcher: EmailDispatcher | null = null;

export function registerRealtimeEmitter(fn: RealtimeEmitter): void {
  realtimeEmitter = fn;
}

export function registerEmailDispatcher(fn: EmailDispatcher): void {
  emailDispatcher = fn;
}

/**
 * Notify a set of users. Honors per-user NotificationPreference rows
 * (missing row = in-app + email on, push off). Never throws.
 */
export async function notify(userIds: string[], input: NotifyInput): Promise<void> {
  const targets = [...new Set(userIds)];
  if (targets.length === 0) return;

  try {
    const prefs = await prisma.notificationPreference.findMany({
      where: { userId: { in: targets }, type: input.type },
    });
    const prefByUser = new Map(prefs.map((p) => [p.userId, p]));

    const inAppTargets = targets.filter((id) => prefByUser.get(id)?.inApp ?? true);
    const emailTargets = targets.filter((id) => prefByUser.get(id)?.email ?? true);

    if (inAppTargets.length > 0) {
      const rows = await prisma.$transaction(
        inAppTargets.map((userId) =>
          prisma.notification.create({
            data: {
              userId,
              workspaceId: input.workspaceId,
              type: input.type,
              title: input.title,
              body: input.body,
              link: input.link,
              metadata: input.metadata,
            },
          })
        )
      );
      if (realtimeEmitter) {
        for (const row of rows) realtimeEmitter(row.userId, row);
      }
    }

    if (emailDispatcher) {
      for (const userId of emailTargets) emailDispatcher(userId, input);
    }
  } catch (err) {
    logger.error(`notify failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
