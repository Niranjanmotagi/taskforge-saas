import type Stripe from 'stripe';
import { BillingInterval, SubscriptionStatus } from '@taskforge/shared-types';
import { prisma } from '@/lib/prisma';
import { env } from '@/config/env';
import { stripe, isStripeConfigured } from '@/lib/stripe';
import { ApiError } from '@/utils/api-error';
import { logger } from '@/lib/logger';
import { audit } from '@/services/audit.service';
import { notify } from '@/services/notification.service';
import { sendMail } from '@/lib/mailer';
import { emailTemplates } from '@/lib/email-templates';

function requireStripe(): void {
  if (!isStripeConfigured()) {
    throw new ApiError(503, 'Billing is not configured on this server');
  }
}

// ---------------------------------------------------------------------------
// Catalog & current subscription
// ---------------------------------------------------------------------------

export async function listPlans() {
  const plans = await prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { priceMonthlyCents: 'asc' },
  });
  return plans.map((p) => ({ ...p, storageLimitBytes: Number(p.storageLimitBytes) }));
}

export async function getSubscription(workspaceId: string) {
  const sub = await prisma.subscription.findUnique({
    where: { workspaceId },
    include: { plan: true },
  });
  if (!sub) return null;
  return { ...sub, plan: { ...sub.plan, storageLimitBytes: Number(sub.plan.storageLimitBytes) } };
}

export async function listInvoices(workspaceId: string) {
  return prisma.invoice.findMany({
    where: { workspaceId },
    orderBy: { issuedAt: 'desc' },
    take: 50,
  });
}

// ---------------------------------------------------------------------------
// Checkout / portal
// ---------------------------------------------------------------------------

async function ensureStripeCustomer(workspaceId: string, actorEmail: string): Promise<string> {
  const sub = await prisma.subscription.findUnique({ where: { workspaceId } });
  if (sub?.stripeCustomerId) return sub.stripeCustomerId;

  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { name: true },
  });
  const customer = await stripe.customers.create({
    email: actorEmail,
    name: workspace.name,
    metadata: { workspaceId },
  });
  await prisma.subscription.update({
    where: { workspaceId },
    data: { stripeCustomerId: customer.id },
  });
  return customer.id;
}

export async function createCheckoutSession(
  workspaceId: string,
  actor: { id: string; email: string },
  input: { planTier: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE'; interval: BillingInterval; couponCode?: string }
) {
  requireStripe();

  const plan = await prisma.plan.findUnique({ where: { tier: input.planTier } });
  if (!plan || !plan.isActive) throw ApiError.notFound('Plan');

  const priceId =
    input.interval === BillingInterval.YEARLY ? plan.stripeYearlyPriceId : plan.stripeMonthlyPriceId;
  if (!priceId) {
    throw new ApiError(503, `Stripe price is not configured for ${plan.name} (${input.interval})`);
  }

  let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined;
  if (input.couponCode) {
    const coupon = await validateCoupon(input.couponCode);
    if (coupon.stripeCouponId) discounts = [{ coupon: coupon.stripeCouponId }];
  }

  const customerId = await ensureStripeCustomer(workspaceId, actor.email);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    discounts,
    success_url: `${env.APP_URL}/w/${workspaceId}/settings/billing?status=success`,
    cancel_url: `${env.APP_URL}/w/${workspaceId}/settings/billing?status=cancelled`,
    metadata: { workspaceId, planTier: input.planTier, interval: input.interval, actorId: actor.id },
    subscription_data: { metadata: { workspaceId, planTier: input.planTier } },
  });

  return { url: session.url };
}

