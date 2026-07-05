import type { Request, Response } from 'express';
import type { CookieOptions } from 'express';
import { env } from '@/config/env';
import { ok, created } from '@/utils/response';
import { ApiError } from '@/utils/api-error';
import { audit, auditCtxFromRequest } from '@/services/audit.service';
import * as authService from './auth.service';
import * as sessionService from './session.service';
import * as oauthService from './oauth.service';
import type { DeviceInfo } from './session.service';

export const REFRESH_COOKIE = 'tf_refresh';

const REFRESH_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: 'lax',
  // Only sent to auth endpoints — never rides along on normal API calls.
  path: '/api/v1/auth',
};

function setRefreshCookie(res: Response, token: string, rememberMe: boolean): void {
  const maxAge = rememberMe ? 30 * 24 * 3600 * 1000 : 7 * 24 * 3600 * 1000;
  res.cookie(REFRESH_COOKIE, token, { ...REFRESH_COOKIE_OPTIONS, maxAge });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, REFRESH_COOKIE_OPTIONS);
}

function device(req: Request): DeviceInfo {
  return auditCtxFromRequest(req);
}

function publicUser(user: { id: string; email: string; name: string; avatarUrl: string | null; systemRole: string; emailVerifiedAt: Date | null }) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    systemRole: user.systemRole,
    emailVerified: Boolean(user.emailVerifiedAt),
  };
}

// ---------------------------------------------------------------------------

export async function register(req: Request, res: Response): Promise<void> {
  const result = await authService.register(req.body, device(req));
  setRefreshCookie(res, result.refreshToken, false);
  created(res, {
    user: publicUser(result.user),
    accessToken: result.accessToken,
    expiresIn: result.expiresIn,
  });
}

export async function login(req: Request, res: Response): Promise<void> {
  const result = await authService.login(req.body, device(req));
  setRefreshCookie(res, result.refreshToken, req.body.rememberMe);
  ok(res, {
    user: publicUser(result.user),
    accessToken: result.accessToken,
    expiresIn: result.expiresIn,
  });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const raw = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (!raw) throw ApiError.unauthorized('No refresh token');
  const result = await sessionService.rotateSession(raw, device(req));
  setRefreshCookie(res, result.refreshToken, result.session.rememberMe);
  ok(res, { accessToken: result.accessToken, expiresIn: result.expiresIn });
}

export async function logout(req: Request, res: Response): Promise<void> {
  if (req.user) {
    await sessionService.revokeSession(req.user.sessionId, req.user.id);
    audit('LOGOUT', { userId: req.user.id, ...device(req) });
  }
  clearRefreshCookie(res);
  ok(res, null);
}

export async function logoutAll(req: Request, res: Response): Promise<void> {
  const count = await sessionService.revokeAllSessions(req.user!.id);
  audit('SESSION_REVOKED', { userId: req.user!.id, metadata: { scope: 'all', count }, ...device(req) });
  clearRefreshCookie(res);
  ok(res, { revoked: count });
}

export async function me(req: Request, res: Response): Promise<void> {
  const profile = await authService.getMe(req.user!.id);
  ok(res, profile);
}

export async function listSessions(req: Request, res: Response): Promise<void> {
  const sessions = await sessionService.listSessions(req.user!.id, req.user!.sessionId);
  ok(res, sessions);
}

export async function revokeSession(req: Request, res: Response): Promise<void> {
  await sessionService.revokeSession(req.params.sessionId, req.user!.id);
  audit('SESSION_REVOKED', { userId: req.user!.id, metadata: { sessionId: req.params.sessionId }, ...device(req) });
  ok(res, null);
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  await authService.forgotPassword(req.body.email, device(req));
  // Uniform response regardless of account existence.
  ok(res, { message: 'If that email exists, a reset link has been sent' });
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  await authService.resetPassword(req.body.token, req.body.password, device(req));
  clearRefreshCookie(res);
  ok(res, { message: 'Password updated — please sign in again' });
}

export async function verifyEmail(req: Request, res: Response): Promise<void> {
  await authService.verifyEmail(req.body.token, device(req));
  ok(res, { message: 'Email verified' });
}

export async function resendVerification(req: Request, res: Response): Promise<void> {
  await authService.resendVerification(req.user!.id);
  ok(res, { message: 'Verification email sent' });
}

// ---------------------------------------------------------------------------
// OAuth
// ---------------------------------------------------------------------------

export function oauthStart(provider: oauthService.OAuthProvider) {
  return async (_req: Request, res: Response): Promise<void> => {
    const url = await oauthService.buildAuthorizeUrl(provider);
    res.redirect(url);
  };
}

export function oauthCallback(provider: oauthService.OAuthProvider) {
  return async (req: Request, res: Response): Promise<void> => {
    const { code, state, error } = req.query as Record<string, string | undefined>;
    if (error || !code || !state) {
      res.redirect(`${env.APP_URL}/login?error=oauth_${error ?? 'missing_code'}`);
      return;
    }
    try {
      const result = await oauthService.handleCallback(provider, code, state, device(req));
      setRefreshCookie(res, result.refreshToken, true);
      const target = result.isNewUser ? '/onboarding' : '/auth/callback';
      res.redirect(`${env.APP_URL}${target}`);
    } catch {
      res.redirect(`${env.APP_URL}/login?error=oauth_failed`);
    }
  };
}
