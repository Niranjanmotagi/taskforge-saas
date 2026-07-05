import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { PERMISSIONS, roleHasPermission } from '@taskforge/shared-types';
import { asyncHandler } from '@/utils/async-handler';
import { authenticate, authorize, tenantScope, validate, workspaceIdParam } from '@/middlewares';
import { ok, created } from '@/utils/response';
import * as chatService from './chat.service';
import {
  channelIdParam,
  createChannelSchema,
  editMessageSchema,
  messageIdParam,
  messagesQuerySchema,
  reactionSchema,
  sendMessageSchema,
} from './chat.validation';

export const chatRouter = Router();

const auth = [authenticate] as const;

/**
 * @openapi
 * /workspaces/{workspaceId}/channels:
 *   get: { summary: My channels with unread counts, tags: [Chat] }
 *   post: { summary: Create group/direct channel (direct deduped), tags: [Chat] }
 */
chatRouter.get(
  '/workspaces/:workspaceId/channels',
  ...auth,
  validate({ params: workspaceIdParam }),
  tenantScope,
  authorize(PERMISSIONS.CHAT_VIEW),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await chatService.listChannels(req.workspace!.id, req.user!.id));
  })
);
chatRouter.post(
  '/workspaces/:workspaceId/channels',
  ...auth,
  validate({ params: workspaceIdParam, body: createChannelSchema }),
  tenantScope,
  authorize(PERMISSIONS.CHAT_SEND),
  asyncHandler(async (req: Request, res: Response) => {
    created(res, await chatService.createChannel(req.workspace!.id, req.user!.id, req.body));
  })
);

/**
 * @openapi
 * /workspaces/{workspaceId}/tasks/{taskId}/channel:
 *   get: { summary: Get/lazily create the task chat channel, tags: [Chat] }
 */
chatRouter.get(
  '/workspaces/:workspaceId/tasks/:taskId/channel',
  ...auth,
  validate({ params: z.object({ workspaceId: z.string().uuid(), taskId: z.string().uuid() }) }),
  tenantScope,
  authorize(PERMISSIONS.CHAT_VIEW),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await chatService.getTaskChannel(req.workspace!.id, req.params.taskId, req.user!.id));
  })
);

/**
 * @openapi
 * /workspaces/{workspaceId}/channels/{channelId}/messages:
 *   get: { summary: Message history (cursor pagination via before), tags: [Chat] }
 *   post: { summary: Send a message (broadcast + notifications), tags: [Chat] }
 */
chatRouter.get(
  '/workspaces/:workspaceId/channels/:channelId/messages',
  ...auth,
  validate({ params: channelIdParam, query: messagesQuerySchema }),
  tenantScope,
  authorize(PERMISSIONS.CHAT_VIEW),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as never as { limit: number; before?: string };
    ok(res, await chatService.listMessages(req.workspace!.id, req.params.channelId, req.user!.id, q));
  })
);
chatRouter.post(
  '/workspaces/:workspaceId/channels/:channelId/messages',
  ...auth,
  validate({ params: channelIdParam, body: sendMessageSchema }),
  tenantScope,
  authorize(PERMISSIONS.CHAT_SEND),
  asyncHandler(async (req: Request, res: Response) => {
    created(res, await chatService.sendMessage(req.workspace!.id, req.params.channelId, req.user!.id, req.body));
  })
);

chatRouter.patch(
  '/workspaces/:workspaceId/channels/:channelId/messages/:messageId',
  ...auth,
  validate({ params: messageIdParam, body: editMessageSchema }),
  tenantScope,
  authorize(PERMISSIONS.CHAT_SEND),
  asyncHandler(async (req: Request, res: Response) => {
    ok(
      res,
      await chatService.editMessage(
        req.workspace!.id,
        req.params.channelId,
        req.params.messageId,
        req.user!.id,
        req.body.body
      )
    );
  })
);

chatRouter.delete(
  '/workspaces/:workspaceId/channels/:channelId/messages/:messageId',
  ...auth,
  validate({ params: messageIdParam }),
  tenantScope,
  authorize(PERMISSIONS.CHAT_VIEW),
  asyncHandler(async (req: Request, res: Response) => {
    const canModerate = roleHasPermission(req.workspace!.role, PERMISSIONS.CHAT_MANAGE);
    await chatService.deleteMessage(
      req.workspace!.id,
      req.params.channelId,
      req.params.messageId,
      req.user!.id,
      canModerate
    );
    ok(res, null);
  })
);

/**
 * @openapi
 * /workspaces/{workspaceId}/channels/{channelId}/messages/{messageId}/reactions:
 *   post: { summary: Toggle an emoji reaction, tags: [Chat] }
 */
chatRouter.post(
  '/workspaces/:workspaceId/channels/:channelId/messages/:messageId/reactions',
  ...auth,
  validate({ params: messageIdParam, body: reactionSchema }),
  tenantScope,
  authorize(PERMISSIONS.CHAT_SEND),
  asyncHandler(async (req: Request, res: Response) => {
    ok(
      res,
      await chatService.toggleReaction(
        req.workspace!.id,
        req.params.channelId,
        req.params.messageId,
        req.user!.id,
        req.body.emoji
      )
    );
  })
);

/**
 * @openapi
 * /workspaces/{workspaceId}/channels/{channelId}/read:
 *   post: { summary: Mark channel read (receipts + lastReadAt), tags: [Chat] }
 */
chatRouter.post(
  '/workspaces/:workspaceId/channels/:channelId/read',
  ...auth,
  validate({ params: channelIdParam }),
  tenantScope,
  authorize(PERMISSIONS.CHAT_VIEW),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await chatService.markRead(req.workspace!.id, req.params.channelId, req.user!.id));
  })
);

/**
 * @openapi
 * /workspaces/{workspaceId}/channels/{channelId}/members:
 *   post: { summary: Add a member to a group channel, tags: [Chat] }
 */
chatRouter.post(
  '/workspaces/:workspaceId/channels/:channelId/members',
  ...auth,
  validate({ params: channelIdParam, body: z.object({ userId: z.string().uuid() }) }),
  tenantScope,
  authorize(PERMISSIONS.CHAT_SEND),
  asyncHandler(async (req: Request, res: Response) => {
    created(
      res,
      await chatService.addChannelMember(req.workspace!.id, req.params.channelId, req.user!.id, req.body.userId)
    );
  })
);
