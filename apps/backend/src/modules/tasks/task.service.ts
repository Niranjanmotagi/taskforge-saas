import type { Prisma } from '@prisma/client';
import { TaskPriority, TaskStatusCategory } from '@taskforge/shared-types';
import { extractMentions, rankBetween } from '@taskforge/shared-utils';
import { prisma } from '@/lib/prisma';
import { ApiError } from '@/utils/api-error';
import { recordActivity } from '@/services/activity.service';
import { notify } from '@/services/notification.service';
import { emitToProject, SOCKET_EVENTS } from '@/services/realtime.service';
import { toSkipTake, type Pagination } from '@/utils/pagination';
import { env } from '@/config/env';

const MAX_SUBTASK_DEPTH = 3;

export const TASK_CARD_SELECT = {
  id: true,
  workspaceId: true,
  projectId: true,
  columnId: true,
  sprintId: true,
  parentId: true,
  number: true,
  title: true,
  priority: true,
  statusCategory: true,
  position: true,
  startDate: true,
  dueDate: true,
  estimatedMinutes: true,
  storyPoints: true,
  completedAt: true,
  creatorId: true,
  createdAt: true,
  updatedAt: true,
  project: { select: { key: true, name: true, color: true } },
  assignees: { select: { user: { select: { id: true, name: true, avatarUrl: true } } } },
  labels: { select: { label: true } },
  _count: { select: { comments: { where: { deletedAt: null } }, attachments: true, subtasks: { where: { deletedAt: null } } } },
} satisfies Prisma.TaskSelect;

/** Shape a card row for API output (flatten joins, add display key). */
export function toCard(task: {
  number: number;
  project: { key: string } & Record<string, unknown>;
  assignees: Array<{ user: unknown }>;
  labels: Array<{ label: unknown }>;
  _count: Record<string, number>;
} & Record<string, unknown>) {
  const { _count, ...rest } = task;
  return {
    ...rest,
    key: `${task.project.key}-${task.number}`,
    assignees: task.assignees.map((a) => a.user),
    labels: task.labels.map((l) => l.label),
    counts: _count,
  };
}

async function assertProjectInWorkspace(workspaceId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId, deletedAt: null },
    select: { id: true, key: true, name: true },
  });
  if (!project) throw ApiError.notFound('Project');
  return project;
}

async function assertTaskInWorkspace(workspaceId: string, taskId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, workspaceId, deletedAt: null },
    select: {
      id: true,
      projectId: true,
      parentId: true,
      title: true,
      number: true,
      columnId: true,
      statusCategory: true,
      creatorId: true,
      project: { select: { key: true, name: true } },
    },
  });
  if (!task) throw ApiError.notFound('Task');
  return task;
}

