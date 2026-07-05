import { ChannelType } from '@taskforge/shared-types';
import { prisma } from '@/lib/prisma';
import { env } from '@/config/env';
import { ApiError } from '@/utils/api-error';
import { notify } from '@/services/notification.service';
import { emitToChannel, emitToUser, SOCKET_EVENTS } from '@/services/realtime.service';

const MESSAGE_INCLUDE = {
  sender: { select: { id: true, name: true, avatarUrl: true } },
  reactions: { select: { emoji: true, userId: true } },
  reads: { select: { userId: true, readAt: true } },
} as const;

function groupReactions(reactions: Array<{ emoji: string; userId: string }>) {
  const grouped = new Map<string, string[]>();
  for (const r of reactions) {
    grouped.set(r.emoji, [...(grouped.get(r.emoji) ?? []), r.userId]);
  }
  return [...grouped.entries()].map(([emoji, userIds]) => ({ emoji, userIds }));
}

function shapeMessage(message: {
  reactions: Array<{ emoji: string; userId: string }>;
  reads: Array<{ userId: string }>;
} & Record<string, unknown>) {
  const { reactions, reads, ...rest } = message;
  return {
    ...rest,
    reactions: groupReactions(reactions),
    readBy: reads.map((r) => r.userId),
  };
}

async function getMembership(channelId: string, userId: string) {
  const member = await prisma.channelMember.findFirst({
    where: { channelId, userId, channel: { deletedAt: null } },
    include: { channel: { select: { id: true, workspaceId: true, type: true, name: true } } },
  });
  if (!member) throw ApiError.forbidden('You are not a member of this channel');
  return member;
}

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------

export async function listChannels(workspaceId: string, userId: string) {
  const channels = await prisma.channel.findMany({
    where: {
      workspaceId,
      deletedAt: null,
      members: { some: { userId } },
    },
    orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'asc' }],
    include: {
      members: {
        select: {
          userId: true,
          lastReadAt: true,
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      },
      project: { select: { id: true, name: true, color: true } },
      task: { select: { id: true, title: true, number: true } },
      _count: { select: { messages: { where: { deletedAt: null } } } },
    },
  });

  // Unread counts per channel relative to the member's lastReadAt.
  return Promise.all(
    channels.map(async (channel) => {
      const me = channel.members.find((m) => m.userId === userId);
      const unreadCount = await prisma.message.count({
        where: {
          channelId: channel.id,
          deletedAt: null,
          senderId: { not: userId },
          ...(me?.lastReadAt ? { createdAt: { gt: me.lastReadAt } } : {}),
        },
      });
      const { _count, ...rest } = channel;
      return { ...rest, messageCount: _count.messages, unreadCount };
    })
  );
}

export async function createChannel(
  workspaceId: string,
  creatorId: string,
  input: { type: 'GROUP' | 'DIRECT'; name?: string; memberIds: string[] }
) {
  const memberIds = [...new Set([creatorId, ...input.memberIds])];

  const validCount = await prisma.workspaceMember.count({
    where: { workspaceId, userId: { in: memberIds } },
  });
  if (validCount !== memberIds.length) {
    throw ApiError.badRequest('All members must belong to this workspace');
  }

  if (input.type === 'DIRECT') {
    const directKey = [creatorId, input.memberIds[0]].sort().join(':');
    const existing = await prisma.channel.findUnique({ where: { directKey } });
    if (existing && !existing.deletedAt) return existing;

    return prisma.channel.create({
      data: {
        workspaceId,
        type: ChannelType.DIRECT,
        directKey,
        createdById: creatorId,
        members: { create: memberIds.map((userId) => ({ userId })) },
      },
    });
  }

  return prisma.channel.create({
    data: {
      workspaceId,
      type: ChannelType.GROUP,
      name: input.name,
      createdById: creatorId,
      members: {
        create: memberIds.map((userId) => ({ userId, isAdmin: userId === creatorId })),
      },
    },
  });
}

