import type { Prisma } from '@prisma/client';
import { ProjectHealth, ProjectStatus, TaskStatusCategory } from '@taskforge/shared-types';
import { deriveProjectKey, percentage, seedRanks } from '@taskforge/shared-utils';
import { prisma } from '@/lib/prisma';
import { ApiError } from '@/utils/api-error';
import { assertCanCreateProject } from '@/services/plan-limits.service';
import { recordActivity } from '@/services/activity.service';
import { toOrderBy, toSkipTake, type Pagination } from '@/utils/pagination';

export const DEFAULT_COLUMNS: Array<{ name: string; category: TaskStatusCategory; color: string }> = [
  { name: 'Backlog', category: TaskStatusCategory.BACKLOG, color: '#94a3b8' },
  { name: 'Todo', category: TaskStatusCategory.TODO, color: '#64748b' },
  { name: 'In Progress', category: TaskStatusCategory.IN_PROGRESS, color: '#3b82f6' },
  { name: 'Review', category: TaskStatusCategory.REVIEW, color: '#8b5cf6' },
  { name: 'Testing', category: TaskStatusCategory.TESTING, color: '#f59e0b' },
  { name: 'Completed', category: TaskStatusCategory.DONE, color: '#10b981' },
];

const PROJECT_LIST_SELECT = {
  id: true,
  workspaceId: true,
  name: true,
  key: true,
  description: true,
  color: true,
  icon: true,
  status: true,
  health: true,
  startDate: true,
  dueDate: true,
  budgetCents: true,
  currency: true,
  clientName: true,
  isTemplate: true,
  leadId: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  lead: { select: { id: true, name: true, avatarUrl: true } },
  members: {
    select: { user: { select: { id: true, name: true, avatarUrl: true } } },
    take: 8,
  },
} satisfies Prisma.ProjectSelect;

async function uniqueKey(workspaceId: string, desired: string): Promise<string> {
  let key = desired;
  for (let n = 2; ; n += 1) {
    const clash = await prisma.project.findFirst({
      where: { workspaceId, key },
      select: { id: true },
    });
    if (!clash) return key;
    key = `${desired}${n}`.slice(0, 6);
  }
}

/** Attach computed progress + task counts to a project row. */
async function withProgress<T extends { id: string }>(project: T, userId?: string) {
  const [total, completed, favorite] = await Promise.all([
    prisma.task.count({ where: { projectId: project.id, deletedAt: null, parentId: null } }),
    prisma.task.count({
      where: { projectId: project.id, deletedAt: null, parentId: null, statusCategory: 'DONE' },
    }),
    userId
      ? prisma.projectFavorite.findFirst({
          where: { projectId: project.id, userId },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);
  return {
    ...project,
    progress: percentage(completed, total),
    taskCounts: { total, completed },
    isFavorite: Boolean(favorite),
  };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function createProject(
  workspaceId: string,
  actorId: string,
  input: {
    name: string;
    key?: string;
    description?: string;
    color?: string;
    icon?: string;
    status?: ProjectStatus;
    startDate?: Date;
    dueDate?: Date;
    budgetCents?: number;
    currency?: string;
    clientName?: string;
    clientEmail?: string;
    clientPhone?: string;
    leadId?: string;
    isTemplate?: boolean;
    templateId?: string;
    memberIds?: string[];
  }
) {
  await assertCanCreateProject(workspaceId);

  if (input.templateId) {
    return instantiateFromTemplate(workspaceId, actorId, input.templateId, input.name);
  }

  if (input.startDate && input.dueDate && input.startDate > input.dueDate) {
    throw ApiError.badRequest('Start date must be before due date');
  }

  const key = await uniqueKey(workspaceId, input.key ?? deriveProjectKey(input.name));
  const memberIds = [...new Set([actorId, ...(input.memberIds ?? [])])];

  // Validate member ids belong to this workspace (tenant integrity).
  const validMembers = await prisma.workspaceMember.findMany({
    where: { workspaceId, userId: { in: memberIds } },
    select: { userId: true },
  });
  const validIds = validMembers.map((m) => m.userId);

  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        workspaceId,
        name: input.name,
        key,
        description: input.description,
        color: input.color ?? '#6366f1',
        icon: input.icon,
        status: input.status ?? ProjectStatus.PLANNING,
        startDate: input.startDate,
        dueDate: input.dueDate,
        budgetCents: input.budgetCents,
        currency: input.currency ?? 'USD',
        clientName: input.clientName,
        clientEmail: input.clientEmail,
        clientPhone: input.clientPhone,
        leadId: input.leadId ?? actorId,
        isTemplate: input.isTemplate ?? false,
        columns: {
          create: DEFAULT_COLUMNS.map((c, i) => ({ ...c, position: i })),
        },
        members: { create: validIds.map((userId) => ({ userId })) },
      },
      select: PROJECT_LIST_SELECT,
    });

    await tx.channel.create({
      data: {
        workspaceId,
        type: 'PROJECT',
        name: created.name,
        projectId: created.id,
        createdById: actorId,
        members: { create: validIds.map((userId) => ({ userId, isAdmin: userId === actorId })) },
      },
    });

    return created;
  });

  recordActivity({
    workspaceId,
    actorId,
    action: 'CREATED',
    entityType: 'project',
    entityId: project.id,
    entityLabel: project.name,
    projectId: project.id,
  });

  return withProgress(project, actorId);
}

