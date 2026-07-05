import jwt, { type SignOptions } from 'jsonwebtoken';
import { ERROR_CODES, type SystemRole } from '@taskforge/shared-types';
import { env } from '@/config/env';
import { ApiError } from '@/utils/api-error';

export interface AccessTokenPayload {
  /** User id. */
  sub: string;
  email: string;
  systemRole: SystemRole;
  /** Session id backing this token — lets us revoke access on logout. */
  sid: string;
}

const ACCESS_OPTIONS: SignOptions = {
  expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'],
  issuer: 'taskforge',
  audience: 'taskforge-api',
};

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, ACCESS_OPTIONS);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: 'taskforge',
      audience: 'taskforge-api',
    }) as AccessTokenPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw ApiError.unauthorized('Access token expired', ERROR_CODES.TOKEN_EXPIRED);
    }
    throw ApiError.unauthorized('Invalid access token', ERROR_CODES.TOKEN_INVALID);
  }
}

/** Access token TTL in seconds (for client expiry hints). */
export function accessTokenTtlSeconds(): number {
  const value = env.JWT_ACCESS_EXPIRES_IN;
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) return 900;
  const n = Number(match[1]);
  const mult = { s: 1, m: 60, h: 3600, d: 86400 }[match[2] as 's' | 'm' | 'h' | 'd'];
  return n * mult;
}
