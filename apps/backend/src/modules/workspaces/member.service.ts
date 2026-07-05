import { WorkspaceRole, canManageRole } from '@taskforge/shared-types';
import { prisma } from '@/lib/prisma';
import { ApiError } from '@/utils/api-error';
import { cacheDel } from '@/lib/redis';
import { membershipCacheKey } from '@/middlewares/tenant';
import { audit } from '@/services/audit.service';

export async function listMembers(workspaceId: string) {
  return prisma.workspaceMember.findMany({
    where: { workspaceId },
    orderBy: { joinedAt: 'asc' },
    select: {
      id: true,
      role: true,
      jobTitle: true,
      joinedAt: true,
      user: { select: { id: true, name: true, email: true, avatarUrl: true, lastLoginAt: true } },
    },
  });
}

async function getMemberOrThrow(workspaceId: string, memberId: string) {
  const member = await prisma.workspaceMember.findFirst({
    where: { id: memberId, workspaceId },
    include: { user: { select: { id: true, name: true } } },
  });
  if (!member) throw ApiError.notFound('Member');
  return member;
}

/**
 * Update a member's role/title. Hierarchy rules:
 *  - you can only manage roles strictly below your own
 *  - you cannot change your own role (prevents last-admin lockout games)
 *  - OWNER role is only assigned via ownership transfer
 */
export async function updateMember(
  workspaceId: string,
  actor: { userId: string; role: WorkspaceRole },
  memberId: string,
  input: { role?: WorkspaceRole; jobTitle?: string | null }
) {
  const member = await getMemberOrThrow(workspaceId, memberId);

  if (input.role) {
    if (member.userId === actor.userId) {
      throw ApiError.badRequest('You cannot change your own role');
    }
    if (!canManageRole(actor.role, member.role as WorkspaceRole) || !canManageRole(actor.role, input.role)) {
      throw ApiError.forbidden('You cannot manage a role at or above your own');
    }
  }

  const updated = await prisma.workspaceMember.update({
    where: { id: member.id },
    data: {
      ...(input.role ? { role: input.role } : {}),
      ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle } : {}),
    },
    select: {
      id: true,
      role: true,
      jobTitle: true,
      joinedAt: true,
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
  });

  if (input.role) {
    await cacheDel(membershipCacheKey(workspaceId, member.userId));
    audit('ROLE_CHANGED', {
      userId: actor.userId,
      workspaceId,
      metadata: { memberId, targetUserId: member.userId, from: member.role, to: input.role },
    });
  }
  return updated;
}

/** Remove a member (or leave, when actor removes their own membership). */
export async function removeMember(
  workspaceId: string,
  actor: { userId: string; role: WorkspaceRole },
  memberId: string
): Promise<void> {
  const member = await getMemberOrThrow(workspaceId, memberId);
  const isSelf = member.userId === actor.userId;

  if (member.role === WorkspaceRole.OWNER) {
    throw ApiError.badRequest('The owner cannot be removed — transfer ownership first');
  }
  if (!isSelf && !canManageRole(actor.role, member.role as WorkspaceRole)) {
    throw ApiError.forbidden('You cannot remove a member at or above your role');
  }

  await prisma.workspaceMember.delete({ where: { id: member.id } });
  await cacheDel(membershipCacheKey(workspaceId, member.userId));

  audit('MEMBER_REMOVED', {
    userId: actor.userId,
    workspaceId,
    metadata: { targetUserId: member.userId, self: isSelf },
  });
}