/** Rank at the end of a column. */
async function endPosition(tx: Prisma.TransactionClient, projectId: string, columnId: string | null) {
  const last = await tx.task.findFirst({
    where: { projectId, columnId, deletedAt: null },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  return rankBetween(last?.position ?? null, null);
}

function taskLink(workspaceId: string, projectId: string, taskId: string): string {
  return `${env.APP_URL}/w/${workspaceId}/projects/${projectId}/tasks/${taskId}`;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createTask(
  workspaceId: string,
  projectId: string,
  actorId: string,
  input: {
    title: string;
    description?: string;
    columnId?: string;
    sprintId?: string;
    parentId?: string;
    priority?: TaskPriority;
    startDate?: Date;
    dueDate?: Date;
    estimatedMinutes?: number;
    storyPoints?: number;
    assigneeIds?: string[];
    labelIds?: string[];
    beforeTaskId?: string;
  }
) {
  const project = await assertProjectInWorkspace(workspaceId, projectId);

  // Resolve target column: explicit, or the first column on the board.
  let columnId = input.columnId ?? null;
  let statusCategory: TaskStatusCategory = TaskStatusCategory.TODO;
  if (columnId) {
    const column = await prisma.boardColumn.findFirst({ where: { id: columnId, projectId } });
    if (!column) throw ApiError.badRequest('Column does not belong to this project');
    statusCategory = column.category as TaskStatusCategory;
  } else {
    const first = await prisma.boardColumn.findFirst({
      where: { projectId },
      orderBy: { position: 'asc' },
    });
    columnId = first?.id ?? null;
    statusCategory = (first?.category as TaskStatusCategory) ?? TaskStatusCategory.TODO;
  }

  // Subtask depth guard.
  if (input.parentId) {
    let depth = 1;
    let cursor: string | null = input.parentId;
    while (cursor) {
      const parent: { projectId: string; parentId: string | null } | null = await prisma.task.findFirst({
        where: { id: cursor, deletedAt: null },
        select: { projectId: true, parentId: true },
      });
      if (!parent) throw ApiError.notFound('Parent task');
      if (depth === 1 && parent.projectId !== projectId) {
        throw ApiError.badRequest('Parent task belongs to a different project');
      }
      cursor = parent.parentId;
      depth += 1;
      if (depth > MAX_SUBTASK_DEPTH) {
        throw ApiError.badRequest(`Maximum nesting depth is ${MAX_SUBTASK_DEPTH}`);
      }
    }
  }

  // Validate assignees are workspace members.
  const assigneeIds = [...new Set(input.assigneeIds ?? [])];
  if (assigneeIds.length > 0) {
    const members = await prisma.workspaceMember.count({
      where: { workspaceId, userId: { in: assigneeIds } },
    });
    if (members !== assigneeIds.length) {
      throw ApiError.badRequest('All assignees must be workspace members');
    }
  }

  // Validate labels belong to the workspace.
  const labelIds = [...new Set(input.labelIds ?? [])];
  if (labelIds.length > 0) {
    const labels = await prisma.label.count({ where: { workspaceId, id: { in: labelIds } } });
    if (labels !== labelIds.length) throw ApiError.badRequest('Unknown label');
  }

  const task = await prisma.$transaction(async (tx) => {
    // Atomic per-project numbering.
    const bumped = await tx.project.update({
      where: { id: projectId },
      data: { taskCounter: { increment: 1 } },
      select: { taskCounter: true },
    });

    // Position: before a given task, or end of column.
    let position: string;
    if (input.beforeTaskId) {
      const before = await tx.task.findFirst({
        where: { id: input.beforeTaskId, projectId, columnId, deletedAt: null },
        select: { position: true },
      });
      if (!before) throw ApiError.badRequest('beforeTaskId is not in the target column');
      const prev = await tx.task.findFirst({
        where: { projectId, columnId, deletedAt: null, position: { lt: before.position } },
        orderBy: { position: 'desc' },
        select: { position: true },
      });
      position = rankBetween(prev?.position ?? null, before.position);
    } else {
      position = await endPosition(tx, projectId, columnId);
    }

    return tx.task.create({
      data: {
        workspaceId,
        projectId,
        columnId,
        sprintId: input.sprintId,
        parentId: input.parentId,
        number: bumped.taskCounter,
        title: input.title,
        description: input.description,
        priority: input.priority ?? TaskPriority.NONE,
        statusCategory,
        position,
        startDate: input.startDate,
        dueDate: input.dueDate,
        estimatedMinutes: input.estimatedMinutes,
        storyPoints: input.storyPoints,
        creatorId: actorId,
        assignees: { create: assigneeIds.map((userId) => ({ userId })) },
        labels: { create: labelIds.map((labelId) => ({ labelId })) },
        // Creator + assignees watch by default.
        watchers: {
          create: [...new Set([actorId, ...assigneeIds])].map((userId) => ({ userId })),
        },
      },
      select: TASK_CARD_SELECT,
    });
  });

  recordActivity({
    workspaceId,
    actorId,
    action: 'CREATED',
    entityType: 'task',
    entityId: task.id,
    entityLabel: `${project.key}-${task.number} ${task.title}`,
    projectId,
  });

  emitToProject(projectId, SOCKET_EVENTS.TASK_CREATED, toCard(task));

  const assignedOthers = assigneeIds.filter((id) => id !== actorId);
  if (assignedOthers.length > 0) {
    void notify(assignedOthers, {
      type: 'TASK_ASSIGNED',
      title: `You were assigned ${project.key}-${task.number}`,
      body: task.title,
      link: taskLink(workspaceId, projectId, task.id),
      workspaceId,
      metadata: { taskId: task.id },
    });
  }

  // Description mentions.
  const mentioned = input.description ? extractMentions(input.description).filter((id) => id !== actorId) : [];
  if (mentioned.length > 0) {
    void notify(mentioned, {
      type: 'MENTION',
      title: `You were mentioned in ${project.key}-${task.number}`,
      body: task.title,
      link: taskLink(workspaceId, projectId, task.id),
      workspaceId,
      metadata: { taskId: task.id },
    });
  }

  return toCard(task);
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function listTasks(
  workspaceId: string,
  query: Pagination & {
    projectId?: string;
    columnId?: string;
    sprintId?: string;
    parentId?: string;
    statusCategory?: TaskStatusCategory;
    priority?: TaskPriority;
    assigneeId?: string;
    labelId?: string;
    search?: string;
    dueBefore?: Date;
    dueAfter?: Date;
    includeSubtasks?: boolean;
    overdue?: boolean;
  }
) {
  const where: Prisma.TaskWhereInput = {
    workspaceId,
    deletedAt: null,
    project: { deletedAt: null },
    ...(query.projectId ? { projectId: query.projectId } : {}),
    ...(query.columnId ? { columnId: query.columnId } : {}),
    ...(query.sprintId ? { sprintId: query.sprintId } : {}),
    ...(query.parentId ? { parentId: query.parentId } : query.includeSubtasks ? {} : { parentId: null }),
    ...(query.statusCategory ? { statusCategory: query.statusCategory } : {}),
    ...(query.priority ? { priority: query.priority } : {}),
    ...(query.assigneeId ? { assignees: { some: { userId: query.assigneeId } } } : {}),
    ...(query.labelId ? { labels: { some: { labelId: query.labelId } } } : {}),
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: 'insensitive' } },
            { description: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(query.dueBefore || query.dueAfter
      ? { dueDate: { ...(query.dueBefore ? { lte: query.dueBefore } : {}), ...(query.dueAfter ? { gte: query.dueAfter } : {}) } }
      : {}),
    ...(query.overdue ? { dueDate: { lt: new Date() }, statusCategory: { not: 'DONE' } } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.task.findMany({
      where,
      select: TASK_CARD_SELECT,
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      ...toSkipTake(query),
    }),
    prisma.task.count({ where }),
  ]);

  return { tasks: rows.map(toCard), total };
}

/** Full board payload: columns with ordered task cards (single round trip). */
export async function getBoard(workspaceId: string, projectId: string) {
  await assertProjectInWorkspace(workspaceId, projectId);
  const columns = await prisma.boardColumn.findMany({
    where: { projectId },
    orderBy: { position: 'asc' },
    include: {
      tasks: {
        where: { deletedAt: null, parentId: null },
        select: TASK_CARD_SELECT,
        orderBy: { position: 'asc' },
      },
    },
  });
  return columns.map((col) => ({
    ...col,
    tasks: col.tasks.map(toCard),
  }));
}

export async function getTask(workspaceId: string, taskId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, workspaceId, deletedAt: null },
    select: {
      ...TASK_CARD_SELECT,
      description: true,
      column: { select: { id: true, name: true, category: true, color: true } },
      sprint: { select: { id: true, name: true, status: true } },
      parent: { select: { id: true, title: true, number: true } },
      creator: { select: { id: true, name: true, avatarUrl: true } },
      watchers: { select: { user: { select: { id: true, name: true, avatarUrl: true } } } },
      checklist: { orderBy: { position: 'asc' } },
      subtasks: {
        where: { deletedAt: null },
        select: TASK_CARD_SELECT,
        orderBy: { position: 'asc' },
      },
      dependencies: {
        select: {
          id: true,
          type: true,
          dependsOnTask: { select: { id: true, title: true, number: true, statusCategory: true, project: { select: { key: true } } } },
        },
      },
      dependents: {
        select: {
          id: true,
          type: true,
          task: { select: { id: true, title: true, number: true, statusCategory: true, project: { select: { key: true } } } },
        },
      },
      recurrence: true,
      fieldValues: { include: { field: true } },
    },
  });
  if (!task) throw ApiError.notFound('Task');

  return {
    ...toCard(task as never),
    watchers: task.watchers.map((w) => w.user),
    subtasks: task.subtasks.map((s) => toCard(s as never)),
  };
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

const HISTORY_FIELDS = [
  'title',
  'description',
  'priority',
  'sprintId',
  'startDate',
  'dueDate',
  'estimatedMinutes',
  'storyPoints',
] as const;

export async function updateTask(
  workspaceId: string,
  taskId: string,
  actorId: string,
  input: Record<string, unknown> & { assigneeIds?: string[]; labelIds?: string[] }
) {
  const existing = await prisma.task.findFirst({
    where: { id: taskId, workspaceId, deletedAt: null },
    include: {
      assignees: { select: { userId: true } },
      project: { select: { key: true } },
    },
  });
  if (!existing) throw ApiError.notFound('Task');

  const { assigneeIds, labelIds, ...fields } = input;

  // Field-level history diffs.
  const historyRows: Prisma.TaskHistoryCreateManyInput[] = [];
  for (const field of HISTORY_FIELDS) {
    if (field in fields) {
      const oldVal = existing[field as keyof typeof existing];
      const newVal = fields[field];
      const oldStr = oldVal instanceof Date ? oldVal.toISOString() : oldVal == null ? null : String(oldVal);
      const newStr = newVal instanceof Date ? newVal.toISOString() : newVal == null ? null : String(newVal);
      if (oldStr !== newStr) {
        historyRows.push({ taskId, actorId, field, oldValue: oldStr, newValue: newStr });
      }
    }
  }

  // Assignee delta (for notifications + history).
  let assigneeOps: Prisma.TaskUpdateInput['assignees'];
  let newlyAssigned: string[] = [];
  if (assigneeIds) {
    const current = existing.assignees.map((a) => a.userId);
    const next = [...new Set(assigneeIds)];
    const toAdd = next.filter((id) => !current.includes(id));
    const toRemove = current.filter((id) => !next.includes(id));
    newlyAssigned = toAdd;
    if (toAdd.length > 0) {
      const members = await prisma.workspaceMember.count({
        where: { workspaceId, userId: { in: toAdd } },
      });
      if (members !== toAdd.length) throw ApiError.badRequest('All assignees must be workspace members');
    }
    assigneeOps = {
      deleteMany: toRemove.map((userId) => ({ userId })),
      create: toAdd.map((userId) => ({ userId })),
    };
    if (toAdd.length || toRemove.length) {
      historyRows.push({
        taskId,
        actorId,
        field: 'assignees',
        oldValue: current.join(','),
        newValue: next.join(','),
      });
    }
  }

  let labelOps: Prisma.TaskUpdateInput['labels'];
  if (labelIds) {
    const next = [...new Set(labelIds)];
    const count = await prisma.label.count({ where: { workspaceId, id: { in: next } } });
    if (count !== next.length) throw ApiError.badRequest('Unknown label');
    labelOps = {
      deleteMany: {},
      create: next.map((labelId) => ({ labelId })),
    };
  }

  const task = await prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({
      where: { id: taskId },
      data: {
        ...(fields as Prisma.TaskUpdateInput),
        ...(assigneeOps ? { assignees: assigneeOps } : {}),
        ...(labelOps ? { labels: labelOps } : {}),
        // New assignees auto-watch.
        ...(newlyAssigned.length > 0
          ? {
              watchers: {
                createMany: {
                  data: newlyAssigned.map((userId) => ({ userId })),
                  skipDuplicates: true,
                },
              },
            }
          : {}),
      },
      select: TASK_CARD_SELECT,
    });
    if (historyRows.length > 0) {
      await tx.taskHistory.createMany({ data: historyRows });
    }
    return updated;
  });

  recordActivity({
    workspaceId,
    actorId,
    action: 'UPDATED',
    entityType: 'task',
    entityId: taskId,
    entityLabel: `${existing.project.key}-${existing.number} ${task.title}`,
    projectId: existing.projectId,
  });

  emitToProject(existing.projectId, SOCKET_EVENTS.TASK_UPDATED, toCard(task));

  // Notify watchers (excluding the actor) about meaningful updates.
  const watchers = await prisma.taskWatcher.findMany({
    where: { taskId, userId: { not: actorId } },
    select: { userId: true },
  });
  if (watchers.length > 0 && historyRows.length > 0) {
    void notify(
      watchers.map((w) => w.userId),
      {
        type: 'TASK_UPDATED',
        title: `${existing.project.key}-${existing.number} was updated`,
        body: task.title,
        link: taskLink(workspaceId, existing.projectId, taskId),
        workspaceId,
        metadata: { taskId, fields: historyRows.map((h) => h.field) },
      }
    );
  }
  if (newlyAssigned.filter((id) => id !== actorId).length > 0) {
    void notify(
      newlyAssigned.filter((id) => id !== actorId),
      {
        type: 'TASK_ASSIGNED',
        title: `You were assigned ${existing.project.key}-${existing.number}`,
        body: task.title,
        link: taskLink(workspaceId, existing.projectId, taskId),
        workspaceId,
        metadata: { taskId },
      }
    );
  }

  return toCard(task);
}