/** Get or lazily create the channel bound to a task (task chat). */
export async function getTaskChannel(workspaceId: string, taskId: string, userId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, workspaceId, deletedAt: null },
    select: { id: true, title: true, projectId: true },
  });
  if (!task) throw ApiError.notFound('Task');

  let channel = await prisma.channel.findFirst({
    where: { workspaceId, taskId, deletedAt: null },
  });
  if (!channel) {
    channel = await prisma.channel.create({
      data: {
        workspaceId,
        type: ChannelType.TASK,
        name: task.title.slice(0, 80),
        taskId,
        projectId: task.projectId,
        createdById: userId,
        members: { create: { userId, isAdmin: true } },
      },
    });
  } else {
    await prisma.channelMember.upsert({
      where: { channelId_userId: { channelId: channel.id, userId } },
      create: { channelId: channel.id, userId },
      update: {},
    });
  }
  return channel;
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export async function listMessages(
  workspaceId: string,
  channelId: string,
  userId: string,
  query: { limit: number; before?: string }
) {
  const membership = await getMembership(channelId, userId);
  if (membership.channel.workspaceId !== workspaceId) throw ApiError.notFound('Channel');

  // Cursor pagination: messages strictly older than `before`.
  let beforeDate: Date | undefined;
  if (query.before) {
    const anchor = await prisma.message.findFirst({
      where: { id: query.before, channelId },
      select: { createdAt: true },
    });
    beforeDate = anchor?.createdAt;
  }

  const messages = await prisma.message.findMany({
    where: {
      channelId,
      deletedAt: null,
      ...(beforeDate ? { createdAt: { lt: beforeDate } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: query.limit,
    include: MESSAGE_INCLUDE,
  });

  return messages.reverse().map(shapeMessage);
}

export async function sendMessage(
  workspaceId: string,
  channelId: string,
  senderId: string,
  input: { body: string; attachmentUrl?: string }
) {
  const membership = await getMembership(channelId, senderId);
  if (membership.channel.workspaceId !== workspaceId) throw ApiError.notFound('Channel');

  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: { channelId, senderId, body: input.body, attachmentUrl: input.attachmentUrl },
      include: MESSAGE_INCLUDE,
    }),
    prisma.channel.update({ where: { id: channelId }, data: { lastMessageAt: new Date() } }),
    // Sending implies having read up to now.
    prisma.channelMember.update({
      where: { channelId_userId: { channelId, userId: senderId } },
      data: { lastReadAt: new Date() },
    }),
  ]);

  const shaped = shapeMessage(message);
  emitToChannel(channelId, SOCKET_EVENTS.MESSAGE_NEW, shaped);

  // Notify muted-aware offline members (in-app entry; sockets cover online).
  const others = await prisma.channelMember.findMany({
    where: {
      channelId,
      userId: { not: senderId },
      OR: [{ mutedUntil: null }, { mutedUntil: { lt: new Date() } }],
    },
    select: { userId: true },
  });
  if (others.length > 0) {
    const channelLabel = membership.channel.name ?? 'a conversation';
    void notify(
      others.map((m) => m.userId),
      {
        type: 'CHAT_MESSAGE',
        title: `New message in ${channelLabel}`,
        body: input.body.slice(0, 200),
        link: `${env.APP_URL}/w/${workspaceId}/chat/${channelId}`,
        workspaceId,
        metadata: { channelId, messageId: message.id },
      }
    );
  }

  return shaped;
}

export async function editMessage(
  workspaceId: string,
  channelId: string,
  messageId: string,
  userId: string,
  body: string
) {
  await getMembership(channelId, userId);
  const message = await prisma.message.findFirst({
    where: { id: messageId, channelId, deletedAt: null },
  });
  if (!message) throw ApiError.notFound('Message');
  if (message.senderId !== userId) throw ApiError.forbidden('You can only edit your own messages');

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { body, isEdited: true },
    include: MESSAGE_INCLUDE,
  });
  const shaped = shapeMessage(updated);
  emitToChannel(channelId, SOCKET_EVENTS.MESSAGE_UPDATED, shaped);
  return shaped;
}