export async function createPortalSession(workspaceId: string, actorEmail: string) {
  requireStripe();
  const customerId = await ensureStripeCustomer(workspaceId, actorEmail);
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${env.APP_URL}/w/${workspaceId}/settings/billing`,
  });
  return { url: session.url };
}

/** Cancel at period end (graceful) — resume clears the flag. */
export async function setCancelAtPeriodEnd(workspaceId: string, cancel: boolean) {
  requireStripe();
  const sub = await prisma.subscription.findUnique({ where: { workspaceId } });
  if (!sub?.stripeSubscriptionId) throw ApiError.badRequest('No active paid subscription');

  await stripe.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: cancel });
  return prisma.subscription.update({
    where: { workspaceId },
    data: { cancelAtPeriodEnd: cancel },
    include: { plan: true },
  });
}

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------

export async function validateCoupon(code: string) {
  const coupon = await prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });
  if (
    !coupon ||
    !coupon.isActive ||
    (coupon.expiresAt && coupon.expiresAt < new Date()) ||
    (coupon.maxRedemptions !== null && coupon.redemptionCount >= coupon.maxRedemptions)
  ) {
    throw ApiError.badRequest('This coupon code is invalid or expired');
  }
  return coupon;
}

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case 'active':
      return SubscriptionStatus.ACTIVE;
    case 'trialing':
      return SubscriptionStatus.TRIALING;
    case 'past_due':
      return SubscriptionStatus.PAST_DUE;
    case 'canceled':
      return SubscriptionStatus.CANCELLED;
    case 'unpaid':
      return SubscriptionStatus.UNPAID;
    default:
      return SubscriptionStatus.INCOMPLETE;
  }
}

export async function handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
  requireStripe();
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new ApiError(503, 'Webhook secret is not configured');
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    throw ApiError.badRequest('Invalid webhook signature');
  }

  logger.info(`stripe webhook: ${event.type}`);

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const workspaceId = session.metadata?.workspaceId;
      const planTier = session.metadata?.planTier;
      const interval = (session.metadata?.interval as BillingInterval) ?? BillingInterval.MONTHLY;
      if (!workspaceId || !planTier) break;

      const plan = await prisma.plan.findUnique({ where: { tier: planTier as never } });
      if (!plan) break;

      await prisma.subscription.update({
        where: { workspaceId },
        data: {
          planId: plan.id,
          status: SubscriptionStatus.ACTIVE,
          interval,
          stripeSubscriptionId: session.subscription as string,
          cancelAtPeriodEnd: false,
        },
      });

      audit('SUBSCRIPTION_CHANGED', { workspaceId, metadata: { planTier, interval } });
      break;
    }

    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const record = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: sub.id },
      });
      if (!record) break;

      const periodEnd = sub.current_period_end ?? null;
      const periodStart = sub.current_period_start ?? null;

      const isDeleted = event.type === 'customer.subscription.deleted';
      const freePlan = await prisma.plan.findUnique({ where: { tier: 'FREE' } });

      await prisma.subscription.update({
        where: { id: record.id },
        data: {
          status: isDeleted ? SubscriptionStatus.CANCELLED : mapStripeStatus(sub.status),
          currentPeriodStart: periodStart ? new Date(periodStart * 1000) : undefined,
          currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : undefined,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          // Downgrade to FREE when the paid subscription is fully gone.
          ...(isDeleted && freePlan ? { planId: freePlan.id, stripeSubscriptionId: null } : {}),
        },
      });
      break;
    }

    case 'invoice.paid':
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;
      const record = await prisma.subscription.findFirst({
        where: { stripeCustomerId: customerId },
        include: { workspace: { select: { id: true, name: true, ownerId: true, owner: { select: { email: true, name: true } } } } },
      });
      if (!record) break;

      const paid = event.type === 'invoice.paid';
      await prisma.invoice.upsert({
        where: { stripeInvoiceId: invoice.id },
        create: {
          workspaceId: record.workspaceId,
          stripeInvoiceId: invoice.id ?? `stripe_${Date.now()}`,
          number: invoice.number ?? `INV-${Date.now()}`,
          status: paid ? 'PAID' : 'OPEN',
          amountDueCents: invoice.amount_due,
          amountPaidCents: invoice.amount_paid,
          currency: invoice.currency.toUpperCase(),
          hostedInvoiceUrl: invoice.hosted_invoice_url,
          pdfUrl: invoice.invoice_pdf,
          paidAt: paid ? new Date() : null,
        },
        update: {
          status: paid ? 'PAID' : 'OPEN',
          amountPaidCents: invoice.amount_paid,
          paidAt: paid ? new Date() : null,
        },
      });

      if (!paid) {
        await prisma.subscription.update({
          where: { id: record.id },
          data: { status: SubscriptionStatus.PAST_DUE },
        });
        void notify([record.workspace.ownerId], {
          type: 'PAYMENT_FAILED',
          title: `Payment failed for ${record.workspace.name}`,
          body: 'Update your payment method to avoid service interruption.',
          link: `${env.APP_URL}/w/${record.workspaceId}/settings/billing`,
          workspaceId: record.workspaceId,
        });
        sendMail({
          to: record.workspace.owner.email,
          ...emailTemplates.paymentFailed(
            record.workspace.name,
            `${env.APP_URL}/w/${record.workspaceId}/settings/billing`
          ),
        }).catch((err) => logger.error(`payment-failed email error: ${err.message}`));
      }
      break;
    }

    default:
      // Unhandled event types are fine — log at debug and acknowledge.
      logger.debug(`stripe webhook ignored: ${event.type}`);
  }
}