// ---------------------------------------------------------------------------
// Move (drag & drop)
// ---------------------------------------------------------------------------

export async function moveTask(
  workspaceId: string,
  taskId: string,
  actorId: string,
  input: { columnId: string; beforeTaskId?: string; afterTaskId?: string }
) {
  const task = await assertTaskInWorkspace(workspaceId, taskId);

  const column = await prisma.boardColumn.findFirst({
    where: { id: input.columnId, projectId: task.projectId },
  });
  if (!column) throw ApiError.badRequest('Column does not belong to this project');

  // WIP limit enforcement (moving within the same column doesn't add load).
  if (column.wipLimit && column.id !== task.columnId) {
    const load = await prisma.task.count({
      where: { columnId: column.id, deletedAt: null, parentId: null },
    });
    if (load >= column.wipLimit) {
      throw ApiError.conflict(`"${column.name}" is at its WIP limit (${column.wipLimit})`);
    }
  }

  // Compute the new rank from drop neighbours.
  const [before, after] = await Promise.all([
    input.afterTaskId
      ? prisma.task.findFirst({
          where: { id: input.afterTaskId, columnId: column.id, deletedAt: null },
          select: { position: true },
        })
      : null,
    input.beforeTaskId
      ? prisma.task.findFirst({
          where: { id: input.beforeTaskId, columnId: column.id, deletedAt: null },
          select: { position: true },
        })
      : null,
  ]);

  let position: string;
  if (!before && !after) {
    position = await endPosition(prisma as unknown as Prisma.TransactionClient, task.projectId, column.id);
  } else {
    position = rankBetween(before?.position ?? null, after?.position ?? null);
  }

  const newCategory = column.category as TaskStatusCategory;
  const wasDone = task.statusCategory === 'DONE';
  const isDone = newCategory === TaskStatusCategory.DONE;

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.task.update({
      where: { id: taskId },
      data: {
        columnId: column.id,
        position,
        statusCategory: newCategory,
        completedAt: isDone ? new Date() : null,
      },
      select: TASK_CARD_SELECT,
    });
    if (task.columnId !== column.id) {
      await tx.taskHistory.create({
        data: {
          taskId,
          actorId,
          field: 'columnId',
          oldValue: task.columnId,
          newValue: column.id,
        },
      });
    }
    return row;
  });

  recordActivity({
    workspaceId,
    actorId,
    action: isDone && !wasDone ? 'COMPLETED' : 'MOVED',
    entityType: 'task',
    entityId: taskId,
    entityLabel: `${task.project.key}-${task.number} ${task.title}`,
    projectId: task.projectId,
    metadata: { toColumn: column.name },
  });

  emitToProject(task.projectId, SOCKET_EVENTS.TASK_MOVED, {
    taskId,
    projectId: task.projectId,
    fromColumnId: task.columnId,
    toColumnId: column.id,
    position,
    movedById: actorId,
    task: toCard(updated),
  });

  if (isDone && !wasDone) {
    const watchers = await prisma.taskWatcher.findMany({
      where: { taskId, userId: { not: actorId } },
      select: { userId: true },
    });
    void notify(
      watchers.map((w) => w.userId),
      {
        type: 'TASK_COMPLETED',
        title: `${task.project.key}-${task.number} was completed`,
        body: task.title,
        link: taskLink(workspaceId, task.projectId, taskId),
        workspaceId,
        metadata: { taskId },
      }
    );
  }

  return toCard(updated);
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteTask(workspaceId: string, taskId: string, actorId: string): Promise<void> {
  const task = await assertTaskInWorkspace(workspaceId, taskId);

  // Soft-delete the task and its subtask tree.
  await prisma.$transaction(async (tx) => {
    const now = new Date();
    await tx.task.update({ where: { id: taskId }, data: { deletedAt: now } });
    // Depth is capped at 3, so two passes cover all descendants.
    const children = await tx.task.findMany({
      where: { parentId: taskId, deletedAt: null },
      select: { id: true },
    });
    if (children.length > 0) {
      const childIds = children.map((c) => c.id);
      await tx.task.updateMany({ where: { id: { in: childIds } }, data: { deletedAt: now } });
      await tx.task.updateMany({
        where: { parentId: { in: childIds }, deletedAt: null },
        data: { deletedAt: now },
      });
    }
  });

  recordActivity({
    workspaceId,
    actorId,
    action: 'DELETED',
    entityType: 'task',
    entityId: taskId,
    entityLabel: `${task.project.key}-${task.number} ${task.title}`,
    projectId: task.projectId,
  });

  emitToProject(task.projectId, SOCKET_EVENTS.TASK_DELETED, { taskId, projectId: task.projectId });
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

export async function getTaskHistory(workspaceId: string, taskId: string) {
  await assertTaskInWorkspace(workspaceId, taskId);
  return prisma.taskHistory.findMany({
    where: { taskId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}
