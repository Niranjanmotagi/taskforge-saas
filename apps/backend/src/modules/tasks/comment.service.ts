import { extractMentions } from '@taskforge/shared-utils';
import { prisma } from '@/lib/prisma';
import { env } from '@/config/env';
import { ApiError } from '@/utils/api-error';
import { notify } from '@/services/notification.service';
import { recordActivity } from '@/services/activity.service';
import { emitToProject, SOCKET_EVENTS } from '@/services/realtime.service';

const COMMENT_INCLUDE = {
  author: { select: { id: true, name: true, avatarUrl: true } },
  _count: { select: { replies: { where: { deletedAt: null } } } },
} as const;

async function assertTask(workspaceId: string, taskId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, workspaceId, deletedAt: null },
    select: {
      id: true,
      projectId: true,
      title: true,
      number: true,
      project: { select: { key: true } },
    },
  });
  if (!task) throw ApiError.notFound('Task');
  return task;
}

export async function listComments(workspaceId: string, taskId: string) {
  await assertTask(workspaceId, taskId);
  const comments = await prisma.comment.findMany({
    where: { taskId, deletedAt: null, parentId: null },
    orderBy: { createdAt: 'asc' },
    include: {
      ...COMMENT_INCLUDE,
      replies: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'asc' },
        include: COMMENT_INCLUDE,
      },
    },
  });
  return comments;
}

export async function createComment(
  workspaceId: string,
  taskId: string,
  authorId: string,
  input: { body: string; parentId?: string }
) {
  const task = await assertTask(workspaceId, taskId);

  if (input.parentId) {
    const parent = await prisma.comment.findFirst({
      where: { id: input.parentId, taskId, deletedAt: null },
      select: { id: true, parentId: true },
    });
    if (!parent) throw ApiError.notFound('Parent comment');
    if (parent.parentId) throw ApiError.badRequest('Replies cannot be nested further');
  }

  const comment = await prisma.comment.create({
    data: { taskId, authorId, parentId: input.parentId, body: input.body },
    include: COMMENT_INCLUDE,
  });

  // Auto-watch the task you comment on.
  await prisma.taskWatcher.upsert({
    where: { taskId_userId: { taskId, userId: authorId } },
    create: { taskId, userId: authorId },
    update: {},
  });

  recordActivity({
    workspaceId,
    actorId: authorId,
    action: 'COMMENTED',
    entityType: 'task',
    entityId: taskId,
    entityLabel: `${task.project.key}-${task.number} ${task.title}`,
    projectId: task.projectId,
  });

  emitToProject(task.projectId, SOCKET_EVENTS.COMMENT_CREATED, { taskId, comment });

  const link = `${env.APP_URL}/w/${workspaceId}/projects/${task.projectId}/tasks/${taskId}`;

  // Mentions get MENTION; other watchers get COMMENT_ADDED.
  const mentioned = extractMentions(input.body).filter((id) => id !== authorId);
  if (mentioned.length > 0) {
    void notify(mentioned, {
      type: 'MENTION',
      title: `You were mentioned in ${task.project.key}-${task.number}`,
      body: input.body.slice(0, 200),
      link,
      workspaceId,
      metadata: { taskId, commentId: comment.id },
    });
  }
  const watchers = await prisma.taskWatcher.findMany({
    where: { taskId, userId: { notIn: [authorId, ...mentioned] } },
    select: { userId: true },
  });
  if (watchers.length > 0) {
    void notify(
      watchers.map((w) => w.userId),
      {
        type: 'COMMENT_ADDED',
        title: `New comment on ${task.project.key}-${task.number}`,
        body: input.body.slice(0, 200),
        link,
        workspaceId,
        metadata: { taskId, commentId: comment.id },
      }
    );
  }

  return comment;
}

export async function updateComment(
  workspaceId: string,
  taskId: string,
  commentId: string,
  actorId: string,
  body: string
) {
  await assertTask(workspaceId, taskId);
  const comment = await prisma.comment.findFirst({
    where: { id: commentId, taskId, deletedAt: null },
  });
  if (!comment) throw ApiError.notFound('Comment');
  if (comment.authorId !== actorId) {
    throw ApiError.forbidden('You can only edit your own comments');
  }
  const updated = await prisma.comment.update({
    where: { id: commentId },
    data: { body, isEdited: true },
    include: COMMENT_INCLUDE,
  });
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { projectId: true } });
  if (task) emitToProject(task.projectId, SOCKET_EVENTS.COMMENT_UPDATED, { taskId, comment: updated });
  return updated;
}

/**
 * Delete a comment. Authors may delete their own; COMMENT_DELETE_ANY holders
 * (enforced at the route layer via canDeleteAny) may delete any.
 */
export async function deleteComment(
  workspaceId: string,
  taskId: string,
  commentId: string,
  actorId: string,
  canDeleteAny: boolean
): Promise<void> {
  await assertTask(workspaceId, taskId);
  const comment = await prisma.comment.findFirst({
    where: { id: commentId, taskId, deletedAt: null },
  });
  if (!comment) throw ApiError.notFound('Comment');
  if (comment.authorId !== actorId && !canDeleteAny) {
    throw ApiError.forbidden('You can only delete your own comments');
  }
  await prisma.comment.update({
    where: { id: commentId },
    data: { deletedAt: new Date() },
  });
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { projectId: true } });
  if (task) emitToProject(task.projectId, SOCKET_EVENTS.COMMENT_DELETED, { taskId, commentId });
}