export async function listProjects(
  workspaceId: string,
  userId: string,
  query: Pagination & {
    status?: ProjectStatus;
    search?: string;
    favorites?: boolean;
    includeArchived?: boolean;
    templates?: boolean;
  }
) {
  const where: Prisma.ProjectWhereInput = {
    workspaceId,
    deletedAt: null,
    ...(query.templates !== undefined ? { isTemplate: query.templates } : { isTemplate: false }),
    ...(query.status
      ? { status: query.status }
      : query.includeArchived
        ? {}
        : { status: { not: ProjectStatus.ARCHIVED } }),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { key: { contains: query.search, mode: 'insensitive' } },
            { description: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(query.favorites ? { favorites: { some: { userId } } } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.project.findMany({
      where,
      select: PROJECT_LIST_SELECT,
      orderBy: toOrderBy(query, ['name', 'createdAt', 'updatedAt', 'dueDate'], 'updatedAt'),
      ...toSkipTake(query),
    }),
    prisma.project.count({ where }),
  ]);

  const projects = await Promise.all(rows.map((p) => withProgress(p, userId)));
  return { projects, total };
}

export async function getProject(workspaceId: string, projectId: string, userId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId, deletedAt: null },
    select: {
      ...PROJECT_LIST_SELECT,
      clientEmail: true,
      clientPhone: true,
      settings: true,
      columns: { orderBy: { position: 'asc' } },
      sprints: {
        where: { status: { in: ['PLANNED', 'ACTIVE'] } },
        orderBy: { startDate: 'asc' },
        take: 5,
      },
    },
  });
  if (!project) throw ApiError.notFound('Project');
  return withProgress(project, userId);
}

export async function updateProject(
  workspaceId: string,
  projectId: string,
  actorId: string,
  input: Record<string, unknown>
) {
  const existing = await prisma.project.findFirst({
    where: { id: projectId, workspaceId, deletedAt: null },
    select: { id: true, name: true, status: true },
  });
  if (!existing) throw ApiError.notFound('Project');

  const data: Prisma.ProjectUpdateInput = { ...input } as Prisma.ProjectUpdateInput;

  // Archive/unarchive bookkeeping rides on status changes.
  if (input.status === ProjectStatus.ARCHIVED && existing.status !== ProjectStatus.ARCHIVED) {
    data.archivedAt = new Date();
  } else if (input.status && input.status !== ProjectStatus.ARCHIVED) {
    data.archivedAt = null;
  }

  const project = await prisma.project.update({
    where: { id: projectId },
    data,
    select: PROJECT_LIST_SELECT,
  });

  recordActivity({
    workspaceId,
    actorId,
    action: input.status === ProjectStatus.ARCHIVED ? 'ARCHIVED' : 'UPDATED',
    entityType: 'project',
    entityId: projectId,
    entityLabel: project.name,
    projectId,
  });

  return withProgress(project, actorId);
}

