import { TaskStatusCategory } from '@taskforge/shared-types';
import { prisma } from '@/lib/prisma';
import { ApiError } from '@/utils/api-error';

async function assertProject(workspaceId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId, deletedAt: null },
    select: { id: true },
  });
  if (!project) throw ApiError.notFound('Project');
}

export async function createColumn(
  workspaceId: string,
  projectId: string,
  input: { name: string; category: TaskStatusCategory; color?: string; wipLimit?: number | null }
) {
  await assertProject(workspaceId, projectId);
  const last = await prisma.boardColumn.findFirst({
    where: { projectId },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  return prisma.boardColumn.create({
    data: {
      projectId,
      name: input.name,
      category: input.category,
      color: input.color ?? '#64748b',
      wipLimit: input.wipLimit ?? null,
      position: (last?.position ?? -1) + 1,
    },
  });
}

export async function updateColumn(
  workspaceId: string,
  projectId: string,
  columnId: string,
  input: { name?: string; category?: TaskStatusCategory; color?: string; wipLimit?: number | null; position?: number }
) {
  await assertProject(workspaceId, projectId);
  const column = await prisma.boardColumn.findFirst({ where: { id: columnId, projectId } });
  if (!column) throw ApiError.notFound('Column');

  const { position, category, ...rest } = input;

  const updated = await prisma.$transaction(async (tx) => {
    // Reorder: shift siblings between old and new position.
    if (position !== undefined && position !== column.position) {
      if (position > column.position) {
        await tx.boardColumn.updateMany({
          where: { projectId, position: { gt: column.position, lte: position } },
          data: { position: { decrement: 1 } },
        });
      } else {
        await tx.boardColumn.updateMany({
          where: { projectId, position: { gte: position, lt: column.position } },
          data: { position: { increment: 1 } },
        });
      }
    }

    const row = await tx.boardColumn.update({
      where: { id: columnId },
      data: {
        ...rest,
        ...(category ? { category } : {}),
        ...(position !== undefined ? { position } : {}),
      },
    });

    // Category change re-tags every task in the column so reports stay true.
    if (category && category !== column.category) {
      await tx.task.updateMany({
        where: { columnId, deletedAt: null },
        data: {
          statusCategory: category,
          ...(category === TaskStatusCategory.DONE ? { completedAt: new Date() } : { completedAt: null }),
        },
      });
    }

    return row;
  });

  return updated;
}

/** Delete a column; its tasks move to a target column (or the first remaining). */
export async function deleteColumn(
  workspaceId: string,
  projectId: string,
  columnId: string,
  moveTasksToColumnId?: string
): Promise<void> {
  await assertProject(workspaceId, projectId);
  const column = await prisma.boardColumn.findFirst({ where: { id: columnId, projectId } });
  if (!column) throw ApiError.notFound('Column');

  const columnCount = await prisma.boardColumn.count({ where: { projectId } });
  if (columnCount <= 1) throw ApiError.badRequest('A board needs at least one column');

  let target = moveTasksToColumnId
    ? await prisma.boardColumn.findFirst({ where: { id: moveTasksToColumnId, projectId } })
    : await prisma.boardColumn.findFirst({
        where: { projectId, id: { not: columnId } },
        orderBy: { position: 'asc' },
      });
  if (!target || target.id === columnId) throw ApiError.badRequest('Invalid target column');

  await prisma.$transaction([
    prisma.task.updateMany({
      where: { columnId, deletedAt: null },
      data: { columnId: target.id, statusCategory: target.category },
    }),
    prisma.boardColumn.delete({ where: { id: columnId } }),
    prisma.boardColumn.updateMany({
      where: { projectId, position: { gt: column.position } },
      data: { position: { decrement: 1 } },
    }),
  ]);
}
