import { z } from 'zod';
import { WorkspaceRole } from '@taskforge/shared-types';

const assignableRoles = z.nativeEnum(WorkspaceRole).refine((r) => r !== WorkspaceRole.OWNER, {
  message: 'OWNER role can only be granted via ownership transfer',
});

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2, 'Workspace name is required').max(80),
  description: z.string().trim().max(500).optional(),
});

export const updateWorkspaceSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    logoUrl: z.string().url().nullable().optional(),
    settings: z.record(z.unknown()).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

export const transferOwnershipSchema = z.object({
  newOwnerId: z.string().uuid(),
});

export const updateMemberSchema = z.object({
  role: assignableRoles.optional(),
  jobTitle: z.string().trim().max(100).nullable().optional(),
});

export const createInvitationSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: assignableRoles.default(WorkspaceRole.DEVELOPER),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(20).max(200),
});

export const memberIdParam = z.object({
  workspaceId: z.string().uuid(),
  memberId: z.string().uuid(),
});

export const invitationIdParam = z.object({
  workspaceId: z.string().uuid(),
  invitationId: z.string().uuid(),
});