export async function deleteProject(workspaceId: string, projectId: string, actorId: string): Promise<void> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!project) throw ApiError.notFound('Project');

  // Soft delete: tasks stay as rows but every query filters through the
  // project's deletedAt; hard cleanup belongs to a retention job.
  await prisma.project.update({
    where: { id: projectId },
    data: { deletedAt: new Date() },
  });

  recordActivity({
    workspaceId,
    actorId,
    action: 'DELETED',
    entityType: 'project',
    entityId: projectId,
    entityLabel: project.name,
  });
}

export async function toggleFavorite(workspaceId: string, projectId: string, userId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId, deletedAt: null },
    select: { id: true },
  });
  if (!project) throw ApiError.notFound('Project');

  const existing = await prisma.projectFavorite.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (existing) {
    await prisma.projectFavorite.delete({ where: { id: existing.id } });
    return { isFavorite: false };
  }
  await prisma.projectFavorite.create({ data: { projectId, userId } });
  return { isFavorite: true };
}

// ---------------------------------------------------------------------------
// Duplication & templates
// ---------------------------------------------------------------------------

export async function duplicateProject(
  workspaceId: string,
  projectId: string,
  actorId: string,
  options: { name?: string; includeTasks?: boolean }
) {
  await assertCanCreateProject(workspaceId);

  const source = await prisma.project.findFirst({
    where: { id: projectId, workspaceId, deletedAt: null },
    include: {
      columns: { orderBy: { position: 'asc' } },
      members: { select: { userId: true } },
      tasks: {
        where: { deletedAt: null, parentId: null },
        include: {
          labels: { select: { labelId: true } },
          checklist: { orderBy: { position: 'asc' } },
          subtasks: {
            where: { deletedAt: null },
            include: { labels: { select: { labelId: true } } },
          },
        },
      },
    },
  });
  if (!source) throw ApiError.notFound('Project');

  const name = options.name ?? `${source.name} (copy)`;
  const key = await uniqueKey(workspaceId, deriveProjectKey(name));
  const includeTasks = options.includeTasks ?? true;

  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        workspaceId,
        name,
        key,
        description: source.description,
        color: source.color,
        icon: source.icon,
        status: ProjectStatus.PLANNING,
        budgetCents: source.budgetCents,
        currency: source.currency,
        leadId: actorId,
        isTemplate: false,
        members: { create: source.members.map((m) => ({ userId: m.userId })) },
      },
    });

    // Recreate columns, remembering old->new mapping for task placement.
    const columnMap = new Map<string, string>();
    for (const col of source.columns) {
      const newCol = await tx.boardColumn.create({
        data: {
          projectId: created.id,
          name: col.name,
          category: col.category,
          color: col.color,
          position: col.position,
          wipLimit: col.wipLimit,
        },
      });
      columnMap.set(col.id, newCol.id);
    }

    if (includeTasks && source.tasks.length > 0) {
      const ranks = seedRanks(source.tasks.length);
      let counter = 0;
      for (const [i, task] of source.tasks.entries()) {
        counter += 1;
        const newParent = await tx.task.create({
          data: {
            workspaceId,
            projectId: created.id,
            columnId: task.columnId ? columnMap.get(task.columnId) : null,
            number: counter,
            title: task.title,
            description: task.description,
            priority: task.priority,
            statusCategory: 'TODO',
            position: ranks[i],
            estimatedMinutes: task.estimatedMinutes,
            storyPoints: task.storyPoints,
            creatorId: actorId,
            labels: { create: task.labels.map((l) => ({ labelId: l.labelId })) },
            checklist: {
              create: task.checklist.map((c) => ({
                title: c.title,
                position: c.position,
              })),
            },
          },
        });
        for (const sub of task.subtasks) {
          counter += 1;
          await tx.task.create({
            data: {
              workspaceId,
              projectId: created.id,
              parentId: newParent.id,
              columnId: sub.columnId ? columnMap.get(sub.columnId) : null,
              number: counter,
              title: sub.title,
              description: sub.description,
              priority: sub.priority,
              statusCategory: 'TODO',
              position: `${ranks[i]}a`,
              creatorId: actorId,
              labels: { create: sub.labels.map((l) => ({ labelId: l.labelId })) },
            },
          });
        }
      }
      await tx.project.update({ where: { id: created.id }, data: { taskCounter: counter } });
    }

    await tx.channel.create({
      data: {
        workspaceId,
        type: 'PROJECT',
        name: created.name,
        projectId: created.id,
        createdById: actorId,
        members: {
          create: source.members.map((m) => ({ userId: m.userId, isAdmin: m.userId === actorId })),
        },
      },
    });

    return created;
  });

  recordActivity({
    workspaceId,
    actorId,
    action: 'CREATED',
    entityType: 'project',
    entityId: project.id,
    entityLabel: project.name,
    projectId: project.id,
    metadata: { duplicatedFrom: projectId },
  });

  const full = await prisma.project.findUniqueOrThrow({
    where: { id: project.id },
    select: PROJECT_LIST_SELECT,
  });
  return withProgress(full, actorId);
}

