/**
 * Socket.IO event contract — single source of truth for event names and payloads.
 */

export const SOCKET_EVENTS = {
  // Connection lifecycle
  JOIN_WORKSPACE: 'workspace:join',
  LEAVE_WORKSPACE: 'workspace:leave',
  JOIN_PROJECT: 'project:join',
  LEAVE_PROJECT: 'project:leave',
  JOIN_CHANNEL: 'channel:join',
  LEAVE_CHANNEL: 'channel:leave',

  // Presence
  PRESENCE_ONLINE: 'presence:online',
  PRESENCE_OFFLINE: 'presence:offline',
  PRESENCE_LIST: 'presence:list',
  CURSOR_MOVE: 'cursor:move',

  // Tasks
  TASK_CREATED: 'task:created',
  TASK_UPDATED: 'task:updated',
  TASK_DELETED: 'task:deleted',
  TASK_MOVED: 'task:moved',

  // Comments
  COMMENT_CREATED: 'comment:created',
  COMMENT_UPDATED: 'comment:updated',
  COMMENT_DELETED: 'comment:deleted',

  // Chat
  MESSAGE_NEW: 'message:new',
  MESSAGE_UPDATED: 'message:updated',
  MESSAGE_DELETED: 'message:deleted',
  MESSAGE_REACTION: 'message:reaction',
  MESSAGE_READ: 'message:read',
  TYPING_START: 'typing:start',
  TYPING_STOP: 'typing:stop',

  // Notifications
  NOTIFICATION_NEW: 'notification:new',

  // Projects
  PROJECT_UPDATED: 'project:updated',
} as const;

export type SocketEvent = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];

export interface PresencePayload {
  userId: string;
  workspaceId: string;
  status: 'online' | 'offline';
  lastSeenAt: string;
}

export interface TypingPayload {
  channelId: string;
  userId: string;
  userName: string;
}

export interface CursorPayload {
  userId: string;
  userName: string;
  boardId: string;
  x: number;
  y: number;
  color: string;
}

export interface TaskMovedPayload {
  taskId: string;
  projectId: string;
  fromColumnId: string | null;
  toColumnId: string;
  position: string;
  movedById: string;
}
