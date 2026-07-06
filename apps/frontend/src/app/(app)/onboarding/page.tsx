'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Rocket, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/misc';
import { useCreateWorkspace } from '@/hooks/use-workspaces';
import { RequireAuth } from '@/components/auth/require-auth';

const schema = z.object({
  name: z.string().min(2, 'Workspace name is required').max(80),
  description: z.string().max(500).optional(),
});

function Onboarding() {
  const router = useRouter();
  const createWorkspace = useCreateWorkspace();
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '' },
  });

  const onSubmit = form.handleSubmit((values) => {
    createWorkspace.mutate(values, {
      onSuccess: (ws) => router.replace(`/w/${ws.id}/dashboard`),
    });
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(700px circle at 50% 20%, hsl(var(--primary) / 0.08), transparent 60%)',
        }}
      />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="relative w-full max-w-md rounded-xl border bg-card p-8 shadow-popover"
      >
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <Rocket className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Create your workspace</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          A workspace is your team&apos;s home — projects, boards, chat, and files live here.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="name">Workspace name</Label>
            <Input id="name" placeholder="Acme Inc" autoFocus {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">
              What are you building? <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea id="description" rows={3} placeholder="A short description for your team" {...form.register('description')} />
          </div>
          <Button type="submit" className="w-full" loading={createWorkspace.isPending}>
            <Sparkles /> Create workspace
          </Button>
        </form>
      </motion.div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <RequireAuth>
      <Onboarding />
    </RequireAuth>
  );
}
