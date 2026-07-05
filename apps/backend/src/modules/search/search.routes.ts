import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { PERMISSIONS } from '@taskforge/shared-types';
import { asyncHandler } from '@/utils/async-handler';
import { authenticate, authorize, tenantScope, validate, workspaceIdParam } from '@/middlewares';
import { ok } from '@/utils/response';
import { prisma } from '@/lib/prisma';

export const searchRouter = Router();

const searchQuery = z.object({
  q: z.string().trim().min(1, 'Search query is required').max(200),
  types: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',') : ['tasks', 'projects', 'members', 'labels', 'messages'])),
  limit: z.coerce.number().int().min(1).max(25).default(5),
});

/**
 * @openapi
 * /workspaces/{workspaceId}/search:
 *   get:
 *     summary: Global workspace search (tasks, projects, members, labels, messages)
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: types
 *         schema: { type: string, example: "tasks,projects" }
 */
searchRouter.get(
  '/workspaces/:workspaceId/search',
  authenticate,
  validate({ params: workspaceIdParam, query: searchQuery }),
  tenantScope,
  authorize(PERMISSIONS.WORKSPACE_VIEW),
  asyncHandler(async (req: Request, res: Response) => {
    const { q, types, limit } = req.query as never as z.infer<typeof searchQuery>;
    const workspaceId = req.workspace!.id;
    const userId = req.user!.id;
    const contains = { contains: q, mode: 'insensitive' as const };

    const [tasks, projects, members, labels, messages] = await Promise.all([
      types.includes('tasks')
        ? prisma.task.findMany({
            where: {
              workspaceId,
              deletedAt: null,
              project: { deletedAt: null },
              OR: [{ title: contains }, { description: contains }],
            },
            take: limit,
            orderBy: { updatedAt: 'desc' },
            select: {
              id: true,
              title: true,
              number: true,
              statusCategory: true,
              priority: true,
              projectId: true,
              project: { select: { key: true, name: true, color: true } },
            },
          })
        : [],
      types.includes('projects')
        ? prisma.project.findMany({
            where: {
              workspaceId,
              deletedAt: null,
              OR: [{ name: contains }, { key: contains }, { description: contains }],
            },
            take: limit,
            orderBy: { updatedAt: 'desc' },
            select: { id: true, name: true, key: true, color: true, icon: true, status: true },
          })
        : [],
      types.includes('members')
        ? prisma.workspaceMember.findMany({
            where: {
              workspaceId,
              user: { OR: [{ name: contains }, { email: contains }] },
            },
            take: limit,
            select: {
              id: true,
              role: true,
              user: { select: { id: true, name: true, email: true, avatarUrl: true } },
            },
          })
        : [],
      types.includes('labels')
        ? prisma.label.findMany({
            where: { workspaceId, name: contains },
            take: limit,
            select: { id: true, name: true, color: true },
          })
        : [],
      types.includes('messages')
        ? prisma.message.findMany({
            where: {
              deletedAt: null,
              body: contains,
              channel: { workspaceId, deletedAt: null, members: { some: { userId } } },
            },
            take: limit,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              body: true,
              channelId: true,
              createdAt: true,
              sender: { select: { id: true, name: true, avatarUrl: true } },
              channel: { select: { name: true, type: true } },
            },
          })
        : [],
    ]);

    ok(res, {
      tasks: (tasks as Array<{ project: { key: string }; number: number } & Record<string, unknown>>).map(
        (t) => ({ ...t, key: `${t.project.key}-${t.number}` })
      ),
      projects,
      members,
      labels,
      messages,
    });
  })
);
