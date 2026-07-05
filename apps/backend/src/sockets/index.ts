import type { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';

let io: SocketServer | null = null;

/** Initialize the Socket.IO gateway. Handlers are registered in ./gateway. */
export function initSocketServer(server: HttpServer): SocketServer {
  io = new SocketServer(server, {
    cors: { origin: env.corsOrigins, credentials: true },
    path: '/socket.io',
  });

  // Register auth middleware + event handlers (implemented in realtime module).
  import('./gateway')
    .then(({ registerGateway }) => registerGateway(io as SocketServer))
    .catch((err) => logger.error(`socket gateway failed to register: ${err.message}`));

  logger.info('socket.io gateway initialized');
  return io;
}

/** Access the live Socket.IO server (null before init — e.g. in unit tests). */
export function getIo(): SocketServer | null {
  return io;
}
