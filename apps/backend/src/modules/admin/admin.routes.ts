import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '@/utils/async-handler';
import { authenticate, requireSuperAdmin, validate } from '@/middlewares';
import { ok, created, paginationMeta } from '@/utils/response';
import { paginationSchema } from '@/utils/pagination';
import { prisma } from '@/lib/prisma';
import { ApiError } from '@/utils/api-error';
import { audit } from '@/services/audit.service';

export const adminRouter = Router();

// Every admin route: authenticated super-admin only.
const gate = [authenticate, requireSuperAdmin] as const;

// ---------------------------------------------------------------------------
// Platform analytics
// ---------------------------------------------------------------------------

/**
 * @openapi
 * /admin/analytics:
 *   get: { summary: Platform-wide analytics (super admin), tags: [Admin] }
 */
adminRouter.get(
  '/admin/analytics',
  ...gate,
  asyncHandler(async (_req: Request, res: Response) => {
    const monthAgo = new Date(Date.now() - 30 * 86400_000);
    const [users, activeUsers, workspaces, tasks, subsByStatus, revenue, recentSignups] =
      await Promise.all([
        prisma.user.count({ where: { deletedAt: null } }),
        prisma.user.count({ where: { deletedAt: null, lastLoginAt: { gte: monthAgo } } }),
        prisma.workspace.count({ where: { deletedAt: null } }),
        prisma.task.count({ where: { deletedAt: null } }),
        prisma.subscription.groupBy({ by: ['status'], _count: true }),
        prisma.invoice.aggregate({ where: { status: 'PAID' }, _sum: { amountPaidCents: true } }),
        prisma.user.count({ where: { createdAt: { gte: monthAgo } } }),
      ]);

    const planDistribution = await prisma.subscription.groupBy({ by: ['planId'], _count: true });
    const plans = await prisma.plan.findMany({ select: { id: true, tier: true } });
    const planById = new Map(plans.map((p) => [p.id, p.tier]));

    ok(res, {
      users: { total: users, activeLast30d: activeUsers, newLast30d: recentSignups },
      workspaces,
      tasks,
      subscriptions: Object.fromEntries(subsByStatus.map((g) => [g.status, g._count])),
      planDistribution: Object.fromEntries(
        planDistribution.map((g) => [planById.get(g.planId) ?? g.planId, g._count])
      ),
      totalRevenueCents: revenue._sum.amountPaidCents ?? 0,
    });
  })
);

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

const userListQuery = paginationSchema.extend({
  search: z.string().trim().max(200).optional(),
  isActive: z.coerce.boolean().optional(),
});

adminRouter.get(
  '/admin/users',
  ...gate,
  validate({ query: userListQuery }),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as never as z.infer<typeof userListQuery>;
    const where = {
      ...(q.search
        ? { OR: [{ name: { contains: q.search, mode: 'insensitive' as const } }, { email: { contains: q.search, mode: 'insensitive' as const } }] }
        : {}),
      ...(q.isActive !== undefined ? { isActive: q.isActive } : {}),
    };
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        select: {
          id: true,
          email: true,
          name: true,
          systemRole: true,
          isActive: true,
          emailVerifiedAt: true,
          lastLoginAt: true,
          createdAt: true,
          deletedAt: true,
          _count: { select: { memberships: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);
    ok(res, users, paginationMeta(q.page, q.limit, total));
  })
);

adminRouter.patch(
  '/admin/users/:userId',
  ...gate,
  validate({
    params: z.object({ userId: z.string().uuid() }),
    body: z.object({
      isActive: z.boolean().optional(),
      systemRole: z.enum(['SUPER_ADMIN', 'USER']).optional(),
    }),
  }),
  asyncHandler(async (req: Request, res: Response) => {
    if (req.params.userId === req.user!.id && req.body.isActive === false) {
      throw ApiError.badRequest('You cannot deactivate your own account');
    }
    const user = await prisma.user.update({
      where: { id: req.params.userId },
      data: req.body,
      select: { id: true, email: true, isActive: true, systemRole: true },
    });
    audit('ADMIN_ACTION', {
      userId: req.user!.id,
      metadata: { action: 'user.update', targetUserId: user.id, changes: req.body },
    });
    ok(res, user);
  })
);

// ---------------------------------------------------------------------------
// Workspaces
// ---------------------------------------------------------------------------

adminRouter.get(
  '/admin/workspaces',
  ...gate,
  validate({ query: paginationSchema.extend({ search: z.string().trim().max(200).optional() }) }),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as never as z.infer<typeof paginationSchema> & { search?: string };
    const where = {
      ...(q.search ? { name: { contains: q.search, mode: 'insensitive' as const } } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.workspace.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
          deletedAt: true,
          storageUsedBytes: true,
          owner: { select: { id: true, email: true, name: true } },
          subscription: { select: { status: true, plan: { select: { tier: true } } } },
          _count: { select: { members: true, projects: true } },
        },
      }),
      prisma.workspace.count({ where }),
    ]);
    ok(res, rows, paginationMeta(q.page, q.limit, total));
  })
);

adminRouter.patch(
  '/admin/workspaces/:workspaceId',
  ...gate,
  validate({
    params: z.object({ workspaceId: z.string().uuid() }),
    body: z.object({ suspend: z.boolean() }),
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const ws = await prisma.workspace.update({
      where: { id: req.params.workspaceId },
      data: { deletedAt: req.body.suspend ? new Date() : null },
      select: { id: true, name: true, deletedAt: true },
    });
    audit('ADMIN_ACTION', {
      userId: req.user!.id,
      workspaceId: ws.id,
      metadata: { action: req.body.suspend ? 'workspace.suspend' : 'workspace.restore' },
    });
    ok(res, ws);
  })
);

