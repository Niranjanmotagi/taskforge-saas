import type { Request, Response } from 'express';
import { ok, created } from '@/utils/response';
import { prisma } from '@/lib/prisma';
import * as workspaceService from './workspace.service';
import * as memberService from './member.service';
import * as invitationService from './invitation.service';

// ---------------------------------------------------------------------------
// Workspaces
// ---------------------------------------------------------------------------

export async function createWorkspace(req: Request, res: Response): Promise<void> {
  const workspace = await workspaceService.createWorkspace(req.user!.id, req.body);
  created(res, workspace);
}

export async function listMyWorkspaces(req: Request, res: Response): Promise<void> {
  ok(res, await workspaceService.listMyWorkspaces(req.user!.id));
}

export async function getWorkspace(req: Request, res: Response): Promise<void> {
  ok(res, await workspaceService.getWorkspace(req.workspace!.id));
}

export async function updateWorkspace(req: Request, res: Response): Promise<void> {
  ok(res, await workspaceService.updateWorkspace(req.workspace!.id, req.user!.id, req.body));
}

export async function deleteWorkspace(req: Request, res: Response): Promise<void> {
  await workspaceService.deleteWorkspace(req.workspace!.id, req.user!.id);
  ok(res, null);
}

export async function transferOwnership(req: Request, res: Response): Promise<void> {
  await workspaceService.transferOwnership(req.workspace!.id, req.user!.id, req.body.newOwnerId);
  ok(res, null);
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export async function listMembers(req: Request, res: Response): Promise<void> {
  ok(res, await memberService.listMembers(req.workspace!.id));
}

export async function updateMember(req: Request, res: Response): Promise<void> {
  const result = await memberService.updateMember(
    req.workspace!.id,
    { userId: req.user!.id, role: req.workspace!.role },
    req.params.memberId,
    req.body
  );
  ok(res, result);
}

export async function removeMember(req: Request, res: Response): Promise<void> {
  await memberService.removeMember(
    req.workspace!.id,
    { userId: req.user!.id, role: req.workspace!.role },
    req.params.memberId
  );
  ok(res, null);
}

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

export async function createInvitation(req: Request, res: Response): Promise<void> {
  const inviter = await prisma.user.findUniqueOrThrow({
    where: { id: req.user!.id },
    select: { name: true },
  });
  const invitation = await invitationService.createInvitation(
    req.workspace!.id,
    { userId: req.user!.id, name: inviter.name },
    req.body
  );
  created(res, invitation);
}

export async function listInvitations(req: Request, res: Response): Promise<void> {
  ok(res, await invitationService.listInvitations(req.workspace!.id));
}

export async function revokeInvitation(req: Request, res: Response): Promise<void> {
  await invitationService.revokeInvitation(req.workspace!.id, req.params.invitationId);
  ok(res, null);
}

export async function previewInvitation(req: Request, res: Response): Promise<void> {
  ok(res, await invitationService.previewInvitation(req.params.token));
}

export async function acceptInvitation(req: Request, res: Response): Promise<void> {
  const result = await invitationService.acceptInvitation(req.body.token, {
    id: req.user!.id,
    email: req.user!.email,
  });
  ok(res, result);
}
