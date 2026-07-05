import type { NextFunction, Request, Response } from 'express';
import type { WorkspaceRole } from '@taskforge/shared-types';
import { prisma } from '@/lib/prisma';
import { cacheGet, cacheSet } from '@/lib/redis';
import { ApiError } from '@/utils/api-error';

interface CachedMembership {
  memberId: string;
  role: WorkspaceRole;
}

const MEMBERSHIP_TTL_SECONDS = 60;

export function membershipCacheKey(workspaceId: string, userId: string): string {
  return `membership:${workspaceId}:${userId}`;
}

/**
 * Tenant isolation gate. Resolves the :workspaceId route param, verifies the
 * authenticated user is an active member, and attaches { id, role } to the
 * request. Every workspace-scoped route MUST sit behind this middleware —
 * repositories additionally filter by workspaceId for defense in depth.
 */
export async function tenantScope(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw ApiError.unauthorized();

    const workspaceId = req.params.workspaceId;
    if (!workspaceId) {
      throw ApiError.internal('tenantScope used on a route without :workspaceId');
    }

    const cacheKey = membershipCacheKey(workspaceId, req.user.id);
    let membership = await cacheGet<CachedMembership>(cacheKey);

    if (!membership) {
      const row = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId,
          userId: req.user.id,
          workspace: { deletedAt: null },
        },
        select: { id: true, role: true },
      });
      if (!row) throw ApiError.forbidden('You are not a member of this workspace');
      membership = { memberId: row.id, role: row.role as WorkspaceRole };
      await cacheSet(cacheKey, membership, MEMBERSHIP_TTL_SECONDS);
    }

    req.workspace = {
      id: workspaceId,
      role: membership.role,
      memberId: membership.memberId,
    };
    next();
  } catch (err) {
    next(err);
  }
}
