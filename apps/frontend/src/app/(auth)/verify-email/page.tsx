'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { BadgeCheck, CircleX, Loader2 } from 'lucide-react';
import { post } from '@/lib/api';
import { Button } from '@/components/ui/button';

function VerifyEmail() {
  const token = useSearchParams().get('token') ?? '';
  const [state, setState] = useState<'verifying' | 'success' | 'error'>('verifying');
  const fired = useRef(false);

  useEffect(() => {
    if (!token) {
      setState('error');
      return;
    }
    if (fired.current) return;
    fired.current = true;
    post('/auth/verify-email', { token })
      .then(() => setState('success'))
      .catch(() => setState('error'));
  }, [token]);

  return (
    <div className="space-y-4 text-center">
      {state === 'verifying' && (
        <>
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
          <h1 className="text-xl font-semibold">Verifying your email…</h1>
        </>
      )}
      {state === 'success' && (
        <>
          <BadgeCheck className="mx-auto h-10 w-10 text-success" />
          <h1 className="text-xl font-semibold">Email verified</h1>
          <p className="text-sm text-muted-foreground">You&apos;re all set. Welcome aboard!</p>
          <Button asChild className="w-full">
            <Link href="/login">Continue to sign in</Link>
          </Button>
        </>
      )}
      {state === 'error' && (
        <>
          <CircleX className="mx-auto h-10 w-10 text-destructive" />
          <h1 className="text-xl font-semibold">Link invalid or expired</h1>
          <p className="text-sm text-muted-foreground">
            Sign in and request a new verification email from settings.
          </p>
          <Button variant="outline" asChild className="w-full">
            <Link href="/login">Back to sign in</Link>
          </Button>
        </>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmail />
    </Suspense>
  );
}
