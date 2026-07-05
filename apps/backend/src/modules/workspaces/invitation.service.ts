import { WorkspaceRole } from '@taskforge/shared-types';
import { prisma } from '@/lib/prisma';
import { env } from '@/config/env';
import { ApiError } from '@/utils/api-error';
import { randomToken, sha256 } from '@/utils/crypto';
import { sendMail } from '@/lib/mailer';
import { emailTemplates } from '@/lib/email-templates';
import { logger } from '@/lib/logger';
import { assertCanAddMember } from '@/services/plan-limits.service';
import { recordActivity } from '@/services/activity.service';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function createInvitation(
  workspaceId: string,
  inviter: { userId: string; name: string },
  input: { email: string; role: WorkspaceRole }
) {
  await assertCanAddMember(workspaceId);

  const existingMember = await prisma.workspaceMember.findFirst({
    where: { workspaceId, user: { email: input.email } },
  });
  if (existingMember) throw ApiError.conflict('This person is already a member');

  const pending = await prisma.invitation.findFirst({
    where: { workspaceId, email: input.email, status: 'PENDING', expiresAt: { gt: new Date() } },
  });
  if (pending) throw ApiError.conflict('An invitation for this email is already pending');

  const raw = randomToken(32);
  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { name: true },
  });

  const invitation = await prisma.invitation.create({
    data: {
      workspaceId,
      email: input.email,
      role: input.role,
      tokenHash: sha256(raw),
      invitedById: inviter.userId,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
  });

  const url = `${env.APP_URL}/invitations/accept?token=${raw}`;
  sendMail({
    to: input.email,
    ...emailTemplates.workspaceInvite(inviter.name, workspace.name, url),
  }).catch((err) => logger.error(`invite email failed: ${err.message}`));

  recordActivity({
    workspaceId,
    actorId: inviter.userId,
    action: 'INVITED',
    entityType: 'invitation',
    entityId: invitation.id,
    entityLabel: input.email,
  });

  return invitation;
}

export async function listInvitations(workspaceId: string) {
  return prisma.invitation.findMany({
    where: { workspaceId, status: 'PENDING', expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      expiresAt: true,
      createdAt: true,
      invitedBy: { select: { id: true, name: true } },
    },
  });
}

export async function revokeInvitation(workspaceId: string, invitationId: string): Promise<void> {
  const result = await prisma.invitation.updateMany({
    where: { id: invitationId, workspaceId, status: 'PENDING' },
    data: { status: 'REVOKED', respondedAt: new Date() },
  });
  if (result.count === 0) throw ApiError.notFound('Invitation');
}

/** Public preview so the accept page can show workspace + inviter before login. */
export async function previewInvitation(rawToken: string) {
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: sha256(rawToken) },
    select: {
      email: true,
      role: true,
      status: true,
      expiresAt: true,
      workspace: { select: { name: true, logoUrl: true } },
      invitedBy: { select: { name: true } },
    },
  });
  if (!invitation || invitation.status !== 'PENDING' || invitation.expiresAt < new Date()) {
    throw ApiError.notFound('Invitation');
  }
  return invitation;
}

/**
 * Accept an invitation as the authenticated user. The invite email must match
 * the account email — prevents forwarding an invite link to someone else.
 */
export async function acceptInvitation(rawToken: string, user: { id: string; email: string }) {
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: sha256(rawToken) },
    include: { workspace: { select: { id: true, name: true, deletedAt: true } } },
  });

  if (!invitation || invitation.status !== 'PENDING') throw ApiError.notFound('Invitation');
  if (invitation.expiresAt < new Date()) {
    await prisma.invitation.update({ where: { id: invitation.id }, data: { status: 'EXPIRED' } });
    throw ApiError.badRequest('This invitation has expired');
  }
  if (invitation.workspace.deletedAt) throw ApiError.notFound('Workspace');
  if (invitation.email !== user.email) {
    throw ApiError.forbidden(`This invitation was sent to ${invitation.email}`);
  }

  const alreadyMember = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId: user.id } },
  });
  if (alreadyMember) {
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: 'ACCEPTED', respondedAt: new Date() },
    });
    return { workspaceId: invitation.workspaceId, alreadyMember: true };
  }

  await assertCanAddMember(invitation.workspaceId, 1);

  await prisma.$transaction([
    prisma.workspaceMember.create({
      data: { workspaceId: invitation.workspaceId, userId: user.id, role: invitation.role },
    }),
    prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: 'ACCEPTED', respondedAt: new Date() },
    }),
  ]);

  // Join the workspace #general channel automatically.
  const general = await prisma.channel.findFirst({
    where: { workspaceId: invitation.workspaceId, type: 'WORKSPACE', name: 'general' },
    select: { id: true },
  });
  if (general) {
    await prisma.channelMember.upsert({
      where: { channelId_userId: { channelId: general.id, userId: user.id } },
      create: { channelId: general.id, userId: user.id },
      update: {},
    });
  }

  recordActivity({
    workspaceId: invitation.workspaceId,
    actorId: user.id,
    action: 'JOINED',
    entityType: 'workspace',
    entityId: invitation.workspaceId,
    entityLabel: invitation.workspace.name,
  });

  return { workspaceId: invitation.workspaceId, alreadyMember: false };
}
