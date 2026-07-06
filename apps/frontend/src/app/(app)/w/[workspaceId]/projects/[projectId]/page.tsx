'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CalendarDays, GanttChartSquare, Kanban, List, Zap } from 'lucide-react';
import { Topbar } from '@/components/shell/topbar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KanbanBoard } from '@/components/board/kanban-board';
import { TaskListView } from '@/components/tasks/task-list-view';
import { ProjectCalendar } from '@/components/calendar/project-calendar';
import { GanttChart } from '@/components/gantt/gantt-chart';
import { SprintsPanel } from '@/components/sprints/sprints-panel';
import { TaskDetailSheet } from '@/components/tasks/task-detail-sheet';
import { useProject } from '@/hooks/use-projects';

export default function ProjectPage({ params }: { params: { workspaceId: string; projectId: string } }) {
  const { workspaceId, projectId } = params;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const taskId = searchParams.get('task');
  const view = searchParams.get('view') ?? 'board';

  const { data: project } = useProject(workspaceId, projectId);

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(searchParams.toString());
      if (value === null) next.delete(key);
      else next.set(key, value);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  return (
    <>
      <Topbar title={project ? `${project.name}` : 'Project'} />
      <Tabs value={view} onValueChange={(v) => setParam('view', v)} className="flex min-h-0 flex-1 flex-col">
        <div className="border-b px-5 pt-2">
          <TabsList className="bg-transparent p-0">
            <TabsTrigger value="board"><Kanban /> Board</TabsTrigger>
            <TabsTrigger value="list"><List /> List</TabsTrigger>
            <TabsTrigger value="calendar"><CalendarDays /> Calendar</TabsTrigger>
            <TabsTrigger value="gantt"><GanttChartSquare /> Gantt</TabsTrigger>
            <TabsTrigger value="sprints"><Zap /> Sprints</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="board" className="mt-0 min-h-0 flex-1">
          <KanbanBoard workspaceId={workspaceId} projectId={projectId} onOpenTask={(id) => setParam('task', id)} />
        </TabsContent>
        <TabsContent value="list" className="mt-0 min-h-0 flex-1 overflow-y-auto scrollbar-thin">
          <TaskListView workspaceId={workspaceId} projectId={projectId} onOpenTask={(id) => setParam('task', id)} />
        </TabsContent>
        <TabsContent value="calendar" className="mt-0 min-h-0 flex-1 overflow-y-auto scrollbar-thin">
          <ProjectCalendar workspaceId={workspaceId} projectId={projectId} onOpenTask={(id) => setParam('task', id)} />
        </TabsContent>
        <TabsContent value="gantt" className="mt-0 min-h-0 flex-1 overflow-auto scrollbar-thin">
          <GanttChart workspaceId={workspaceId} projectId={projectId} onOpenTask={(id) => setParam('task', id)} />
        </TabsContent>
        <TabsContent value="sprints" className="mt-0 min-h-0 flex-1 overflow-y-auto scrollbar-thin">
          <SprintsPanel workspaceId={workspaceId} projectId={projectId} />
        </TabsContent>
      </Tabs>

      <TaskDetailSheet
        workspaceId={workspaceId}
        projectId={projectId}
        taskId={taskId}
        onClose={() => setParam('task', null)}
      />
    </>
  );
}
