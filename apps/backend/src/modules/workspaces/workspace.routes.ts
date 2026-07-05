import { Router } from 'express';
import { PERMISSIONS } from '@taskforge/shared-types';
import { asyncHandler } from '@/utils/async-handler';
import { authenticate, authorize, tenantScope, validate, workspaceIdParam } from '@/middlewares';
import * as controller from './workspace.controller';
import {
  acceptInvitationSchema,
  createInvitationSchema,
  createWorkspaceSchema,
  invitationIdParam,
  memberIdParam,
  transferOwnershipSchema,
  updateMemberSchema,
  updateWorkspaceSchema,
} from './workspace.validation';
import { z } from 'zod';

export const workspaceRouter = Router();

/**
 * @openapi
 * /workspaces:
 *   post:
 *     summary: Create a workspace (creator becomes OWNER)
 *     tags: [Workspaces]
 *     responses:
 *       201: { description: Workspace created with FREE plan + defaults }
 *   get:
 *     summary: List workspaces I belong to
 *     tags: [Workspaces]
 *     responses:
 *       200: { description: Memberships with role, counts, plan tier }
 */
workspaceRouter.post(
  '/workspaces',
  authenticate,
  validate({ body: createWorkspaceSchema }),
  asyncHandler(controller.createWorkspace)
);
workspaceRouter.get('/workspaces', authenticate, asyncHandler(controller.listMyWorkspaces));

/**
 * @openapi
 * /workspaces/{workspaceId}:
 *   get:
 *     summary: Workspace details (members only)
 *     tags: [Workspaces]
 *   patch:
 *     summary: Update workspace (ADMIN+)
 *     tags: [Workspaces]
 *   delete:
 *     summary: Soft-delete workspace (OWNER only)
 *     tags: [Workspaces]
 */
workspaceRouter.get(
  '/workspaces/:workspaceId',
  authenticate,
  validate({ params: workspaceIdParam }),
  tenantScope,
  authorize(PERMISSIONS.WORKSPACE_VIEW),
  asyncHandler(controller.getWorkspace)
);
workspaceRouter.patch(
  '/workspaces/:workspaceId',
  authenticate,
  validate({ params: workspaceIdParam, body: updateWorkspaceSchema }),
  tenantScope,
  authorize(PERMISSIONS.WORKSPACE_UPDATE),
  asyncHandler(controller.updateWorkspace)
);
workspaceRouter.delete(
  '/workspaces/:workspaceId',
  authenticate,
  validate({ params: workspaceIdParam }),
  tenantScope,
  authorize(PERMISSIONS.WORKSPACE_DELETE),
  asyncHandler(controller.deleteWorkspace)
);

/**
 * @openapi
 * /workspaces/{workspaceId}/transfer-ownership:
 *   post:
 *     summary: Transfer workspace ownership (OWNER only)
 *     tags: [Workspaces]
 */
workspaceRouter.post(
  '/workspaces/:workspaceId/transfer-ownership',
  authenticate,
  validate({ params: workspaceIdParam, body: transferOwnershipSchema }),
  tenantScope,
  authorize(PERMISSIONS.WORKSPACE_TRANSFER),
  asyncHandler(controller.transferOwnership)
);

/**
 * @openapi
 * /workspaces/{workspaceId}/members:
 *   get:
 *     summary: List workspace members
 *     tags: [Members]
 */
workspaceRouter.get(
  '/workspaces/:workspaceId/members',
  authenticate,
  validate({ params: workspaceIdParam }),
  tenantScope,
  authorize(PERMISSIONS.MEMBER_VIEW),
  asyncHandler(controller.listMembers)
);

/**
 * @openapi
 * /workspaces/{workspaceId}/members/{memberId}:
 *   patch:
 *     summary: Update member role/title (hierarchy enforced)
 *     tags: [Members]
 *   delete:
 *     summary: Remove a member (or leave when removing self)
 *     tags: [Members]
 */
workspaceRouter.patch(
  '/workspaces/:workspaceId/members/:memberId',
  authenticate,
  validate({ params: memberIdParam, body: updateMemberSchema }),
  tenantScope,
  authorize(PERMISSIONS.MEMBER_ROLE_UPDATE),
  asyncHandler(controller.updateMember)
);
workspaceRouter.delete(
  '/workspaces/:workspaceId/members/:memberId',
  authenticate,
  validate({ params: memberIdParam }),
  tenantScope,
  // Self-removal (leave) is allowed for every role; service enforces hierarchy
  // for removing others, so only the base view permission is required here.
  authorize(PERMISSIONS.WORKSPACE_VIEW),
  asyncHandler(controller.removeMember)
);

/**
 * @openapi
 * /workspaces/{workspaceId}/invitations:
 *   post:
 *     summary: Invite by email (plan seat limits enforced)
 *     tags: [Invitations]
 *   get:
 *     summary: List pending invitations
 *     tags: [Invitations]
 */
workspaceRouter.post(
  '/workspaces/:workspaceId/invitations',
  authenticate,
  validate({ params: workspaceIdParam, body: createInvitationSchema }),
  tenantScope,
  authorize(PERMISSIONS.MEMBER_INVITE),
  asyncHandler(controller.createInvitation)
);
workspaceRouter.get(
  '/workspaces/:workspaceId/invitations',
  authenticate,
  validate({ params: workspaceIdParam }),
  tenantScope,
  authorize(PERMISSIONS.MEMBER_INVITE),
  asyncHandler(controller.listInvitations)
);
workspaceRouter.delete(
  '/workspaces/:workspaceId/invitations/:invitationId',
  authenticate,
  validate({ params: invitationIdParam }),
  tenantScope,
  authorize(PERMISSIONS.MEMBER_INVITE),
  asyncHandler(controller.revokeInvitation)
);

/**
 * @openapi
 * /invitations/{token}:
 *   get:
 *     summary: Public invitation preview (workspace + inviter)
 *     tags: [Invitations]
 *     security: []
 * /invitations/accept:
 *   post:
 *     summary: Accept an invitation as the signed-in user
 *     tags: [Invitations]
 */
workspaceRouter.get(
  '/invitations/:token',
  validate({ params: z.object({ token: z.string().min(20).max(200) }) }),
  asyncHandler(controller.previewInvitation)
);
workspaceRouter.post(
  '/invitations/accept',
  authenticate,
  validate({ body: acceptInvitationSchema }),
  asyncHandler(controller.acceptInvitation)
);
