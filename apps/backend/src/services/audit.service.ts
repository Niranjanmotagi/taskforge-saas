import type { Request } from 'express';
import type { AuditEvent, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export interface AuditContext {
  userId?: string | null;
  workspaceId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Fire-and-forget security audit trail. Failures are logged, never thrown —
 * an audit outage must not break user-facing flows.
 */
export function audit(event: AuditEvent, ctx: AuditContext = {}): void {
  void prisma.auditLog
    .create({
      data: {
        event,
        userId: ctx.userId ?? undefined,
        workspaceId: ctx.workspaceId ?? undefined,
        ip: ctx.ip ?? undefined,
        userAgent: ctx.userAgent ?? undefined,
        metadata: ctx.metadata,
      },
    })
    .catch((err) => logger.error(`audit write failed (${event}): ${err.message}`));
}

/** Extract audit-relevant request context. */
export function auditCtxFromRequest(req: Request): Pick<AuditContext, 'ip' | 'userAgent'> {
  return {
    ip: req.ip ?? null,
    userAgent: (req.headers['user-agent'] as string | undefined)?.slice(0, 500) ?? null,
  };
}
