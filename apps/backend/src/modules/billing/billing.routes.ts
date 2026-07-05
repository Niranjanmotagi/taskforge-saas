import { Router, raw } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { BillingInterval, PERMISSIONS } from '@taskforge/shared-types';
import { asyncHandler } from '@/utils/async-handler';
import { authenticate, authorize, tenantScope, validate, workspaceIdParam } from '@/middlewares';
import { ok } from '@/utils/response';
import { ApiError } from '@/utils/api-error';
import * as billingService from './billing.service';

export const billingRouter = Router();

const auth = [authenticate] as const;

/**
 * @openapi
 * /billing/plans:
 *   get: { summary: Public plan catalog, tags: [Billing], security: [] }
 */
billingRouter.get(
  '/billing/plans',
  asyncHandler(async (_req: Request, res: Response) => {
    ok(res, await billingService.listPlans());
  })
);

/**
 * @openapi
 * /billing/webhook:
 *   post: { summary: Stripe webhook (signature-verified raw body), tags: [Billing], security: [] }
 */
billingRouter.post(
  '/billing/webhook',
  raw({ type: 'application/json' }),
  asyncHandler(async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'];
    if (typeof signature !== 'string') throw ApiError.badRequest('Missing stripe-signature header');
    await billingService.handleWebhook(req.body as Buffer, signature);
    ok(res, { received: true });
  })
);

/**
 * @openapi
 * /workspaces/{workspaceId}/billing/subscription:
 *   get: { summary: Current subscription + plan, tags: [Billing] }
 */
billingRouter.get(
  '/workspaces/:workspaceId/billing/subscription',
  ...auth,
  validate({ params: workspaceIdParam }),
  tenantScope,
  authorize(PERMISSIONS.WORKSPACE_VIEW),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await billingService.getSubscription(req.workspace!.id));
  })
);

/**
 * @openapi
 * /workspaces/{workspaceId}/billing/invoices:
 *   get: { summary: Invoice history, tags: [Billing] }
 */
billingRouter.get(
  '/workspaces/:workspaceId/billing/invoices',
  ...auth,
  validate({ params: workspaceIdParam }),
  tenantScope,
  authorize(PERMISSIONS.WORKSPACE_BILLING),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await billingService.listInvoices(req.workspace!.id));
  })
);

/**
 * @openapi
 * /workspaces/{workspaceId}/billing/checkout:
 *   post: { summary: Create Stripe Checkout session (upgrade/downgrade), tags: [Billing] }
 */
billingRouter.post(
  '/workspaces/:workspaceId/billing/checkout',
  ...auth,
  validate({
    params: workspaceIdParam,
    body: z.object({
      planTier: z.enum(['STARTER', 'PROFESSIONAL', 'ENTERPRISE']),
      interval: z.nativeEnum(BillingInterval).default(BillingInterval.MONTHLY),
      couponCode: z.string().trim().max(50).optional(),
    }),
  }),
  tenantScope,
  authorize(PERMISSIONS.WORKSPACE_BILLING),
  asyncHandler(async (req: Request, res: Response) => {
    ok(
      res,
      await billingService.createCheckoutSession(
        req.workspace!.id,
        { id: req.user!.id, email: req.user!.email },
        req.body
      )
    );
  })
);

/**
 * @openapi
 * /workspaces/{workspaceId}/billing/portal:
 *   post: { summary: Stripe customer portal session, tags: [Billing] }
 */
billingRouter.post(
  '/workspaces/:workspaceId/billing/portal',
  ...auth,
  validate({ params: workspaceIdParam }),
  tenantScope,
  authorize(PERMISSIONS.WORKSPACE_BILLING),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await billingService.createPortalSession(req.workspace!.id, req.user!.email));
  })
);

/**
 * @openapi
 * /workspaces/{workspaceId}/billing/cancel:
 *   post: { summary: Cancel at period end (body { cancel: bool } to resume), tags: [Billing] }
 */
billingRouter.post(
  '/workspaces/:workspaceId/billing/cancel',
  ...auth,
  validate({
    params: workspaceIdParam,
    body: z.object({ cancel: z.boolean().default(true) }),
  }),
  tenantScope,
  authorize(PERMISSIONS.WORKSPACE_BILLING),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await billingService.setCancelAtPeriodEnd(req.workspace!.id, req.body.cancel));
  })
);

/**
 * @openapi
 * /billing/coupons/validate:
 *   post: { summary: Validate a coupon code, tags: [Billing] }
 */
billingRouter.post(
  '/billing/coupons/validate',
  ...auth,
  validate({ body: z.object({ code: z.string().trim().min(1).max(50) }) }),
  asyncHandler(async (req: Request, res: Response) => {
    const coupon = await billingService.validateCoupon(req.body.code);
    ok(res, {
      code: coupon.code,
      description: coupon.description,
      percentOff: coupon.percentOff,
      amountOffCents: coupon.amountOffCents,
    });
  })
);
