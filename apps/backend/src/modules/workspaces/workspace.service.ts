import { WorkspaceRole } from '@taskforge/shared-types';
import { slugify } from '@taskforge/shared-utils';
import { prisma } from '@/lib/prisma';
import { ApiError } from '@/utils/api-error';
import { cacheDel } from '@/lib/redis';
import { membershipCacheKey } from '@/middlewares/tenant';
import { audit } from '@/services/audit.service';
import { recordActivity } from '@/services/activity.service';

const DEFAULT_LABELS = [
  { name: 'Bug', color: '#ef4444' },
  { name: 'Feature', color: '#6366f1' },
  { name: 'Improvement', color: '#10b981' },
  { name: 'Documentation', color: '#f59e0b' },
];

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || 'workspace';
  let slug = base;
  for (let attempt = 1; ; attempt += 1) {
    const exists = await prisma.workspace.findUnique({ where: { slug }, select: { id: true } });
    if (!exists) return slug;
    slug = `${base}-${attempt + 1}`;
  }
}

/**
 * Create a workspace: creator becomes OWNER, FREE subscription is attached,
 * a #general channel and starter labels are provisioned — one transaction.
 */
export async function createWorkspace(userId: string, input: { name: string; description?: string }) {
  const slug = await uniqueSlug(input.name);
  const freePlan = await prisma.plan.findUnique({ where: { tier: 'FREE' } });

  const workspace = await prisma.$transaction(async (tx) => {
    const ws = await tx.workspace.create({
      data: {
        name: input.name,
        slug,
        description: input.description,
        ownerId: userId,
        members: {
          create: { userId, role: WorkspaceRole.OWNER },
        },
        labels: { create: DEFAULT_LABELS },
      },
    });

    await tx.channel.create({
      data: {
        workspaceId: ws.id,
        type: 'WORKSPACE',
        name: 'general',
        createdById: userId,
        members: { create: { userId, isAdmin: true } },
      },
    });

    if (freePlan) {
      await tx.subscription.create({
        data: { workspaceId: ws.id, planId: freePlan.id, status: 'ACTIVE' },
      });
    }

    return ws;
  });

  recordActivity({
    workspaceId: workspace.id,
    actorId: userId,
    action: 'CREATED',
    entityType: 'workspace',
    entityId: workspace.id,
    entityLabel: workspace.name,
  });

  return workspace;
}

export async function listMyWorkspaces(userId: string) {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId, workspace: { deletedAt: null } },
    orderBy: { joinedAt: 'asc' },
    select: {
      role: true,
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          description: true,
          ownerId: true,
          createdAt: true,
          _count: { select: { members: true, projects: { where: { deletedAt: null } } } },
          subscription: { select: { plan: { select: { tier: true } } } },
        },
      },
    },
  });

  return memberships.map((m) => ({
    ...m.workspace,
    role: m.role,
    memberCount: m.workspace._count.members,
    projectCount: m.workspace._count.projects,
    planTier: m.workspace.subscription?.plan.tier ?? 'FREE',
    _count: undefined,
    subscription: undefined,
  }));
}

export async function getWorkspace(workspaceId: string) {
  const ws = await prisma.workspace.findFirst({
    where: { id: workspaceId, deletedAt: null },
    include: {
      _count: { select: { members: true, projects: { where: { deletedAt: null } } } },
      subscription: { include: { plan: { select: { tier: true, name: true, storageLimitBytes: true } } } },
    },
  });
  if (!ws) throw ApiError.notFound('Workspace');
  return {
    ...ws,
    storageUsedBytes: Number(ws.storageUsedBytes),
    memberCount: ws._count.members,
    projectCount: ws._count.projects,
    planTier: ws.subscription?.plan.tier ?? 'FREE',
    storageLimitBytes: ws.subscription ? Number(ws.subscription.plan.storageLimitBytes) : null,
    _count: undefined,
  };
}

export async function updateWorkspace(
  workspaceId: string,
  actorId: string,
  input: { name?: string; description?: string | null; logoUrl?: string | null; settings?: Record<string, unknown> }
) {
  const ws = await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
      ...(input.settings !== undefined ? { settings: input.settings as never } : {}),
    },
  });
  recordActivity({
    workspaceId,
    actorId,
    action: 'UPDATED',
    entityType: 'workspace',
    entityId: workspaceId,
    entityLabel: ws.name,
  });
  return ws;
}

/** Soft-delete a workspace (OWNER only — enforced by permission matrix). */
export async function deleteWorkspace(workspaceId: string, actorId: string): Promise<void> {
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { deletedAt: new Date() },
  });
  audit('WORKSPACE_DELETED', { userId: actorId, workspaceId });
}

/** Atomic ownership transfer: swap roles + ownerId in one transaction. */
export async function transferOwnership(workspaceId: string, currentOwnerId: string, newOwnerId: string) {
  if (currentOwnerId === newOwnerId) {
    throw ApiError.badRequest('You already own this workspace');
  }
  const target = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: newOwnerId } },
  });
  if (!target) throw ApiError.notFound('Target member');

  await prisma.$transaction([
    prisma.workspace.update({ where: { id: workspaceId }, data: { ownerId: newOwnerId } }),
    prisma.workspaceMember.update({
      where: { workspaceId_userId: { workspaceId, userId: newOwnerId } },
      data: { role: WorkspaceRole.OWNER },
    }),
    prisma.workspaceMember.update({
      where: { workspaceId_userId: { workspaceId, userId: currentOwnerId } },
      data: { role: WorkspaceRole.ADMIN },
    }),
  ]);

  await cacheDel(membershipCacheKey(workspaceId, newOwnerId), membershipCacheKey(workspaceId, currentOwnerId));
  audit('OWNERSHIP_TRANSFERRED', {
    userId: currentOwnerId,
    workspaceId,
    metadata: { newOwnerId },
  });
}
