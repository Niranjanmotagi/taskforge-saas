import type { NextFunction, Request, Response } from 'express';
import { ERROR_CODES } from '@taskforge/shared-types';
import { verifyAccessToken } from '@/utils/jwt';
import { ApiError } from '@/utils/api-error';
import { redis } from '@/lib/redis';

const SESSION_REVOKED_PREFIX = 'session:revoked:';

/** Mark a session id as revoked (written on logout / rotation theft). */
export async function markSessionRevoked(sessionId: string, ttlSeconds: number): Promise<void> {
  await redis.set(`${SESSION_REVOKED_PREFIX}${sessionId}`, '1', 'EX', ttlSeconds);
}

/**
 * JWT authentication. Accepts `Authorization: Bearer <token>`.
 * Rejects tokens whose backing session has been revoked (logout-everywhere).
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw ApiError.unauthorized();
    }
    const payload = verifyAccessToken(header.slice('Bearer '.length));

    const revoked = await redis.get(`${SESSION_REVOKED_PREFIX}${payload.sid}`);
    if (revoked) {
      throw ApiError.unauthorized('Session has been revoked', ERROR_CODES.TOKEN_INVALID);
    }

    req.user = {
      id: payload.sub,
      email: payload.email,
      systemRole: payload.systemRole,
      sessionId: payload.sid,
    };
    next();
  } catch (err) {
    next(err);
  }
}

/** Restrict a route to platform super-admins. */
export function requireSuperAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) return next(ApiError.unauthorized());
  if (req.user.systemRole !== 'SUPER_ADMIN') return next(ApiError.forbidden());
  next();
}
