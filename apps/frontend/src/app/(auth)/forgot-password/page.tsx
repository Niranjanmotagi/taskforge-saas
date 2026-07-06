'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MailCheck } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { post, apiErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const schema = z.object({ email: z.string().email('Enter a valid email') });

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { email: '' } });

  const request = useMutation({
    mutationFn: (input: { email: string }) => post('/auth/forgot-password', input),
    onSuccess: () => setSent(true),
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
          <MailCheck className="h-6 w-6 text-success" />
        </div>
        <h1 className="text-xl font-semibold">Check your inbox</h1>
        <p className="text-sm text-muted-foreground">
          If an account exists for that email, we sent a link to reset your password. The link
          expires in 1 hour.
        </p>
        <Button variant="outline" asChild className="w-full">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
        <p className="text-sm text-muted-foreground">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>
      <form onSubmit={form.handleSubmit((v) => request.mutate(v))} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="you@company.com" {...form.register('email')} />
          {form.formState.errors.email && (
            <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
          )}
        </div>
        <Button type="submit" className="w-full" loading={request.isPending}>
          Send reset link
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{' '}
        <Link href="/login" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
