'use client';

import { useRouter } from 'next/navigation';
import { GanttChartSquare } from 'lucide-react';
import { Topbar } from '@/components/shell/topbar';
import { GanttChart } from '@/components/gantt/gantt-chart';
import { useProjects } from '@/hooks/use-projects';
import { Skeleton } from '@/components/ui/misc';
import { EmptyState } from '@/components/ui/empty-state';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';

/** Workspace timeline: pick a project, see its Gantt. */
export default function TimelinePage({ params }: { params: { workspaceId: string } }) {
  const { workspaceId } = params;
  const router = useRouter();
  const { data: projects, isPending } = useProjects(workspaceId);
  const [projectId, setProjectId] = useState<string | null>(null);

  const selected = projectId ?? projects?.[0]?.id ?? null;

  return (
    <>
      <Topbar title="Timeline" />
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-b px-5 py-3">
          {isPending ? (
            <Skeleton className="h-9 w-64" />
          ) : projects?.length ? (
            <Select value={selected ?? undefined} onValueChange={setProjectId}>
              <SelectTrigger className="w-72">
                <SelectValue placeholder="Choose a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-auto scrollbar-thin">
          {selected ? (
            <GanttChart
              workspaceId={workspaceId}
              projectId={selected}
              onOpenTask={(taskId) => router.push(`/w/${workspaceId}/projects/${selected}?task=${taskId}`)}
            />
          ) : (
            <EmptyState icon={GanttChartSquare} title="No projects" description="Create a project to see its timeline." />
          )}
        </div>
      </div>
    </>
  );
}
