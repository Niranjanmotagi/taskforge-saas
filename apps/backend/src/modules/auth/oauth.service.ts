import type { User } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { env } from '@/config/env';
import { redis } from '@/lib/redis';
import { ApiError } from '@/utils/api-error';
import { randomToken } from '@/utils/crypto';
import { audit } from '@/services/audit.service';
import { createSession, type DeviceInfo, type IssuedTokens } from './session.service';

export type OAuthProvider = 'google' | 'github';

interface OAuthProfile {
  providerUserId: string;
  email: string | null;
  name: string;
  avatarUrl: string | null;
}

const STATE_TTL_SECONDS = 600;

interface ProviderConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  authorizeUrl: string;
  scope: string;
}

function providerConfig(provider: OAuthProvider): ProviderConfig {
  const config: ProviderConfig =
    provider === 'google'
      ? {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          callbackUrl: env.GOOGLE_CALLBACK_URL,
          authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
          scope: 'openid email profile',
        }
      : {
          clientId: env.GITHUB_CLIENT_ID,
          clientSecret: env.GITHUB_CLIENT_SECRET,
          callbackUrl: env.GITHUB_CALLBACK_URL,
          authorizeUrl: 'https://github.com/login/oauth/authorize',
          scope: 'read:user user:email',
        };
  if (!config.clientId || !config.clientSecret) {
    throw new ApiError(503, `${provider} OAuth is not configured on this server`);
  }
  return config;
}

/** Step 1: build the consent-screen redirect with a single-use state nonce. */
export async function buildAuthorizeUrl(provider: OAuthProvider): Promise<string> {
  const cfg = providerConfig(provider);
  const state = randomToken(24);
  await redis.set(`oauth:state:${state}`, provider, 'EX', STATE_TTL_SECONDS);

  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.callbackUrl,
    response_type: 'code',
    scope: cfg.scope,
    state,
  });
  if (provider === 'google') {
    params.set('access_type', 'offline');
    params.set('prompt', 'select_account');
  }
  return `${cfg.authorizeUrl}?${params.toString()}`;
}

async function validateState(state: string, provider: OAuthProvider): Promise<void> {
  const stored = await redis.getdel(`oauth:state:${state}`);
  if (stored !== provider) {
    throw ApiError.badRequest('Invalid or expired OAuth state');
  }
}

async function exchangeCode(provider: OAuthProvider, code: string): Promise<string> {
  const cfg = providerConfig(provider);
  const tokenUrl =
    provider === 'google'
      ? 'https://oauth2.googleapis.com/token'
      : 'https://github.com/login/oauth/access_token';

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      code,
      redirect_uri: cfg.callbackUrl,
      grant_type: 'authorization_code',
    }),
  });

  const data = (await response.json()) as { access_token?: string; error?: string };
  if (!response.ok || !data.access_token) {
    throw ApiError.badRequest(`OAuth code exchange failed${data.error ? `: ${data.error}` : ''}`);
  }
  return data.access_token;
}

async function fetchProfile(provider: OAuthProvider, accessToken: string): Promise<OAuthProfile> {
  if (provider === 'google') {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw ApiError.badRequest('Failed to fetch Google profile');
    const p = (await res.json()) as { sub: string; email?: string; name?: string; picture?: string };
    return {
      providerUserId: p.sub,
      email: p.email?.toLowerCase() ?? null,
      name: p.name ?? 'Google User',
      avatarUrl: p.picture ?? null,
    };
  }

  const [userRes, emailRes] = await Promise.all([
    fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json' },
    }),
    fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json' },
    }),
  ]);
  if (!userRes.ok) throw ApiError.badRequest('Failed to fetch GitHub profile');

  const p = (await userRes.json()) as { id: number; login: string; name?: string; avatar_url?: string };
  let email: string | null = null;
  if (emailRes.ok) {
    const emails = (await emailRes.json()) as Array<{ email: string; primary: boolean; verified: boolean }>;
    email = (emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.verified))?.email ?? null;
  }
  return {
    providerUserId: String(p.id),
    email: email?.toLowerCase() ?? null,
    name: p.name ?? p.login,
    avatarUrl: p.avatar_url ?? null,
  };
}

/**
 * Step 2: handle the provider callback — validate state, exchange the code,
 * find-or-create the user, link the OAuth account, and open a session.
 */
export async function handleCallback(
  provider: OAuthProvider,
  code: string,
  state: string,
  device: DeviceInfo
): Promise<IssuedTokens & { user: User; isNewUser: boolean }> {
  await validateState(state, provider);
  const providerToken = await exchangeCode(provider, code);
  const profile = await fetchProfile(provider, providerToken);

  if (!profile.email) {
    throw ApiError.badRequest(
      `Your ${provider} account has no verified email — add one or register with email/password`
    );
  }

  const linked = await prisma.oAuthAccount.findUnique({
    where: { provider_providerUserId: { provider, providerUserId: profile.providerUserId } },
    include: { user: true },
  });

  let user: User;
  let isNewUser = false;

  if (linked) {
    user = linked.user;
    if (user.deletedAt || !user.isActive) {
      throw ApiError.unauthorized('Account is disabled');
    }
  } else {
    const byEmail = await prisma.user.findUnique({ where: { email: profile.email } });
    if (byEmail) {
      if (byEmail.deletedAt || !byEmail.isActive) throw ApiError.unauthorized('Account is disabled');
      // Same verified email — link the provider to the existing account.
      user = byEmail;
    } else {
      user = await prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
          emailVerifiedAt: new Date(), // provider verified the email
        },
      });
      isNewUser = true;
      audit('REGISTER', { userId: user.id, metadata: { provider }, ...device });
    }
    await prisma.oAuthAccount.create({
      data: {
        userId: user.id,
        provider,
        providerUserId: profile.providerUserId,
        email: profile.email,
      },
    });
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  audit('LOGIN_SUCCESS', { userId: user.id, metadata: { provider }, ...device });

  const tokens = await createSession(user, device, true);
  return { ...tokens, user, isNewUser };
}