export async function deleteMessage(
  workspaceId: string,
  channelId: string,
  messageId: string,
  userId: string,
  canModerate: boolean
): Promise<void> {
  const membership = await getMembership(channelId, userId);
  const message = await prisma.message.findFirst({
    where: { id: messageId, channelId, deletedAt: null },
  });
  if (!message) throw ApiError.notFound('Message');
  if (message.senderId !== userId && !canModerate && !membership.isAdmin) {
    throw ApiError.forbidden('You can only delete your own messages');
  }
  await prisma.message.update({ where: { id: messageId }, data: { deletedAt: new Date() } });
  emitToChannel(channelId, SOCKET_EVENTS.MESSAGE_DELETED, { channelId, messageId });
}

// ---------------------------------------------------------------------------
// Reactions & read receipts
// ---------------------------------------------------------------------------

export async function toggleReaction(
  workspaceId: string,
  channelId: string,
  messageId: string,
  userId: string,
  emoji: string
) {
  await getMembership(channelId, userId);
  const message = await prisma.message.findFirst({
    where: { id: messageId, channelId, deletedAt: null },
    select: { id: true },
  });
  if (!message) throw ApiError.notFound('Message');

  const existing = await prisma.messageReaction.findUnique({
    where: { messageId_userId_emoji: { messageId, userId, emoji } },
  });
  if (existing) {
    await prisma.messageReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.messageReaction.create({ data: { messageId, userId, emoji } });
  }

  const reactions = await prisma.messageReaction.findMany({
    where: { messageId },
    select: { emoji: true, userId: true },
  });
  const payload = { channelId, messageId, reactions: groupReactions(reactions) };
  emitToChannel(channelId, SOCKET_EVENTS.MESSAGE_REACTION, payload);
  return payload;
}

/** Mark the channel read up to now (updates receipts for listed messages). */
export async function markRead(workspaceId: string, channelId: string, userId: string) {
  await getMembership(channelId, userId);
  const now = new Date();

  await prisma.channelMember.update({
    where: { channelId_userId: { channelId, userId } },
    data: { lastReadAt: now },
  });

  // Read receipts for the latest window of others' messages.
  const recent = await prisma.message.findMany({
    where: { channelId, deletedAt: null, senderId: { not: userId } },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true },
  });
  if (recent.length > 0) {
    await prisma.messageRead.createMany({
      data: recent.map((m) => ({ messageId: m.id, userId })),
      skipDuplicates: true,
    });
  }

  emitToChannel(channelId, SOCKET_EVENTS.MESSAGE_READ, { channelId, userId, readAt: now.toISOString() });
  return { readAt: now };
}

/** Add someone to a group channel. */
export async function addChannelMember(
  workspaceId: string,
  channelId: string,
  actorId: string,
  newMemberId: string
) {
  const membership = await getMembership(channelId, actorId);
  if (membership.channel.workspaceId !== workspaceId) throw ApiError.notFound('Channel');
  if (membership.channel.type === 'DIRECT') {
    throw ApiError.badRequest('Direct conversations cannot add members');
  }

  const isWorkspaceMember = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId: newMemberId },
    select: { id: true },
  });
  if (!isWorkspaceMember) throw ApiError.badRequest('User is not in this workspace');

  const added = await prisma.channelMember.upsert({
    where: { channelId_userId: { channelId, userId: newMemberId } },
    create: { channelId, userId: newMemberId },
    update: {},
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });

  emitToUser(newMemberId, SOCKET_EVENTS.NOTIFICATION_NEW, {
    type: 'CHAT_MESSAGE',
    title: `You were added to ${membership.channel.name ?? 'a conversation'}`,
    workspaceId,
  });

  return added;
}
