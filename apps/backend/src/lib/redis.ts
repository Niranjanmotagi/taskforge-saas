import Redis from 'ioredis';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';

function createRedisClient(purpose: string): Redis {
  // BullMQ requires maxRetriesPerRequest to be null on its connections.
  const maxRetriesPerRequest = purpose === 'queue' ? null : 2;
  const retryStrategy = (times: number) => Math.min(times * 200, 5000);
  // Managed hosts (Upstash/Render) provide a single rediss:// URL with TLS.
  const client = env.REDIS_URL
    ? new Redis(env.REDIS_URL, { maxRetriesPerRequest, retryStrategy })
    : new Redis({
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest,
        retryStrategy,
      });
  client.on('error', (err) => logger.error(`redis(${purpose}) error: ${err.message}`));
  client.on('connect', () => logger.info(`redis(${purpose}) connected`));
  return client;
}

/** General-purpose cache / presence / rate-limit client. */
export const redis = createRedisClient('cache');

/** Dedicated connection factory for BullMQ (it manages blocking commands). */
export function createQueueConnection(): Redis {
  return createRedisClient('queue');
}

/**
 * Plain connection options for BullMQ. BullMQ bundles its own ioredis, so
 * passing our client instance trips duplicate-type errors — options avoid it.
 */
export function queueConnectionOptions(): { host: string; port: number; password?: string; maxRetriesPerRequest: null } {
  return {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
  };
}

export async function disconnectRedis(): Promise<void> {
  await redis.quit().catch(() => redis.disconnect());
}

// ---------------------------------------------------------------------------
// Small cache helpers
// ---------------------------------------------------------------------------

export async function cacheGet<T>(key: string): Promise<T | null> {
  const raw = await redis.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
}

export async function cacheDel(...keys: string[]): Promise<void> {
  if (keys.length > 0) await redis.del(...keys);
}

/** Delete keys by prefix (used for workspace-scoped invalidation). */
export async function cacheDelByPrefix(prefix: string): Promise<void> {
  const stream = redis.scanStream({ match: `${prefix}*`, count: 100 });
  const toDelete: string[] = [];
  for await (const keys of stream) {
    toDelete.push(...(keys as string[]));
  }
  if (toDelete.length > 0) await redis.del(...toDelete);
}
