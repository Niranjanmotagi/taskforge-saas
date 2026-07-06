'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { post, apiErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const schema = z.object({
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/[a-z]/, 'Include a lowercase letter')
    .regex(/[A-Z]/, 'Include an uppercase letter')
    .regex(/[0-9]/, 'Include a digit'),
});

function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { password: '' } });

  const reset = useMutation({
    mutationFn: (input: { password: string }) => post('/auth/reset-password', { token, password: input.password }),
    onSuccess: () => {
      toast.success('Password updated — sign in with your new password.');
      router.replace('/login');
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  if (!token) {
    return (
      <p className="text-sm text-muted-foreground">
        This reset link is invalid. Request a new one from the sign-in page.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="text-sm text-muted-foreground">All existing sessions will be signed out.</p>
      </div>
      <form onSubmit={form.handleSubmit((v) => reset.mutate(v))} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <Input id="password" type="password" autoComplete="new-password" {...form.register('password')} />
          {form.formState.errors.password && (
            <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
          )}
        </div>
        <Button type="submit" className="w-full" loading={reset.isPending}>
          Update password
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
