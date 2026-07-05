import { z } from 'zod';
import { paginationSchema } from '@/utils/pagination';

export const createChannelSchema = z
  .object({
    type: z.enum(['GROUP', 'DIRECT']),
    name: z.string().trim().min(1).max(80).optional(),
    memberIds: z.array(z.string().uuid()).min(1).max(100),
  })
  .refine((v) => v.type !== 'GROUP' || Boolean(v.name), {
    message: 'Group channels require a name',
    path: ['name'],
  })
  .refine((v) => v.type !== 'DIRECT' || v.memberIds.length === 1, {
    message: 'Direct channels take exactly one other member',
    path: ['memberIds'],
  });

export const sendMessageSchema = z.object({
  body: z.string().trim().min(1, 'Message cannot be empty').max(8000),
  attachmentUrl: z.string().url().optional(),
});

export const editMessageSchema = z.object({
  body: z.string().trim().min(1).max(8000),
});

export const reactionSchema = z.object({
  emoji: z.string().min(1).max(16),
});

export const messagesQuerySchema = paginationSchema.extend({
  before: z.string().uuid().optional(),
});

export const channelIdParam = z.object({
  workspaceId: z.string().uuid(),
  channelId: z.string().uuid(),
});

export const messageIdParam = z.object({
  workspaceId: z.string().uuid(),
  channelId: z.string().uuid(),
  messageId: z.string().uuid(),
});
