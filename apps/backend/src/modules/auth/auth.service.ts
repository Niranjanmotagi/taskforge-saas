import bcrypt from 'bcryptjs';
import type { AuthTokenType, User } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { env } from '@/config/env';
import { ApiError } from '@/utils/api-error';
import { randomToken, sha256 } from '@/utils/crypto';
import { sendMail } from '@/lib/mailer';
import { emailTemplates } from '@/lib/email-templates';
import { logger } from '@/lib/logger';
import { audit } from '@/services/audit.service';
import {
  createSession,
  isSuspiciousLogin,
  revokeAllSessions,
  type DeviceInfo,
  type IssuedTokens,
} from './session.service';
import type { LoginInput, RegisterInput } from './auth.validation';

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const RESET_TTL_MS = 60 * 60 * 1000; // 1h

// ---------------------------------------------------------------------------
// Registration & verification
// ---------------------------------------------------------------------------

export async function register(input: RegisterInput, device: DeviceInfo): Promise<IssuedTokens & { user: User }> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw ApiError.conflict('An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS);
  const user = await prisma.user.create({
    data: { name: input.name, email: input.email, passwordHash },
  });

  audit('REGISTER', { userId: user.id, ...device });
  await issueEmailToken(user, 'EMAIL_VERIFICATION');

  const tokens = await createSession(user, device, false);
  return { ...tokens, user };
}

async function issueEmailToken(user: Pick<User, 'id' | 'name' | 'email'>, type: AuthTokenType): Promise<void> {
  const raw = randomToken(32);
  const ttl = type === 'EMAIL_VERIFICATION' ? VERIFY_TTL_MS : RESET_TTL_MS;

  // Invalidate previous tokens of the same type, then store the new hash.
  await prisma.$transaction([
    prisma.authToken.deleteMany({ where: { userId: user.id, type } }),
    prisma.authToken.create({
      data: { userId: user.id, type, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + ttl) },
    }),
  ]);

  const template =
    type === 'EMAIL_VERIFICATION'
      ? emailTemplates.verifyEmail(user.name, `${env.APP_URL}/verify-email?token=${raw}`)
      : emailTemplates.resetPassword(user.name, `${env.APP_URL}/reset-password?token=${raw}`);

  // Email delivery must not block or fail the API call.
  sendMail({ to: user.email, ...template }).catch((err) =>
    logger.error(`failed to send ${type} email to ${user.email}: ${err.message}`)
  );
}

async function consumeEmailToken(rawToken: string, type: AuthTokenType): Promise<string> {
  const token = await prisma.authToken.findUnique({ where: { tokenHash: sha256(rawToken) } });
  if (!token || token.type !== type || token.usedAt || token.expiresAt < new Date()) {
    throw ApiError.badRequest('This link is invalid or has expired');
  }
  await prisma.authToken.update({ where: { id: token.id }, data: { usedAt: new Date() } });
  return token.userId;
}

export async function verifyEmail(rawToken: string, device: DeviceInfo): Promise<void> {
  const userId = await consumeEmailToken(rawToken, 'EMAIL_VERIFICATION');
  await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  audit('EMAIL_VERIFIED', { userId, ...device });
}

export async function resendVerification(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound('User');
  if (user.emailVerifiedAt) throw ApiError.badRequest('Email is already verified');
  await issueEmailToken(user, 'EMAIL_VERIFICATION');
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export async function login(input: LoginInput, device: DeviceInfo): Promise<IssuedTokens & { user: User }> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  // Uniform error for wrong email OR wrong password (no account enumeration).
  const invalid = ApiError.unauthorized('Invalid email or password');

  if (!user || !user.passwordHash || user.deletedAt || !user.isActive) {
    audit('LOGIN_FAILED', { metadata: { email: input.email }, ...device });
    throw invalid;
  }

  const matches = await bcrypt.compare(input.password, user.passwordHash);
  if (!matches) {
    audit('LOGIN_FAILED', { userId: user.id, ...device });
    throw invalid;
  }

  const suspicious = await isSuspiciousLogin(user.id, device);
  if (suspicious) {
    audit('LOGIN_SUSPICIOUS', { userId: user.id, ...device });
    const details = {
      ip: device.ip ?? 'Unknown',
      browser: device.userAgent ?? 'Unknown device',
      location: 'Unknown',
      time: new Date().toUTCString(),
    };
    sendMail({ to: user.email, ...emailTemplates.suspiciousLogin(user.name, details) }).catch((err) =>
      logger.error(`suspicious-login email failed: ${err.message}`)
    );
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  audit('LOGIN_SUCCESS', { userId: user.id, ...device });

  const tokens = await createSession(user, device, input.rememberMe);
  return { ...tokens, user };
}

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

export async function forgotPassword(email: string, device: DeviceInfo): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  // Always succeed from the caller's perspective (no enumeration).
  if (!user || user.deletedAt || !user.isActive) return;

  audit('PASSWORD_RESET_REQUESTED', { userId: user.id, ...device });
  await issueEmailToken(user, 'PASSWORD_RESET');
}

export async function resetPassword(rawToken: string, newPassword: string, device: DeviceInfo): Promise<void> {
  const userId = await consumeEmailToken(rawToken, 'PASSWORD_RESET');
  const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS);

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      // A reset link proves inbox ownership — count it as verification.
      emailVerifiedAt: new Date(),
    },
  });

  // Password changed => every existing device must re-authenticate.
  await revokeAllSessions(userId);
  audit('PASSWORD_RESET_COMPLETED', { userId, ...device });
}

// ---------------------------------------------------------------------------
// Current user
// ---------------------------------------------------------------------------

export async function getMe(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      systemRole: true,
      emailVerifiedAt: true,
      timezone: true,
      locale: true,
      createdAt: true,
      memberships: {
        where: { workspace: { deletedAt: null } },
        select: {
          role: true,
          workspace: {
            select: { id: true, name: true, slug: true, logoUrl: true },
          },
        },
        orderBy: { joinedAt: 'asc' },
      },
    },
  });
  if (!user) throw ApiError.notFound('User');

  const { memberships, ...rest } = user;
  return {
    ...rest,
    workspaces: memberships.map((m) => ({ ...m.workspace, role: m.role })),
  };
}
