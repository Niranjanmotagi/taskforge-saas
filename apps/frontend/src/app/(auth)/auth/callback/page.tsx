'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { refreshAccessToken } from '@/lib/api';
import { resolveLandingPath } from '@/hooks/use-auth';

/**
 * OAuth landing: the API set the refresh cookie during the redirect chain —
 * exchange it for an access token and route into the product.
 */
export default function OAuthCallbackPage() {
  const router = useRouter();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    void (async () => {
      const token = await refreshAccessToken();
      if (!token) {
        router.replace('/login?error=oauth_session');
        return;
      }
      router.replace(await resolveLandingPath());
    })();
  }, [router]);

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Signing you in…</p>
    </div>
  );
}
