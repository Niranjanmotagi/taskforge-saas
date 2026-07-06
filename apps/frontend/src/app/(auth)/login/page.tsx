'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/misc';
import { OAuthButtons } from '@/components/auth/oauth-buttons';
import { useLogin } from '@/hooks/use-auth';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(false),
});

type FormValues = z.infer<typeof schema>;

function LoginForm() {
  const params = useSearchParams();
  const oauthError = params.get('error');
  const login = useLogin();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '', rememberMe: false },
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Sign in to your workspace</p>
      </div>

      {oauthError ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Social sign-in failed. Please try again or use your email.
        </p>
      ) : null}

      <OAuthButtons />

      <form onSubmit={form.handleSubmit((v) => login.mutate(v))} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="you@company.com" autoComplete="email" {...form.register('email')} />
          {form.formState.errors.email && (
            <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-xs text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input id="password" type="password" autoComplete="current-password" {...form.register('password')} />
          {form.formState.errors.password && (
            <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={form.watch('rememberMe')}
            onCheckedChange={(c) => form.setValue('rememberMe', c === true)}
          />
          Keep me signed in for 30 days
        </label>
        <Button type="submit" className="w-full" loading={login.isPending}>
          Sign in
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        No account yet?{' '}
        <Link href="/register" className="text-primary hover:underline">
          Create one free
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
