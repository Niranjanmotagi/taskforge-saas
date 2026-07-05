import type { Request, Response } from 'express';
import { PERMISSIONS, roleHasPermission } from '@taskforge/shared-types';
import { ok, created, paginationMeta } from '@/utils/response';
import * as taskService from './task.service';
import * as extras from './task-extras.service';
import * as commentService from './comment.service';
import * as boardService from './board.service';

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export async function createTask(req: Request, res: Response): Promise<void> {
  const task = await taskService.createTask(
    req.workspace!.id,
    req.params.projectId,
    req.user!.id,
    req.body
  );
  created(res, task);
}

export async function listTasks(req: Request, res: Response): Promise<void> {
  const query = req.query as never as Parameters<typeof taskService.listTasks>[1];
  const { tasks, total } = await taskService.listTasks(req.workspace!.id, query);
  ok(res, tasks, paginationMeta(query.page, query.limit, total));
}

export async function getBoard(req: Request, res: Response): Promise<void> {
  ok(res, await taskService.getBoard(req.workspace!.id, req.params.projectId));
}

export async function getTask(req: Request, res: Response): Promise<void> {
  ok(res, await taskService.getTask(req.workspace!.id, req.params.taskId));
}

export async function updateTask(req: Request, res: Response): Promise<void> {
  ok(res, await taskService.updateTask(req.workspace!.id, req.params.taskId, req.user!.id, req.body));
}

export async function moveTask(req: Request, res: Response): Promise<void> {
  ok(res, await taskService.moveTask(req.workspace!.id, req.params.taskId, req.user!.id, req.body));
}

export async function deleteTask(req: Request, res: Response): Promise<void> {
  await taskService.deleteTask(req.workspace!.id, req.params.taskId, req.user!.id);
  ok(res, null);
}

export async function getTaskHistory(req: Request, res: Response): Promise<void> {
  ok(res, await taskService.getTaskHistory(req.workspace!.id, req.params.taskId));
}

// ---------------------------------------------------------------------------
// Checklist
// ---------------------------------------------------------------------------

export async function addChecklistItem(req: Request, res: Response): Promise<void> {
  created(res, await extras.addChecklistItem(req.workspace!.id, req.params.taskId, req.body.title));
}

export async function updateChecklistItem(req: Request, res: Response): Promise<void> {
  ok(res, await extras.updateChecklistItem(req.workspace!.id, req.params.taskId, req.params.itemId, req.body));
}

export async function deleteChecklistItem(req: Request, res: Response): Promise<void> {
  await extras.deleteChecklistItem(req.workspace!.id, req.params.taskId, req.params.itemId);
  ok(res, null);
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export async function listLabels(req: Request, res: Response): Promise<void> {
  ok(res, await extras.listLabels(req.workspace!.id));
}

export async function createLabel(req: Request, res: Response): Promise<void> {
  created(res, await extras.createLabel(req.workspace!.id, req.body));
}

export async function updateLabel(req: Request, res: Response): Promise<void> {
  ok(res, await extras.updateLabel(req.workspace!.id, req.params.labelId, req.body));
}

export async function deleteLabel(req: Request, res: Response): Promise<void> {
  await extras.deleteLabel(req.workspace!.id, req.params.labelId);
  ok(res, null);
}

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

export async function addDependency(req: Request, res: Response): Promise<void> {
  created(res, await extras.addDependency(req.workspace!.id, req.params.taskId, req.body));
}

export async function removeDependency(req: Request, res: Response): Promise<void> {
  await extras.removeDependency(req.workspace!.id, req.params.taskId, req.params.dependencyId);
  ok(res, null);
}

// ---------------------------------------------------------------------------
// Watchers / recurrence / custom fields
// ---------------------------------------------------------------------------

export async function toggleWatcher(req: Request, res: Response): Promise<void> {
  ok(res, await extras.toggleWatcher(req.workspace!.id, req.params.taskId, req.user!.id));
}

export async function setRecurrence(req: Request, res: Response): Promise<void> {
  ok(res, await extras.setRecurrence(req.workspace!.id, req.params.taskId, req.body));
}

export async function removeRecurrence(req: Request, res: Response): Promise<void> {
  await extras.removeRecurrence(req.workspace!.id, req.params.taskId);
  ok(res, null);
}

export async function listCustomFields(req: Request, res: Response): Promise<void> {
  ok(res, await extras.listCustomFields(req.workspace!.id, req.query.projectId as string | undefined));
}

export async function createCustomField(req: Request, res: Response): Promise<void> {
  created(res, await extras.createCustomField(req.workspace!.id, req.body));
}

export async function deleteCustomField(req: Request, res: Response): Promise<void> {
  await extras.deleteCustomField(req.workspace!.id, req.params.fieldId);
  ok(res, null);
}

export async function setCustomFieldValue(req: Request, res: Response): Promise<void> {
  ok(res, await extras.setCustomFieldValue(req.workspace!.id, req.params.taskId, req.body));
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export async function listComments(req: Request, res: Response): Promise<void> {
  ok(res, await commentService.listComments(req.workspace!.id, req.params.taskId));
}

export async function createComment(req: Request, res: Response): Promise<void> {
  created(
    res,
    await commentService.createComment(req.workspace!.id, req.params.taskId, req.user!.id, req.body)
  );
}

export async function updateComment(req: Request, res: Response): Promise<void> {
  ok(
    res,
    await commentService.updateComment(
      req.workspace!.id,
      req.params.taskId,
      req.params.commentId,
      req.user!.id,
      req.body.body
    )
  );
}

export async function deleteComment(req: Request, res: Response): Promise<void> {
  const canDeleteAny = roleHasPermission(req.workspace!.role, PERMISSIONS.COMMENT_DELETE_ANY);
  await commentService.deleteComment(
    req.workspace!.id,
    req.params.taskId,
    req.params.commentId,
    req.user!.id,
    canDeleteAny
  );
  ok(res, null);
}

// ---------------------------------------------------------------------------
// Board columns
// ---------------------------------------------------------------------------

export async function createColumn(req: Request, res: Response): Promise<void> {
  created(res, await boardService.createColumn(req.workspace!.id, req.params.projectId, req.body));
}

export async function updateColumn(req: Request, res: Response): Promise<void> {
  ok(
    res,
    await boardService.updateColumn(req.workspace!.id, req.params.projectId, req.params.columnId, req.body)
  );
}

export async function deleteColumn(req: Request, res: Response): Promise<void> {
  await boardService.deleteColumn(
    req.workspace!.id,
    req.params.projectId,
    req.params.columnId,
    req.query.moveTasksTo as string | undefined
  );
  ok(res, null);
}
