import { PrismaClient } from '@prisma/client';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';

/**
 * Singleton Prisma client. Slow-query logging is enabled in development only.
 */
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function buildClient(): PrismaClient {
  const client = new PrismaClient({
    log: env.isDevelopment
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'error' },
        ]
      : [{ emit: 'event', level: 'error' }],
  });

  // Event types depend on the log config above; cast keeps this localized.
  const emitter = client as unknown as {
    $on(event: 'query', cb: (e: { query: string; duration: number }) => void): void;
    $on(event: 'error', cb: (e: { message: string }) => void): void;
  };
  if (env.isDevelopment) {
    emitter.$on('query', (e) => {
      if (e.duration > 200) logger.debug(`slow query (${e.duration}ms): ${e.query}`);
    });
  }
  emitter.$on('error', (e) => logger.error(`prisma error: ${e.message}`));
  return client;
}

export const prisma: PrismaClient = global.__prisma ?? buildClient();

if (!env.isProduction) {
  global.__prisma = prisma;
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
