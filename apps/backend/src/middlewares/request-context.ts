import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '@/lib/logger';

/**
 * Attaches a request id, exposes it via X-Request-Id, and logs request
 * completion with latency. First middleware in the chain.
 */
export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) ?? randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1_000_000;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'http';
    logger.log(level, `${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms`, {
      requestId,
      userId: req.user?.id,
      ip: req.ip,
    });
  });

  next();
}
