import type { Server as SocketServer } from 'socket.io';
import { SOCKET_EVENTS, type SocketEvent } from '@taskforge/shared-types';

/**
 * Thin broadcast facade so domain services can emit realtime events without
 * knowing about socket.io internals. No-ops before the gateway initializes
 * (unit tests, one-off scripts).
 */

let io: SocketServer | null = null;

export function setIoRef(server: SocketServer): void {
  io = server;
}

export function emitToWorkspace(workspaceId: string, event: SocketEvent, payload: unknown): void {
  io?.to(`workspace:${workspaceId}`).emit(event, payload);
}

export function emitToProject(projectId: string, event: SocketEvent, payload: unknown): void {
  io?.to(`project:${projectId}`).emit(event, payload);
}

export function emitToChannel(channelId: string, event: SocketEvent, payload: unknown): void {
  io?.to(`channel:${channelId}`).emit(event, payload);
}

export function emitToUser(userId: string, event: SocketEvent, payload: unknown): void {
  io?.to(`user:${userId}`).emit(event, payload);
}

export { SOCKET_EVENTS };
