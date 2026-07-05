import { SprintStatus } from '@taskforge/shared-types';
import { prisma } from '@/lib/prisma';
import { ApiError } from '@/utils/api-error';
import { recordActivity } from '@/services/activity.service';

async function assertProject(workspaceId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId, deletedAt: null },
    select: { id: true },
  });
  if (!project) throw ApiError.notFound('Project');
}

async function getSprintOrThrow(workspaceId: string, projectId: string, sprintId: string) {
  const sprint = await prisma.sprint.findFirst({
    where: { id: sprintId, projectId, project: { workspaceId, deletedAt: null } },
  });
  if (!sprint) throw ApiError.notFound('Sprint');
  return sprint;
}

const SPRINT_WITH_COUNTS = {
  _count: { select: { tasks: { where: { deletedAt: null } } } },
} as const;

function withCounts<T extends { _count: { tasks: number } }>(sprint: T, completed: number) {
  const { _count, ...rest } = sprint;
  return { ...rest, taskCount: _count.tasks, completedCount: completed };
}

export async function listSprints(workspaceId: string, projectId: string) {
  await assertProject(workspaceId, projectId);
  const sprints = await prisma.sprint.findMany({
    where: { projectId },
    orderBy: { startDate: 'desc' },
    include: SPRINT_WITH_COUNTS,
  });
  return Promise.all(
    sprints.map(async (s) =>
      withCounts(
        s,
        await prisma.task.count({
          where: { sprintId: s.id, deletedAt: null, statusCategory: 'DONE' },
        })
      )
    )
  );
}

export async function createSprint(
  workspaceId: string,
  projectId: string,
  actorId: string,
  input: { name: string; goal?: string; startDate: Date; endDate: Date }
) {
  await assertProject(workspaceId, projectId);
  const sprint = await prisma.sprint.create({
    data: { projectId, ...input },
    include: SPRINT_WITH_COUNTS,
  });
  recordActivity({
    workspaceId,
    actorId,
    action: 'CREATED',
    entityType: 'sprint',
    entityId: sprint.id,
    entityLabel: sprint.name,
    projectId,
  });
  return withCounts(sprint, 0);
}

export async function updateSprint(
  workspaceId: string,
  projectId: string,
  sprintId: string,
  actorId: string,
  input: { name?: string; goal?: string | null; startDate?: Date; endDate?: Date; status?: SprintStatus }
) {
  const sprint = await getSprintOrThrow(workspaceId, projectId, sprintId);

  const startDate = input.startDate ?? sprint.startDate;
  const endDate = input.endDate ?? sprint.endDate;
  if (startDate >= endDate) throw ApiError.badRequest('Sprint end date must be after start date');

  // Only one ACTIVE sprint per project.
  if (input.status === SprintStatus.ACTIVE && sprint.status !== SprintStatus.ACTIVE) {
    const active = await prisma.sprint.findFirst({
      where: { projectId, status: SprintStatus.ACTIVE, id: { not: sprintId } },
      select: { id: true, name: true },
    });
    if (active) {
      throw ApiError.conflict(`Sprint "${active.name}" is already active — complete it first`);
    }
  }

  const updated = await prisma.sprint.update({
    where: { id: sprintId },
    data: input,
    include: SPRINT_WITH_COUNTS,
  });
  recordActivity({
    workspaceId,
    actorId,
    action: 'UPDATED',
    entityType: 'sprint',
    entityId: sprintId,
    entityLabel: updated.name,
    projectId,
  });
  const completed = await prisma.task.count({
    where: { sprintId, deletedAt: null, statusCategory: 'DONE' },
  });
  return withCounts(updated, completed);
}

/** Complete a sprint; open tasks move to another sprint or back to backlog. */
export async function completeSprint(
  workspaceId: string,
  projectId: string,
  sprintId: string,
  actorId: string,
  moveOpenTasksToSprintId?: string | null
) {
  const sprint = await getSprintOrThrow(workspaceId, projectId, sprintId);
  if (sprint.status === SprintStatus.COMPLETED) {
    throw ApiError.badRequest('Sprint is already completed');
  }

  if (moveOpenTasksToSprintId) {
    await getSprintOrThrow(workspaceId, projectId, moveOpenTasksToSprintId);
  }

  const [openMoved] = await prisma.$transaction([
    prisma.task.updateMany({
      where: { sprintId, deletedAt: null, statusCategory: { not: 'DONE' } },
      data: { sprintId: moveOpenTasksToSprintId ?? null },
    }),
    prisma.sprint.update({
      where: { id: sprintId },
      data: { status: SprintStatus.COMPLETED },
    }),
  ]);

  recordActivity({
    workspaceId,
    actorId,
    action: 'COMPLETED',
    entityType: 'sprint',
    entityId: sprintId,
    entityLabel: sprint.name,
    projectId,
    metadata: { openTasksMoved: openMoved.count },
  });

  return { openTasksMoved: openMoved.count };
}

export async function deleteSprint(
  workspaceId: string,
  projectId: string,
  sprintId: string
): Promise<void> {
  await getSprintOrThrow(workspaceId, projectId, sprintId);
  // Detach tasks first (SetNull relation handles it, but be explicit).
  await prisma.$transaction([
    prisma.task.updateMany({ where: { sprintId }, data: { sprintId: null } }),
    prisma.sprint.delete({ where: { id: sprintId } }),
  ]);
}

/** Bulk-assign tasks to a sprint (sprint planning). */
export async function assignTasks(
  workspaceId: string,
  projectId: string,
  sprintId: string,
  taskIds: string[]
) {
  await getSprintOrThrow(workspaceId, projectId, sprintId);
  const result = await prisma.task.updateMany({
    where: { id: { in: taskIds }, projectId, workspaceId, deletedAt: null },
    data: { sprintId },
  });
  return { assigned: result.count };
}