// ---------------------------------------------------------------------------
// Payments (invoices across the platform)
// ---------------------------------------------------------------------------

adminRouter.get(
  '/admin/invoices',
  ...gate,
  validate({ query: paginationSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as never as z.infer<typeof paginationSchema>;
    const [rows, total] = await Promise.all([
      prisma.invoice.findMany({
        orderBy: { issuedAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { workspace: { select: { id: true, name: true } } },
      }),
      prisma.invoice.count(),
    ]);
    ok(res, rows, paginationMeta(q.page, q.limit, total));
  })
);

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

adminRouter.get(
  '/admin/plans',
  ...gate,
  asyncHandler(async (_req: Request, res: Response) => {
    const plans = await prisma.plan.findMany({ orderBy: { priceMonthlyCents: 'asc' } });
    ok(res, plans.map((p) => ({ ...p, storageLimitBytes: Number(p.storageLimitBytes) })));
  })
);

adminRouter.patch(
  '/admin/plans/:planId',
  ...gate,
  validate({
    params: z.object({ planId: z.string().uuid() }),
    body: z.object({
      name: z.string().trim().min(1).max(60).optional(),
      description: z.string().trim().max(300).optional(),
      priceMonthlyCents: z.number().int().min(0).optional(),
      priceYearlyCents: z.number().int().min(0).optional(),
      maxMembers: z.number().int().min(-1).optional(),
      maxProjects: z.number().int().min(-1).optional(),
      aiCreditsPerMonth: z.number().int().min(0).optional(),
      features: z.array(z.string().max(120)).max(20).optional(),
      isActive: z.boolean().optional(),
      stripeMonthlyPriceId: z.string().max(100).nullable().optional(),
      stripeYearlyPriceId: z.string().max(100).nullable().optional(),
    }),
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const plan = await prisma.plan.update({ where: { id: req.params.planId }, data: req.body });
    audit('ADMIN_ACTION', {
      userId: req.user!.id,
      metadata: { action: 'plan.update', planId: plan.id },
    });
    ok(res, { ...plan, storageLimitBytes: Number(plan.storageLimitBytes) });
  })
);

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------

adminRouter.get(
  '/admin/coupons',
  ...gate,
  asyncHandler(async (_req: Request, res: Response) => {
    ok(res, await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } }));
  })
);

adminRouter.post(
  '/admin/coupons',
  ...gate,
  validate({
    body: z
      .object({
        code: z.string().trim().toUpperCase().min(3).max(50),
        description: z.string().trim().max(300).optional(),
        percentOff: z.number().int().min(1).max(100).optional(),
        amountOffCents: z.number().int().positive().optional(),
        maxRedemptions: z.number().int().positive().optional(),
        stripeCouponId: z.string().max(100).optional(),
        expiresAt: z.coerce.date().optional(),
      })
      .refine((v) => Boolean(v.percentOff) !== Boolean(v.amountOffCents), {
        message: 'Provide exactly one of percentOff or amountOffCents',
      }),
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const coupon = await prisma.coupon.create({ data: req.body });
    audit('ADMIN_ACTION', { userId: req.user!.id, metadata: { action: 'coupon.create', code: coupon.code } });
    created(res, coupon);
  })
);

adminRouter.patch(
  '/admin/coupons/:couponId',
  ...gate,
  validate({
    params: z.object({ couponId: z.string().uuid() }),
    body: z.object({ isActive: z.boolean() }),
  }),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await prisma.coupon.update({ where: { id: req.params.couponId }, data: req.body }));
  })
);

// ---------------------------------------------------------------------------
// Audit logs
// ---------------------------------------------------------------------------

adminRouter.get(
  '/admin/audit-logs',
  ...gate,
  validate({
    query: paginationSchema.extend({
      event: z.string().max(60).optional(),
      userId: z.string().uuid().optional(),
    }),
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as never as z.infer<typeof paginationSchema> & { event?: string; userId?: string };
    const where = {
      ...(q.event ? { event: q.event as never } : {}),
      ...(q.userId ? { userId: q.userId } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { user: { select: { id: true, email: true, name: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);
    ok(res, rows, paginationMeta(q.page, q.limit, total));
  })
);

// ---------------------------------------------------------------------------
// Feature flags
// ---------------------------------------------------------------------------

adminRouter.get(
  '/admin/feature-flags',
  ...gate,
  asyncHandler(async (_req: Request, res: Response) => {
    ok(res, await prisma.featureFlag.findMany({ orderBy: { key: 'asc' } }));
  })
);

adminRouter.put(
  '/admin/feature-flags/:key',
  ...gate,
  validate({
    params: z.object({ key: z.string().min(1).max(80) }),
    body: z.object({
      isEnabled: z.boolean(),
      description: z.string().max(300).optional(),
      rules: z.record(z.unknown()).nullable().optional(),
    }),
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const flag = await prisma.featureFlag.upsert({
      where: { key: req.params.key },
      create: { key: req.params.key, ...req.body, rules: req.body.rules ?? undefined },
      update: { ...req.body, rules: req.body.rules ?? undefined },
    });
    audit('ADMIN_ACTION', {
      userId: req.user!.id,
      metadata: { action: 'flag.update', key: flag.key, isEnabled: flag.isEnabled },
    });
    ok(res, flag);
  })
);
