import { UAParser } from 'ua-parser-js';
import type { Session, User } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { env } from '@/config/env';
import { randomToken, sha256 } from '@/utils/crypto';
import { signAccessToken, accessTokenTtlSeconds } from '@/utils/jwt';
import { markSessionRevoked } from '@/middlewares/authenticate';
import { ApiError } from '@/utils/api-error';
import { ERROR_CODES, type SystemRole } from '@taskforge/shared-types';
import { audit } from '@/services/audit.service';

export interface DeviceInfo {
  ip?: string | null;
  userAgent?: string | null;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  session: Session;
}

function refreshTtlMs(rememberMe: boolean): number {
  const spec = rememberMe ? env.JWT_REFRESH_REMEMBER_EXPIRES_IN : env.JWT_REFRESH_EXPIRES_IN;
  const match = /^(\d+)([smhd])$/.exec(spec);
  const mult = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  if (!match) return 7 * mult.d;
  return Number(match[1]) * mult[match[2] as keyof typeof mult];
}

function parseDevice(userAgent?: string | null): { browser: string; os: string } {
  if (!userAgent) return { browser: 'Unknown', os: 'Unknown' };
  const parsed = new UAParser(userAgent).getResult();
  return {
    browser: [parsed.browser.name, parsed.browser.major].filter(Boolean).join(' ') || 'Unknown',
    os: [parsed.os.name, parsed.os.version].filter(Boolean).join(' ') || 'Unknown',
  };
}

/** Create a new device session and issue the token pair. */
export async function createSession(
  user: Pick<User, 'id' | 'email' | 'systemRole'>,
  device: DeviceInfo,
  rememberMe: boolean
): Promise<IssuedTokens> {
  const refreshToken = randomToken();
  const { browser, os } = parseDevice(device.userAgent);

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: sha256(refreshToken),
      userAgent: device.userAgent?.slice(0, 500),
      browser,
      os,
      ip: device.ip ?? undefined,
      rememberMe,
      expiresAt: new Date(Date.now() + refreshTtlMs(rememberMe)),
    },
  });

  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    systemRole: user.systemRole as SystemRole,
    sid: session.id,
  });

  return { accessToken, refreshToken, expiresIn: accessTokenTtlSeconds(), session };
}

/**
 * Rotate a refresh token. Detects reuse of an already-rotated token
 * (credential theft signal) and revokes the session when it happens.
 */
export async function rotateSession(rawToken: string, device: DeviceInfo): Promise<IssuedTokens> {
  const hash = sha256(rawToken);

  const session = await prisma.session.findFirst({
    where: { OR: [{ tokenHash: hash }, { previousHash: hash }] },
    include: { user: { select: { id: true, email: true, systemRole: true, isActive: true, deletedAt: true } } },
  });

  if (!session) {
    throw ApiError.unauthorized('Invalid refresh token', ERROR_CODES.TOKEN_INVALID);
  }

  // Reuse of a superseded token => assume theft, kill the session.
  if (session.previousHash === hash && session.tokenHash !== hash) {
    await revokeSession(session.id, session.userId);
    audit('TOKEN_REUSE_DETECTED', {
      userId: session.userId,
      ip: device.ip,
      userAgent: device.userAgent,
      metadata: { sessionId: session.id },
    });
    throw ApiError.unauthorized('Refresh token reuse detected — session revoked', ERROR_CODES.TOKEN_INVALID);
  }

  if (session.revokedAt || session.expiresAt < new Date()) {
    throw ApiError.unauthorized('Session expired', ERROR_CODES.TOKEN_EXPIRED);
  }
  if (!session.user.isActive || session.user.deletedAt) {
    throw ApiError.unauthorized('Account is disabled', ERROR_CODES.UNAUTHORIZED);
  }

  const newToken = randomToken();
  const updated = await prisma.session.update({
    where: { id: session.id },
    data: {
      tokenHash: sha256(newToken),
      previousHash: hash,
      rotatedAt: new Date(),
      lastActivityAt: new Date(),
      ip: device.ip ?? session.ip,
      expiresAt: new Date(Date.now() + refreshTtlMs(session.rememberMe)),
    },
  });

  audit('TOKEN_REFRESHED', { userId: session.userId, ip: device.ip, userAgent: device.userAgent });

  const accessToken = signAccessToken({
    sub: session.user.id,
    email: session.user.email,
    systemRole: session.user.systemRole as SystemRole,
    sid: session.id,
  });

  return { accessToken, refreshToken: newToken, expiresIn: accessTokenTtlSeconds(), session: updated };
}

/** Revoke one session (logout / remote sign-out) and blacklist its access tokens. */
export async function revokeSession(sessionId: string, userId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await markSessionRevoked(sessionId, accessTokenTtlSeconds());
}

/** Revoke every session for a user (password reset, logout-everywhere). */
export async function revokeAllSessions(userId: string, exceptSessionId?: string): Promise<number> {
  const sessions = await prisma.session.findMany({
    where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
    select: { id: true },
  });
  await prisma.session.updateMany({
    where: { id: { in: sessions.map((s) => s.id) } },
    data: { revokedAt: new Date() },
  });
  await Promise.all(sessions.map((s) => markSessionRevoked(s.id, accessTokenTtlSeconds())));
  return sessions.length;
}

/** Active sessions for the account page (current one flagged). */
export async function listSessions(userId: string, currentSessionId: string) {
  const sessions = await prisma.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastActivityAt: 'desc' },
    select: {
      id: true,
      browser: true,
      os: true,
      ip: true,
      location: true,
      lastActivityAt: true,
      createdAt: true,
    },
  });
  return sessions.map((s) => ({ ...s, isCurrent: s.id === currentSessionId }));
}

/**
 * Heuristic suspicious-login check: the user has prior sessions but none
 * from this IP or user-agent family.
 */
export async function isSuspiciousLogin(userId: string, device: DeviceInfo): Promise<boolean> {
  if (!device.ip && !device.userAgent) return false;
  const priorCount = await prisma.session.count({ where: { userId } });
  if (priorCount === 0) return false; // first login ever — nothing to compare

  const { browser, os } = parseDevice(device.userAgent);
  const familiar = await prisma.session.count({
    where: {
      userId,
      OR: [{ ip: device.ip ?? undefined }, { AND: [{ browser }, { os }] }],
    },
  });
  return familiar === 0;
}
