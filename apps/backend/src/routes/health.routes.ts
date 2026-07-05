import { Router } from 'express';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { asyncHandler } from '@/utils/async-handler';
import { ok } from '@/utils/response';

export const healthRouter = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Liveness + dependency health
 *     tags: [System]
 *     security: []
 *     responses:
 *       200:
 *         description: Service health report
 */
healthRouter.get(
  '/health',
  asyncHandler(async (_req, res) => {
    const [db, cache] = await Promise.allSettled([
      prisma.$queryRaw`SELECT 1`,
      redis.ping(),
    ]);
    const healthy = db.status === 'fulfilled' && cache.status === 'fulfilled';
    res.status(healthy ? 200 : 503);
    ok(res, {
      status: healthy ? 'healthy' : 'degraded',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      dependencies: {
        database: db.status === 'fulfilled' ? 'up' : 'down',
        redis: cache.status === 'fulfilled' ? 'up' : 'down',
      },
    });
  })
);
