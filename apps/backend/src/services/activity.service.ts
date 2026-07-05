import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export interface ActivityInput {
  workspaceId: string;
  actorId: string;
  action: string; // ActivityAction value from shared-types
  entityType: string;
  entityId: string;
  entityLabel?: string | null;
  projectId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Fire-and-forget workspace activity feed writer. Never throws — the feed is
 * an enhancement, not a dependency of the calling flow.
 */
export function recordActivity(input: ActivityInput): void {
  void prisma.activity
    .create({
      data: {
        workspaceId: input.workspaceId,
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        entityLabel: input.entityLabel ?? undefined,
        projectId: input.projectId ?? undefined,
        metadata: input.metadata,
      },
    })
    .catch((err) => logger.error(`activity write failed: ${err.message}`));
}
