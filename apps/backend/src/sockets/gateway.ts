import type { Server as SocketServer, Socket } from 'socket.io';
import { SOCKET_EVENTS } from '@taskforge/shared-types';
import { verifyAccessToken } from '@/utils/jwt';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { registerRealtimeEmitter } from '@/services/notification.service';
import { setIoRef } from '@/services/realtime.service';

const PRESENCE_TTL_SECONDS = 90;

interface AuthedSocket extends Socket {
  data: { userId: string; name: string };
}

function presenceKey(workspaceId: string): string {
  return `presence:${workspaceId}`;
}

async function isMember(workspaceId: string, userId: string): Promise<boolean> {
  const member = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId, workspace: { deletedAt: null } },
    select: { id: true },
  });
  return Boolean(member);
}

async function isChannelMember(channelId: string, userId: string): Promise<boolean> {
  const member = await prisma.channelMember.findFirst({
    where: { channelId, userId, channel: { deletedAt: null } },
    select: { id: true },
  });
  return Boolean(member);
}

/**
 * Socket.IO gateway: JWT handshake auth, tenant-checked room joins,
 * presence via redis, typing indicators, live cursors.
 */
export function registerGateway(io: SocketServer): void {
  setIoRef(io);

  // Notification fan-out to connected devices.
  registerRealtimeEmitter((userId, notification) => {
    io.to(`user:${userId}`).emit(SOCKET_EVENTS.NOTIFICATION_NEW, notification);
  });

  io.use(async (socket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ??
        (socket.handshake.headers.authorization?.startsWith('Bearer ')
          ? socket.handshake.headers.authorization.slice(7)
          : undefined);
      if (!token) return next(new Error('Authentication required'));

      const payload = verifyAccessToken(token);
      const user = await prisma.user.findFirst({
        where: { id: payload.sub, deletedAt: null, isActive: true },
        select: { id: true, name: true },
      });
      if (!user) return next(new Error('Account unavailable'));

      (socket as AuthedSocket).data = { userId: user.id, name: user.name };
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (rawSocket) => {
    const socket = rawSocket as AuthedSocket;
    const { userId, name } = socket.data;
    void socket.join(`user:${userId}`);
    logger.debug(`socket connected user=${userId}`);

    // ---------------- workspace rooms + presence ----------------

    socket.on(SOCKET_EVENTS.JOIN_WORKSPACE, async (workspaceId: string, ack?: (ok: boolean) => void) => {
      if (typeof workspaceId !== 'string' || !(await isMember(workspaceId, userId))) {
        ack?.(false);
        return;
      }
      await socket.join(`workspace:${workspaceId}`);
      await redis.sadd(presenceKey(workspaceId), userId);
      await redis.expire(presenceKey(workspaceId), PRESENCE_TTL_SECONDS * 4);
      socket.to(`workspace:${workspaceId}`).emit(SOCKET_EVENTS.PRESENCE_ONLINE, {
        userId,
        workspaceId,
        status: 'online',
        lastSeenAt: new Date().toISOString(),
      });
      const online = await redis.smembers(presenceKey(workspaceId));
      socket.emit(SOCKET_EVENTS.PRESENCE_LIST, { workspaceId, userIds: online });
      ack?.(true);
    });

    socket.on(SOCKET_EVENTS.LEAVE_WORKSPACE, async (workspaceId: string) => {
      await socket.leave(`workspace:${workspaceId}`);
      await handleWorkspaceExit(io, socket, workspaceId);
    });

    // ---------------- project + channel rooms ----------------

    socket.on(SOCKET_EVENTS.JOIN_PROJECT, async (payload: { workspaceId: string; projectId: string }, ack?: (ok: boolean) => void) => {
      if (
        !payload?.workspaceId ||
        !payload?.projectId ||
        !(await isMember(payload.workspaceId, userId))
      ) {
        ack?.(false);
        return;
      }
      const project = await prisma.project.findFirst({
        where: { id: payload.projectId, workspaceId: payload.workspaceId, deletedAt: null },
        select: { id: true },
      });
      if (!project) {
        ack?.(false);
        return;
      }
      await socket.join(`project:${payload.projectId}`);
      ack?.(true);
    });

    socket.on(SOCKET_EVENTS.LEAVE_PROJECT, (payload: { projectId: string }) => {
      if (payload?.projectId) void socket.leave(`project:${payload.projectId}`);
    });

    socket.on(SOCKET_EVENTS.JOIN_CHANNEL, async (channelId: string, ack?: (ok: boolean) => void) => {
      if (typeof channelId !== 'string' || !(await isChannelMember(channelId, userId))) {
        ack?.(false);
        return;
      }
      await socket.join(`channel:${channelId}`);
      ack?.(true);
    });

    socket.on(SOCKET_EVENTS.LEAVE_CHANNEL, (channelId: string) => {
      if (typeof channelId === 'string') void socket.leave(`channel:${channelId}`);
    });

    // ---------------- typing indicators ----------------

    socket.on(SOCKET_EVENTS.TYPING_START, (payload: { channelId: string }) => {
      if (!payload?.channelId) return;
      socket.to(`channel:${payload.channelId}`).emit(SOCKET_EVENTS.TYPING_START, {
        channelId: payload.channelId,
        userId,
        userName: name,
      });
    });

    socket.on(SOCKET_EVENTS.TYPING_STOP, (payload: { channelId: string }) => {
      if (!payload?.channelId) return;
      socket.to(`channel:${payload.channelId}`).emit(SOCKET_EVENTS.TYPING_STOP, {
        channelId: payload.channelId,
        userId,
        userName: name,
      });
    });

    // ---------------- live cursors (boards) ----------------

    socket.on(SOCKET_EVENTS.CURSOR_MOVE, (payload: { projectId: string; x: number; y: number; color: string }) => {
      if (!payload?.projectId) return;
      socket.to(`project:${payload.projectId}`).emit(SOCKET_EVENTS.CURSOR_MOVE, {
        userId,
        userName: name,
        boardId: payload.projectId,
        x: payload.x,
        y: payload.y,
        color: payload.color,
      });
    });

    // ---------------- disconnect ----------------

    // 'disconnecting' (not 'disconnect') — socket.rooms is still populated here;
    // it is already cleared by the time 'disconnect' fires.
    socket.on('disconnecting', async () => {
      // Remove presence from every workspace room this socket had joined.
      for (const room of socket.rooms) {
        if (room.startsWith('workspace:')) {
          await handleWorkspaceExit(io, socket, room.slice('workspace:'.length));
        }
      }
      logger.debug(`socket disconnected user=${userId}`);
    });
  });
}

/** Drop presence if this was the user's last socket in the workspace. */
async function handleWorkspaceExit(io: SocketServer, socket: AuthedSocket, workspaceId: string): Promise<void> {
  const { userId } = socket.data;
  const room = io.sockets.adapter.rooms.get(`workspace:${workspaceId}`);
  let stillConnected = false;
  if (room) {
    for (const sid of room) {
      const s = io.sockets.sockets.get(sid) as AuthedSocket | undefined;
      if (s && s.id !== socket.id && s.data.userId === userId) {
        stillConnected = true;
        break;
      }
    }
  }
  if (!stillConnected) {
    await redis.srem(presenceKey(workspaceId), userId);
    io.to(`workspace:${workspaceId}`).emit(SOCKET_EVENTS.PRESENCE_OFFLINE, {
      userId,
      workspaceId,
      status: 'offline',
      lastSeenAt: new Date().toISOString(),
    });
  }
}
