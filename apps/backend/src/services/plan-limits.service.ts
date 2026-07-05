import { prisma } from '@/lib/prisma';
import { ApiError } from '@/utils/api-error';

/**
 * Central plan-limit enforcement. Reads the workspace's subscription plan and
 * throws PLAN_LIMIT_REACHED (402) when the action would exceed it.
 * A missing subscription is treated as the FREE tier.
 */

async function getPlanFor(workspaceId: string) {
  const sub = await prisma.subscription.findUnique({
    where: { workspaceId },
    include: { plan: true },
  });
  if (sub?.plan) return sub.plan;
  const free = await prisma.plan.findUnique({ where: { tier: 'FREE' } });
  if (!free) {
    // Seed data missing — fail open with generous defaults rather than
    // blocking customers on our own misconfiguration.
    return null;
  }
  return free;
}

export async function assertCanAddMember(workspaceId: string, adding = 1): Promise<void> {
  const plan = await getPlanFor(workspaceId);
  if (!plan || plan.maxMembers < 0) return;
  const current = await prisma.workspaceMember.count({ where: { workspaceId } });
  const pendingInvites = await prisma.invitation.count({
    where: { workspaceId, status: 'PENDING', expiresAt: { gt: new Date() } },
  });
  if (current + pendingInvites + adding > plan.maxMembers) {
    throw ApiError.planLimit(
      `Your ${plan.name} plan allows up to ${plan.maxMembers} members. Upgrade to add more.`
    );
  }
}

export async function assertCanCreateProject(workspaceId: string): Promise<void> {
  const plan = await getPlanFor(workspaceId);
  if (!plan || plan.maxProjects < 0) return;
  const current = await prisma.project.count({ where: { workspaceId, deletedAt: null } });
  if (current + 1 > plan.maxProjects) {
    throw ApiError.planLimit(
      `Your ${plan.name} plan allows up to ${plan.maxProjects} projects. Upgrade to add more.`
    );
  }
}

export async function assertStorageAvailable(workspaceId: string, addingBytes: number): Promise<void> {
  const plan = await getPlanFor(workspaceId);
  if (!plan) return;
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { storageUsedBytes: true },
  });
  const used = ws ? Number(ws.storageUsedBytes) : 0;
  if (used + addingBytes > Number(plan.storageLimitBytes)) {
    throw ApiError.planLimit(`Storage limit reached on your ${plan.name} plan. Upgrade for more space.`);
  }
}

export async function assertAiCreditsAvailable(workspaceId: string): Promise<void> {
  const plan = await getPlanFor(workspaceId);
  if (!plan) return;
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { aiCreditsUsed: true },
  });
  if ((ws?.aiCreditsUsed ?? 0) >= plan.aiCreditsPerMonth) {
    throw ApiError.planLimit(
      `Monthly AI credit limit reached on your ${plan.name} plan. Upgrade for more credits.`
    );
  }
}
