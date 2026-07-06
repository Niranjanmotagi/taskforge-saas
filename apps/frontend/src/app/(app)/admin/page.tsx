'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { format } from 'date-fns';
import { Building2, Flag, Receipt, ShieldCheck, Users } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatMoney } from '@taskforge/shared-utils';
import { get, patch, put, apiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { RequireAuth } from '@/components/auth/require-auth';
import { Topbar } from '@/components/shell/topbar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton, Switch } from '@/components/ui/misc';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Analytics {
  users: { total: number; activeLast30d: number; newLast30d: number };
  workspaces: number;
  tasks: number;
  subscriptions: Record<string, number>;
  planDistribution: Record<string, number>;
  totalRevenueCents: number;
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">
          {label}
          {hint ? ` · ${hint}` : ''}
        </p>
      </CardContent>
    </Card>
  );
}

function UsersTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const { data: users, isPending } = useQuery({
    queryKey: ['admin-users', search],
    queryFn: () =>
      get<Array<{ id: string; email: string; name: string; systemRole: string; isActive: boolean; lastLoginAt: string | null; createdAt: string; _count: { memberships: number } }>>(
        '/admin/users',
        { search: search || undefined, limit: 50 }
      ),
  });

  const updateUser = useMutation({
    mutationFn: (input: { userId: string; isActive: boolean }) =>
      patch(`/admin/users/${input.userId}`, { isActive: input.isActive }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <div className="space-y-4">
      <Input placeholder="Search users…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-72" />
      {isPending ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">User</th>
                <th className="px-3 py-2 font-medium">Role</th>
                <th className="px-3 py-2 font-medium">Workspaces</th>
                <th className="px-3 py-2 font-medium">Last login</th>
                <th className="px-3 py-2 font-medium">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users?.map((user) => (
                <tr key={user.id}>
                  <td className="px-3 py-2.5">
                    <p className="font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant={user.systemRole === 'SUPER_ADMIN' ? 'default' : 'secondary'}>
                      {user.systemRole}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-xs">{user._count.memberships}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {user.lastLoginAt ? format(new Date(user.lastLoginAt), 'MMM d, HH:mm') : 'never'}
                  </td>
                  <td className="px-3 py-2.5">
                    <Switch
                      checked={user.isActive}
                      onCheckedChange={(v) => updateUser.mutate({ userId: user.id, isActive: v })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function WorkspacesTab() {
  const queryClient = useQueryClient();
  const { data: workspaces, isPending } = useQuery({
    queryKey: ['admin-workspaces'],
    queryFn: () =>
      get<Array<{ id: string; name: string; slug: string; createdAt: string; deletedAt: string | null; owner: { email: string }; subscription: { plan: { tier: string } } | null; _count: { members: number; projects: number } }>>(
        '/admin/workspaces',
        { limit: 50 }
      ),
  });

  const suspend = useMutation({
    mutationFn: (input: { workspaceId: string; suspend: boolean }) =>
      patch(`/admin/workspaces/${input.workspaceId}`, { suspend: input.suspend }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin-workspaces'] }),
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  if (isPending) return <Skeleton className="h-64" />;
  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Workspace</th>
            <th className="px-3 py-2 font-medium">Owner</th>
            <th className="px-3 py-2 font-medium">Plan</th>
            <th className="px-3 py-2 font-medium">Members</th>
            <th className="px-3 py-2 font-medium">Projects</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {workspaces?.map((ws) => (
            <tr key={ws.id}>
              <td className="px-3 py-2.5 font-medium">{ws.name}</td>
              <td className="px-3 py-2.5 text-xs text-muted-foreground">{ws.owner.email}</td>
              <td className="px-3 py-2.5">
                <Badge variant="secondary">{ws.subscription?.plan.tier ?? 'FREE'}</Badge>
              </td>
              <td className="px-3 py-2.5 text-xs">{ws._count.members}</td>
              <td className="px-3 py-2.5 text-xs">{ws._count.projects}</td>
              <td className="px-3 py-2.5">
                <Badge variant={ws.deletedAt ? 'destructive' : 'success'}>
                  {ws.deletedAt ? 'SUSPENDED' : 'ACTIVE'}
                </Badge>
              </td>
              <td className="px-3 py-2.5 text-right">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => suspend.mutate({ workspaceId: ws.id, suspend: !ws.deletedAt })}
                >
                  {ws.deletedAt ? 'Restore' : 'Suspend'}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FlagsTab() {
  const queryClient = useQueryClient();
  const { data: flags, isPending } = useQuery({
    queryKey: ['admin-flags'],
    queryFn: () => get<Array<{ id: string; key: string; description: string | null; isEnabled: boolean }>>('/admin/feature-flags'),
  });

  const toggle = useMutation({
    mutationFn: (input: { key: string; isEnabled: boolean }) =>
      put(`/admin/feature-flags/${input.key}`, { isEnabled: input.isEnabled }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin-flags'] }),
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  if (isPending) return <Skeleton className="h-48" />;
  return (
    <div className="max-w-xl space-y-2">
      {flags?.map((flag) => (
        <div key={flag.id} className="flex items-center gap-3 rounded-lg border bg-card p-4">
          <Flag className="h-4 w-4 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-sm">{flag.key}</p>
            {flag.description && <p className="text-xs text-muted-foreground">{flag.description}</p>}
          </div>
          <Switch checked={flag.isEnabled} onCheckedChange={(v) => toggle.mutate({ key: flag.key, isEnabled: v })} />
        </div>
      ))}
    </div>
  );
}

function InvoicesTab() {
  const { data: invoices, isPending } = useQuery({
    queryKey: ['admin-invoices'],
    queryFn: () =>
      get<Array<{ id: string; number: string; status: string; amountDueCents: number; currency: string; issuedAt: string; workspace: { name: string } }>>(
        '/admin/invoices',
        { limit: 50 }
      ),
  });

  if (isPending) return <Skeleton className="h-48" />;
  if (!invoices?.length) return <p className="text-sm text-muted-foreground">No invoices yet.</p>;
  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Invoice</th>
            <th className="px-3 py-2 font-medium">Workspace</th>
            <th className="px-3 py-2 font-medium">Issued</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium text-right">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {invoices.map((invoice) => (
            <tr key={invoice.id}>
              <td className="px-3 py-2.5 font-mono text-xs">{invoice.number}</td>
              <td className="px-3 py-2.5">{invoice.workspace.name}</td>
              <td className="px-3 py-2.5 text-xs text-muted-foreground">
                {format(new Date(invoice.issuedAt), 'MMM d, yyyy')}
              </td>
              <td className="px-3 py-2.5">
                <Badge variant={invoice.status === 'PAID' ? 'success' : 'warning'}>{invoice.status}</Badge>
              </td>
              <td className="px-3 py-2.5 text-right font-medium">
                {formatMoney(invoice.amountDueCents, invoice.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminPanel() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);

  useEffect(() => {
    if (hydrated && user && user.systemRole !== 'SUPER_ADMIN') {
      router.replace('/onboarding');
    }
  }, [hydrated, user, router]);

  const { data: analytics } = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: () => get<Analytics>('/admin/analytics'),
    enabled: user?.systemRole === 'SUPER_ADMIN',
  });

  if (user?.systemRole !== 'SUPER_ADMIN') return null;

  return (
    <div className="flex h-screen flex-col">
      <Topbar title="Platform Administration" />
      <div className="flex-1 space-y-5 overflow-y-auto p-5 scrollbar-thin">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Super Admin</h1>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total users" value={analytics?.users.total ?? '—'} hint={`${analytics?.users.newLast30d ?? 0} new /30d`} />
          <StatCard label="Active users (30d)" value={analytics?.users.activeLast30d ?? '—'} />
          <StatCard label="Workspaces" value={analytics?.workspaces ?? '—'} hint={`${analytics?.tasks ?? 0} tasks`} />
          <StatCard label="Revenue (all time)" value={analytics ? formatMoney(analytics.totalRevenueCents) : '—'} />
        </div>

        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users"><Users /> Users</TabsTrigger>
            <TabsTrigger value="workspaces"><Building2 /> Workspaces</TabsTrigger>
            <TabsTrigger value="invoices"><Receipt /> Payments</TabsTrigger>
            <TabsTrigger value="flags"><Flag /> Feature flags</TabsTrigger>
          </TabsList>
          <TabsContent value="users"><UsersTab /></TabsContent>
          <TabsContent value="workspaces"><WorkspacesTab /></TabsContent>
          <TabsContent value="invoices"><InvoicesTab /></TabsContent>
          <TabsContent value="flags"><FlagsTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <RequireAuth>
      <AdminPanel />
    </RequireAuth>
  );
}
