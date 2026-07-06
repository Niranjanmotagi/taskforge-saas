'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import { patch, del, apiErrorMessage } from '@/lib/api';
import { useWorkspace, workspaceKeys } from '@/hooks/use-workspaces';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton, Textarea } from '@/components/ui/misc';

export default function GeneralSettingsPage({ params }: { params: { workspaceId: string } }) {
  const { workspaceId } = params;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: workspace, isPending } = useWorkspace(workspaceId);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (workspace) {
      setName(workspace.name);
      setDescription(workspace.description ?? '');
    }
  }, [workspace]);

  const save = useMutation({
    mutationFn: () => patch(`/workspaces/${workspaceId}`, { name, description: description || null }),
    onSuccess: () => {
      toast.success('Workspace updated');
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.detail(workspaceId) });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const destroy = useMutation({
    mutationFn: () => del(`/workspaces/${workspaceId}`),
    onSuccess: () => {
      toast.success('Workspace deleted');
      queryClient.clear();
      router.replace('/onboarding');
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  if (isPending) return <Skeleton className="h-64 max-w-xl" />;

  return (
    <div className="max-w-xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workspace</CardTitle>
          <CardDescription>Name and description visible to every member.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ws-name">Name</Label>
            <Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ws-desc">Description</Label>
            <Textarea id="ws-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!name.trim()}>
            Save changes
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <AlertTriangle className="h-4 w-4" /> Danger zone
          </CardTitle>
          <CardDescription>
            Deleting the workspace removes access for every member. Projects and tasks are retained
            for 30 days, then permanently purged.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            loading={destroy.isPending}
            onClick={() => {
              const confirmation = window.prompt(`Type "${workspace?.name}" to confirm deletion`);
              if (confirmation === workspace?.name) destroy.mutate();
              else if (confirmation !== null) toast.error('Name did not match — deletion cancelled');
            }}
          >
            Delete workspace
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