async function instantiateFromTemplate(
  workspaceId: string,
  actorId: string,
  templateId: string,
  name: string
) {
  const template = await prisma.project.findFirst({
    where: { id: templateId, workspaceId, deletedAt: null },
    select: { id: true },
  });
  if (!template) throw ApiError.notFound('Template');
  return duplicateProject(workspaceId, templateId, actorId, { name, includeTasks: true });
}

// ---------------------------------------------------------------------------
// Health (derived; recomputed by cron and on demand)
// ---------------------------------------------------------------------------

/**
 * Health heuristic:
 *  - OFF_TRACK: project past due with open tasks, or >30% of open tasks overdue
 *  - AT_RISK:   10-30% of open tasks overdue, or completion lags linear pace by >25%
 *  - ON_TRACK:  otherwise (when at least one task exists)
 */
export async function computeProjectHealth(projectId: string): Promise<ProjectHealth> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { startDate: true, dueDate: true },
  });
  if (!project) return ProjectHealth.UNKNOWN;

  const now = new Date();
  const [total, done, overdue] = await Promise.all([
    prisma.task.count({ where: { projectId, deletedAt: null } }),
    prisma.task.count({ where: { projectId, deletedAt: null, statusCategory: 'DONE' } }),
    prisma.task.count({
      where: { projectId, deletedAt: null, statusCategory: { not: 'DONE' }, dueDate: { lt: now } },
    }),
  ]);

  if (total === 0) return ProjectHealth.UNKNOWN;

  const open = total - done;
  if (project.dueDate && project.dueDate < now && open > 0) return ProjectHealth.OFF_TRACK;

  const overdueRatio = open > 0 ? overdue / open : 0;
  if (overdueRatio > 0.3) return ProjectHealth.OFF_TRACK;
  if (overdueRatio > 0.1) return ProjectHealth.AT_RISK;

  if (project.startDate && project.dueDate && project.dueDate > project.startDate) {
    const span = project.dueDate.getTime() - project.startDate.getTime();
    const elapsed = Math.min(Math.max(now.getTime() - project.startDate.getTime(), 0), span);
    const expected = elapsed / span;
    const actual = done / total;
    if (expected - actual > 0.25) return ProjectHealth.AT_RISK;
  }

  return ProjectHealth.ON_TRACK;
}

export async function refreshProjectHealth(workspaceId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId, deletedAt: null },
    select: { id: true },
  });
  if (!project) throw ApiError.notFound('Project');
  const health = await computeProjectHealth(projectId);
  await prisma.project.update({ where: { id: projectId }, data: { health } });
  return { health };
}
