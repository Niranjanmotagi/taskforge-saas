/**
 * Client-safe environment access (NEXT_PUBLIC_* only).
 *
 * NEXT_PUBLIC_* values are inlined at build time, so these are read once.
 * Empty string is a valid value for the socket/API URL — it means
 * "same origin as the page" (used in production behind a single domain),
 * so we must NOT treat empty as missing.
 */

/** Use the provided value when it is a non-empty string, otherwise the fallback. */
function withFallback(value: string | undefined, fallback: string): string {
  return value && value.trim().length > 0 ? value : fallback;
}

export const clientEnv = {
  apiUrl: withFallback(process.env.NEXT_PUBLIC_API_URL, 'http://localhost:5000/api/v1'),
  /** Empty = connect to the page's own origin (resolved in lib/socket). */
  socketUrl: process.env.NEXT_PUBLIC_SOCKET_URL ?? '',
  appName: withFallback(process.env.NEXT_PUBLIC_APP_NAME, 'TaskForge'),
};
