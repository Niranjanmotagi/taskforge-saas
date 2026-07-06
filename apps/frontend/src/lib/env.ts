/** Client-safe environment access (NEXT_PUBLIC_* only), validated once. */

function required(name: string, value: string | undefined, fallback: string): string {
  const v = value ?? fallback;
  if (!v) throw new Error(`Missing environment variable: ${name}`);
  return v;
}

export const clientEnv = {
  apiUrl: required('NEXT_PUBLIC_API_URL', process.env.NEXT_PUBLIC_API_URL, 'http://localhost:5000/api/v1'),
  socketUrl: required('NEXT_PUBLIC_SOCKET_URL', process.env.NEXT_PUBLIC_SOCKET_URL, 'http://localhost:5000'),
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? 'TaskForge',
};
