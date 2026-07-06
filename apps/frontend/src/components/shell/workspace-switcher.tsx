'use client';

import { useRouter } from 'next/navigation';
import { Check, ChevronsUpDown, Plus, Sparkles } from 'lucide-react';
import { useWorkspaces } from '@/hooks/use-workspaces';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export function WorkspaceSwitcher({ workspaceId, collapsed }: { workspaceId: string; collapsed: boolean }) {
  const router = useRouter();
  const { data: workspaces } = useWorkspaces();
  const current = workspaces?.find((w) => w.id === workspaceId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="w-full outline-none">
        <div
          className={cn(
            'flex items-center gap-2 rounded-lg border bg-card px-2.5 py-2 text-left shadow-card transition-colors hover:bg-accent',
            collapsed && 'justify-center px-0'
          )}
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </div>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold leading-tight">{current?.name ?? '…'}</p>
                <p className="truncate text-[11px] text-muted-foreground">{current?.planTier ?? ''} plan</p>
              </div>
              <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </>
          )}
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        {workspaces?.map((ws) => (
          <DropdownMenuItem
            key={ws.id}
            onClick={() => router.push(`/w/${ws.id}/dashboard`)}
            className="justify-between"
          >
            <span className="truncate">{ws.name}</span>
            {ws.id === workspaceId && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push('/onboarding')}>
          <Plus /> New workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
