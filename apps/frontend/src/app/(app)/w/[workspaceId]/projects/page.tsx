'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import {
  Archive,
  Copy,
  FolderKanban,
  Heart,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { PROJECT_COLORS } from '@taskforge/shared-ui';
import { Topbar } from '@/components/shell/topbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress, Skeleton, Textarea } from '@/components/ui/misc';
import { UserAvatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useCreateProject,
  useDeleteProject,
  useDuplicateProject,
  useProjects,
  useToggleFavorite,
  useUpdateProject,
  type ProjectRow,
} from '@/hooks/use-projects';
import { cn } from '@/lib/utils';

const HEALTH_BADGE: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' }> = {
  ON_TRACK: { label: 'On track', variant: 'success' },
  AT_RISK: { label: 'At risk', variant: 'warning' },
  OFF_TRACK: { label: 'Off track', variant: 'destructive' },
  UNKNOWN: { label: 'No signal', variant: 'secondary' },
};

const createSchema = z.object({
  name: z.string().min(2, 'Project name is required').max(100),
  description: z.string().max(2000).optional(),
  clientName: z.string().max(120).optional(),
  color: z.string(),
  dueDate: z.string().optional(),
});

function CreateProjectDialog({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false);
  const create = useCreateProject(workspaceId);
  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: '', description: '', clientName: '', color: PROJECT_COLORS[0], dueDate: '' },
  });

  const onSubmit = form.handleSubmit((values) => {
    create.mutate(
      {
        name: values.name,
        description: values.description || undefined,
        clientName: values.clientName || undefined,
        color: values.color,
        dueDate: values.dueDate || undefined,
      },
      {
        onSuccess: () => {
          setOpen(false);
          form.reset();
        },
      }
    );
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> New project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="p-name">Name</Label>
            <Input id="p-name" placeholder="Website Redesign" autoFocus {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-desc">Description</Label>
            <Textarea id="p-desc" rows={2} {...form.register('description')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="p-client">Client</Label>
              <Input id="p-client" placeholder="Optional" {...form.register('clientName')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-due">Due date</Label>
              <Input id="p-due" type="date" {...form.register('dueDate')} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {PROJECT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => form.setValue('color', color)}
                  className={cn(
                    'h-6 w-6 rounded-full transition-transform hover:scale-110',
                    form.watch('color') === color && 'ring-2 ring-ring ring-offset-2 ring-offset-background'
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <Button type="submit" className="w-full" loading={create.isPending}>
            Create project
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProjectCard({ workspaceId, project }: { workspaceId: string; project: ProjectRow }) {
  const toggleFavorite = useToggleFavorite(workspaceId);
  const duplicate = useDuplicateProject(workspaceId);
  const deleteProject = useDeleteProject(workspaceId);
  const update = useUpdateProject(workspaceId, project.id);
  const health = HEALTH_BADGE[project.health] ?? HEALTH_BADGE.UNKNOWN;

  return (
    <Card className="group relative transition-shadow hover:shadow-popover">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/w/${workspaceId}/projects/${project.id}`} className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
              style={{ backgroundColor: project.color }}
            >
              {project.key.slice(0, 2)}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold group-hover:text-primary">{project.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {project.clientName ?? project.key}
                {project.dueDate ? ` · due ${format(new Date(project.dueDate), 'MMM d')}` : ''}
              </p>
            </div>
          </Link>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => toggleFavorite.mutate(project.id)}
              className={cn(project.isFavorite ? 'text-rose-500' : 'text-muted-foreground opacity-0 group-hover:opacity-100')}
            >
              <Heart className={cn('h-4 w-4', project.isFavorite && 'fill-current')} />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="text-muted-foreground opacity-0 group-hover:opacity-100">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => duplicate.mutate({ projectId: project.id })}>
                  <Copy /> Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => update.mutate({ status: project.status === 'ARCHIVED' ? 'ACTIVE' : 'ARCHIVED' })}
                >
                  <Archive /> {project.status === 'ARCHIVED' ? 'Unarchive' : 'Archive'}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => {
                    if (window.confirm(`Delete "${project.name}"? Tasks will be removed with it.`)) {
                      deleteProject.mutate(project.id);
                    }
                  }}
                >
                  <Trash2 /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {project.taskCounts.completed}/{project.taskCounts.total} tasks
            </span>
            <span>{project.progress}%</span>
          </div>
          <Progress value={project.progress} indicatorColor={project.color} />
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex -space-x-1.5">
            {project.members.slice(0, 4).map((m) => (
              <UserAvatar key={m.user.id} user={m.user} className="h-6 w-6 ring-2 ring-card" />
            ))}
            {project.members.length > 4 && (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium ring-2 ring-card">
                +{project.members.length - 4}
              </span>
            )}
          </div>
          <Badge variant={health.variant}>{health.label}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProjectsPage({ params }: { params: { workspaceId: string } }) {
  const { workspaceId } = params;
  const [search, setSearch] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const { data: projects, isPending } = useProjects(workspaceId, {
    search: search || undefined,
    favorites: favoritesOnly || undefined,
  });

  return (
    <>
      <Topbar title="Projects" />
      <div className="flex-1 space-y-5 overflow-y-auto p-5 scrollbar-thin">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search projects…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64 pl-8"
              />
            </div>
            <Button
              variant={favoritesOnly ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFavoritesOnly((v) => !v)}
            >
              <Heart className={cn('h-4 w-4', favoritesOnly && 'fill-current text-rose-500')} /> Favorites
            </Button>
          </div>
          <CreateProjectDialog workspaceId={workspaceId} />
        </div>

        {isPending ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44" />
            ))}
          </div>
        ) : projects?.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard key={project.id} workspaceId={workspaceId} project={project} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={FolderKanban}
            title={search ? 'No projects match your search' : 'No projects yet'}
            description={search ? 'Try a different name or key.' : 'Create your first project to start planning work.'}
            action={!search ? <CreateProjectDialog workspaceId={workspaceId} /> : undefined}
          />
        )}
      </div>
    </>
  );
}
