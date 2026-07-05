import crypto from 'crypto';

/** URL-safe random token (used for refresh tokens, invites, verification links). */
export function randomToken(bytes = 48): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

/** Deterministic SHA-256 hash for token storage (never store raw tokens). */
export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/** Constant-time string comparison to avoid timing side-channels. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
