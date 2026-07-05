import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { env } from '@/config/env';
import { redis } from '@/lib/redis';
import { ApiError } from '@/utils/api-error';

function buildStore(prefix: string): RedisStore | undefined {
  // In tests, fall back to the in-memory store to avoid Redis dependency.
  if (env.isTest) return undefined;
  return new RedisStore({
    // ioredis `call` signature matches the expected sendCommand
    sendCommand: (...args: string[]) => redis.call(args[0], ...args.slice(1)) as never,
    prefix: `rl:${prefix}:`,
  });
}

import type { NextFunction, Request, Response } from 'express';

const handler = (_req: Request, _res: Response, next: NextFunction): void => {
  next(ApiError.tooManyRequests());
};

/** Global API limiter (per IP). */
export const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  store: buildStore('api'),
  handler,
});

/** Strict limiter for credential endpoints (login, register, reset). */
export const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  store: buildStore('auth'),
  skipSuccessfulRequests: true,
  handler,
});

/** Moderate limiter for expensive endpoints (AI, reports, uploads). */
export const heavyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  store: buildStore('heavy'),
  handler,
});
