'use client';

import { useEffect } from 'react';
import { SOCKET_EVENTS } from '@taskforge/shared-types';
import { RequireAuth } from '@/components/auth/require-auth';
import { Sidebar } from '@/components/shell/sidebar';
import { CommandPalette } from '@/components/shell/command-palette';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth-store';

function WorkspaceShell({ workspaceId, children }: { workspaceId: string; children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);

  // Join the workspace socket room for presence + live updates.
  useEffect(() => {
    if (!accessToken) return;
    const socket = getSocket();
    if (!socket.connected) socket.connect();
    const join = () => socket.emit(SOCKET_EVENTS.JOIN_WORKSPACE, workspaceId);
    if (socket.connected) join();
    socket.on('connect', join);
    return () => {
      socket.off('connect', join);
      socket.emit(SOCKET_EVENTS.LEAVE_WORKSPACE, workspaceId);
    };
  }, [workspaceId, accessToken]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar workspaceId={workspaceId} />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
      <CommandPalette workspaceId={workspaceId} />
    </div>
  );
}

export default function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { workspaceId: string };
}) {
  return (
    <RequireAuth>
      <WorkspaceShell workspaceId={params.workspaceId}>{children}</WorkspaceShell>
    </RequireAuth>
  );
}
