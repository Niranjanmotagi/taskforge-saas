'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building2, Loader2 } from 'lucide-react';
import { get, post, apiErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { RequireAuth } from '@/components/auth/require-auth';

interface InvitationPreview {
  email: string;
  role: string;
  workspace: { name: string; logoUrl: string | null };
  invitedBy: { name: string };
}

function AcceptInvitation() {
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';
  const [declined, setDeclined] = useState(false);

  const preview = useQuery({
    queryKey: ['invitation-preview', token],
    queryFn: () => get<InvitationPreview>(`/invitations/${token}`),
    enabled: Boolean(token),
    retry: false,
  });

  const accept = useMutation({
    mutationFn: () => post<{ workspaceId: string }>('/invitations/accept', { token }),
    onSuccess: (data) => {
      toast.success('Welcome to the team!');
      router.replace(`/w/${data.workspaceId}/dashboard`);
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  if (!token || preview.isError) {
    return (
      <p className="text-sm text-muted-foreground">
        This invitation link is invalid or has expired. Ask your teammate to send a new one.
      </p>
    );
  }
  if (preview.isPending) {
    return <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />;
  }
  if (declined) {
    return <p className="text-sm text-muted-foreground">Invitation declined. You can close this page.</p>;
  }

  const inv = preview.data;
  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border bg-card shadow-card">
        <Building2 className="h-7 w-7 text-primary" />
      </div>
      <div>
        <h1 className="text-xl font-semibold">Join {inv.workspace.name}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          <strong>{inv.invitedBy.name}</strong> invited you ({inv.email}) to join as{' '}
          <strong className="lowercase">{inv.role}</strong>.
        </p>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={() => setDeclined(true)}>
          Decline
        </Button>
        <Button className="flex-1" loading={accept.isPending} onClick={() => accept.mutate()}>
          Accept invitation
        </Button>
      </div>
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <RequireAuth>
          <Suspense>
            <AcceptInvitation />
          </Suspense>
        </RequireAuth>
      </div>
    </div>
  );
}
