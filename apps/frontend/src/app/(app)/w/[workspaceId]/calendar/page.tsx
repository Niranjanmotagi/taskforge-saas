'use client';

import { useRouter } from 'next/navigation';
import { Topbar } from '@/components/shell/topbar';
import { ProjectCalendar } from '@/components/calendar/project-calendar';
import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/api';
import type { TaskCard } from '@/hooks/use-tasks';

/** Workspace-wide calendar across every project. */
export default function WorkspaceCalendarPage({ params }: { params: { workspaceId: string } }) {
  const { workspaceId } = params;
  const router = useRouter();

  // Resolve a task's project so the detail sheet can open in context.
  const { data: tasks } = useQuery({
    queryKey: ['calendar-index', workspaceId],
    queryFn: () => get<TaskCard[]>(`/workspaces/${workspaceId}/tasks`, { limit: 100 }),
  });

  const openTask = (taskId: string) => {
    const task = tasks?.find((t) => t.id === taskId);
    if (task) router.push(`/w/${workspaceId}/projects/${task.projectId}?task=${taskId}`);
  };

  return (
    <>
      <Topbar title="Calendar" />
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <ProjectCalendar workspaceId={workspaceId} onOpenTask={openTask} />
      </div>
    </>
  );
}
