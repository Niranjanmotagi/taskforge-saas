import type { Server as SocketServer } from 'socket.io';
import { logger } from '@/lib/logger';

/**
 * Placeholder gateway — replaced by the realtime module (auth middleware,
 * workspace rooms, presence, chat, live updates).
 */
export function registerGateway(_io: SocketServer): void {
  logger.debug('socket gateway: no handlers registered yet');
}
