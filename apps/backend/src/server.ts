import http from 'http';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import { createApp } from '@/app';
import { disconnectPrisma } from '@/lib/prisma';
import { disconnectRedis } from '@/lib/redis';

async function main(): Promise<void> {
  const app = createApp();
  const server = http.createServer(app);

  // Realtime gateway (Socket.IO) attaches to the same HTTP server.
  const { initSocketServer } = await import('@/sockets');
  initSocketServer(server);

  // Background workers + schedulers (BullMQ, cron).
  const { startWorkers } = await import('@/queues');
  startWorkers();
  const { startCronJobs } = await import('@/jobs');
  startCronJobs();

  server.listen(env.port, () => {
    logger.info(`🚀 ${env.APP_NAME} API listening on :${env.port} (${env.NODE_ENV})`);
    if (!env.isProduction) {
      logger.info(`📘 Swagger docs at ${env.API_URL}/api/docs`);
    }
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(async () => {
      await Promise.allSettled([disconnectPrisma(), disconnectRedis()]);
      process.exit(0);
    });
    // Force-exit if connections refuse to drain.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    logger.error(`unhandledRejection: ${reason instanceof Error ? reason.stack : String(reason)}`);
  });
  process.on('uncaughtException', (err) => {
    logger.error(`uncaughtException: ${err.stack ?? err.message}`);
    process.exit(1);
  });
}

void main();
