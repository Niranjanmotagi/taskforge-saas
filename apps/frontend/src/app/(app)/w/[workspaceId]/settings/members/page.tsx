'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Mail, Trash2, UserPlus, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { WorkspaceRole, canManageRole } from '@taskforge/shared-types';
import { get, post, patch, del, apiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/misc';
import { UserAvatar } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface MemberRow {
  id: string;
  role: WorkspaceRole;
  jobTitle: string | null;
  joinedAt: string;
  user: { id: string; name: string; email: string; avatarUrl: string | null };
}

interface InvitationRow {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  invitedBy: { name: string };
}

const ASSIGNABLE_ROLES: WorkspaceRole[] = [
  WorkspaceRole.ADMIN,
  WorkspaceRole.MANAGER,
  WorkspaceRole.DEVELOPER,
  WorkspaceRole.QA,
  WorkspaceRole.CLIENT,
  WorkspaceRole.GUEST,
];

export default function MembersSettingsPage({ params }: { params: { workspaceId: string } }) {
  const { workspaceId } = params;
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>(WorkspaceRole.DEVELOPER);

  const { data: members, isPending } = useQuery({
    queryKey: ['members', workspaceId],
    queryFn: () => get<MemberRow[]>(`/workspaces/${workspaceId}/members`),
  });

  const { data: invitations } = useQuery({
    queryKey: ['invitations', workspaceId],
    queryFn: () => get<InvitationRow[]>(`/workspaces/${workspaceId}/invitations`),
  });

  const myRole = members?.find((m) => m.user.id === me?.id)?.role;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['members', workspaceId] });
    void queryClient.invalidateQueries({ queryKey: ['invitations', workspaceId] });
  };

  const invite = useMutation({
    mutationFn: () => post(`/workspaces/${workspaceId}/invitations`, { email: inviteEmail, role: inviteRole }),
    onSuccess: () => {
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
      invalidate();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const changeRole = useMutation({
    mutationFn: (input: { memberId: string; role: WorkspaceRole }) =>
      patch(`/workspaces/${workspaceId}/members/${input.memberId}`, { role: input.role }),
    onSuccess: () => {
      toast.success('Role updated');
      invalidate();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const removeMember = useMutation({
    mutationFn: (memberId: string) => del(`/workspaces/${workspaceId}/members/${memberId}`),
    onSuccess: () => {
      toast.success('Member removed');
      invalidate();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const revokeInvite = useMutation({
    mutationFn: (invitationId: string) => del(`/workspaces/${workspaceId}/invitations/${invitationId}`),
    onSuccess: invalidate,
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <div className="max-w-3xl space-y-6">
      {/* Invite */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-4 w-4 text-primary" /> Invite people
          </CardTitle>
          <CardDescription>They&apos;ll receive an email invitation that expires in 7 days.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (inviteEmail.trim()) invite.mutate();
            }}
            className="flex flex-wrap gap-2"
          >
            <Input
              type="email"
              placeholder="teammate@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="min-w-56 flex-1"
              required
            />
            <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as WorkspaceRole)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSIGNABLE_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role.charAt(0) + role.slice(1).toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" loading={invite.isPending}>
              Send invite
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Pending invitations */}
      {invitations?.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending invitations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{inv.email}</span>
                <Badge variant="secondary">{inv.role}</Badge>
                <span className="text-xs text-muted-foreground">
                  expires {format(new Date(inv.expiresAt), 'MMM d')}
                </span>
                <Button variant="ghost" size="icon-sm" onClick={() => revokeInvite.mutate(inv.id)} title="Revoke">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Members {members ? `(${members.length})` : ''}</CardTitle>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <Skeleton className="h-48" />
          ) : (
            <div className="divide-y">
              {members?.map((member) => {
                const isSelf = member.user.id === me?.id;
                const canManage =
                  myRole && !isSelf && member.role !== WorkspaceRole.OWNER && canManageRole(myRole, member.role);
                return (
                  <div key={member.id} className="flex items-center gap-3 py-3">
                    <UserAvatar user={member.user} className="h-9 w-9" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {member.user.name}
                        {isSelf && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{member.user.email}</p>
                    </div>
                    {member.role === WorkspaceRole.OWNER ? (
                      <Badge>Owner</Badge>
                    ) : canManage ? (
                      <Select
                        value={member.role}
                        onValueChange={(v) => changeRole.mutate({ memberId: member.id, role: v as WorkspaceRole })}
                      >
                        <SelectTrigger className="h-8 w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ASSIGNABLE_ROLES.filter((r) => myRole && canManageRole(myRole, r)).map((role) => (
                            <SelectItem key={role} value={role}>
                              {role.charAt(0) + role.slice(1).toLowerCase()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="secondary">{member.role.charAt(0) + member.role.slice(1).toLowerCase()}</Badge>
                    )}
                    {(canManage || isSelf) && member.role !== WorkspaceRole.OWNER && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title={isSelf ? 'Leave workspace' : 'Remove member'}
                        onClick={() => {
                          const message = isSelf
                            ? 'Leave this workspace?'
                            : `Remove ${member.user.name} from the workspace?`;
                          if (window.confirm(message)) removeMember.mutate(member.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
