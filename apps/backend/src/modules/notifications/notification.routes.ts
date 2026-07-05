import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { NotificationType } from '@taskforge/shared-types';
import { asyncHandler } from '@/utils/async-handler';
import { authenticate, validate } from '@/middlewares';
import { ok, paginationMeta } from '@/utils/response';
import { paginationSchema } from '@/utils/pagination';
import { prisma } from '@/lib/prisma';
import { ApiError } from '@/utils/api-error';

export const notificationRouter = Router();

const listQuery = paginationSchema.extend({
  unreadOnly: z.coerce.boolean().optional().default(false),
  workspaceId: z.string().uuid().optional(),
});

/**
 * @openapi
 * /notifications:
 *   get: { summary: My notifications (paginated, unread filter), tags: [Notifications] }
 */
notificationRouter.get(
  '/notifications',
  authenticate,
  validate({ query: listQuery }),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as never as z.infer<typeof listQuery>;
    const where = {
      userId: req.user!.id,
      ...(q.unreadOnly ? { isRead: false } : {}),
      ...(q.workspaceId ? { workspaceId: q.workspaceId } : {}),
    };
    const [rows, total, unread] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId: req.user!.id, isRead: false } }),
    ]);
    ok(res, { notifications: rows, unreadCount: unread }, paginationMeta(q.page, q.limit, total));
  })
);

/**
 * @openapi
 * /notifications/{notificationId}/read:
 *   post: { summary: Mark one notification read, tags: [Notifications] }
 */
notificationRouter.post(
  '/notifications/:notificationId/read',
  authenticate,
  validate({ params: z.object({ notificationId: z.string().uuid() }) }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await prisma.notification.updateMany({
      where: { id: req.params.notificationId, userId: req.user!.id },
      data: { isRead: true, readAt: new Date() },
    });
    if (result.count === 0) throw ApiError.notFound('Notification');
    ok(res, null);
  })
);

/**
 * @openapi
 * /notifications/read-all:
 *   post: { summary: Mark all notifications read, tags: [Notifications] }
 */
notificationRouter.post(
  '/notifications/read-all',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await prisma.notification.updateMany({
      where: { userId: req.user!.id, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    ok(res, { marked: result.count });
  })
);

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------

const prefsSchema = z.object({
  preferences: z
    .array(
      z.object({
        type: z.nativeEnum(NotificationType),
        inApp: z.boolean(),
        email: z.boolean(),
        push: z.boolean(),
      })
    )
    .min(1)
    .max(Object.keys(NotificationType).length),
});

/**
 * @openapi
 * /notifications/preferences:
 *   get: { summary: My notification preferences (defaults where unset), tags: [Notifications] }
 *   put: { summary: Upsert notification preferences, tags: [Notifications] }
 */
notificationRouter.get(
  '/notifications/preferences',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const rows = await prisma.notificationPreference.findMany({ where: { userId: req.user!.id } });
    const byType = new Map(rows.map((r) => [r.type, r]));
    const all = Object.values(NotificationType).map(
      (type) =>
        byType.get(type) ?? {
          type,
          inApp: true,
          email: true,
          push: false,
        }
    );
    ok(res, all);
  })
);

notificationRouter.put(
  '/notifications/preferences',
  authenticate,
  validate({ body: prefsSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const prefs = req.body.preferences as Array<{
      type: NotificationType;
      inApp: boolean;
      email: boolean;
      push: boolean;
    }>;
    await prisma.$transaction(
      prefs.map((p) =>
        prisma.notificationPreference.upsert({
          where: { userId_type: { userId: req.user!.id, type: p.type } },
          create: { userId: req.user!.id, ...p },
          update: { inApp: p.inApp, email: p.email, push: p.push },
        })
      )
    );
    ok(res, null);
  })
);
