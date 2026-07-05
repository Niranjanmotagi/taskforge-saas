import { Router } from 'express';
import { z } from 'zod';
import { PERMISSIONS } from '@taskforge/shared-types';
import { asyncHandler } from '@/utils/async-handler';
import { authenticate, authorize, idParam, tenantScope, validate, workspaceIdParam } from '@/middlewares';
import * as controller from './task.controller';
import {
  checklistCreateSchema,
  checklistUpdateSchema,
  columnCreateSchema,
  columnUpdateSchema,
  commentCreateSchema,
  commentUpdateSchema,
  createTaskSchema,
  customFieldCreateSchema,
  customFieldValueSchema,
  dependencyCreateSchema,
  labelCreateSchema,
  labelUpdateSchema,
  listTasksQuerySchema,
  moveTaskSchema,
  projectScopedParam,
  recurrenceSchema,
  taskIdParam,
  updateTaskSchema,
} from './task.validation';

export const taskRouter = Router();

const auth = [authenticate] as const;

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

/**
 * @openapi
 * /workspaces/{workspaceId}/projects/{projectId}/tasks:
 *   post:
 *     summary: Create a task/subtask (atomic per-project numbering)
 *     tags: [Tasks]
 */
taskRouter.post(
  '/workspaces/:workspaceId/projects/:projectId/tasks',
  ...auth,
  validate({ params: projectScopedParam, body: createTaskSchema }),
  tenantScope,
  authorize(PERMISSIONS.TASK_CREATE),
  asyncHandler(controller.createTask)
);

/**
 * @openapi
 * /workspaces/{workspaceId}/projects/{projectId}/board:
 *   get:
 *     summary: Kanban board — columns with ordered task cards
 *     tags: [Tasks]
 */
taskRouter.get(
  '/workspaces/:workspaceId/projects/:projectId/board',
  ...auth,
  validate({ params: projectScopedParam }),
  tenantScope,
  authorize(PERMISSIONS.TASK_VIEW),
  asyncHandler(controller.getBoard)
);

/**
 * @openapi
 * /workspaces/{workspaceId}/tasks:
 *   get:
 *     summary: Search/filter tasks across the workspace (paginated)
 *     tags: [Tasks]
 */
taskRouter.get(
  '/workspaces/:workspaceId/tasks',
  ...auth,
  validate({ params: workspaceIdParam, query: listTasksQuerySchema }),
  tenantScope,
  authorize(PERMISSIONS.TASK_VIEW),
  asyncHandler(controller.listTasks)
);

/**
 * @openapi
 * /workspaces/{workspaceId}/tasks/{taskId}:
 *   get:
 *     summary: Full task detail (subtasks, checklist, dependencies, fields)
 *     tags: [Tasks]
 *   patch:
 *     summary: Update task fields/assignees/labels (writes history)
 *     tags: [Tasks]
 *   delete:
 *     summary: Soft-delete task + subtask tree
 *     tags: [Tasks]
 */
taskRouter.get(
  '/workspaces/:workspaceId/tasks/:taskId',
  ...auth,
  validate({ params: taskIdParam }),
  tenantScope,
  authorize(PERMISSIONS.TASK_VIEW),
  asyncHandler(controller.getTask)
);
taskRouter.patch(
  '/workspaces/:workspaceId/tasks/:taskId',
  ...auth,
  validate({ params: taskIdParam, body: updateTaskSchema }),
  tenantScope,
  authorize(PERMISSIONS.TASK_UPDATE),
  asyncHandler(controller.updateTask)
);
taskRouter.delete(
  '/workspaces/:workspaceId/tasks/:taskId',
  ...auth,
  validate({ params: taskIdParam }),
  tenantScope,
  authorize(PERMISSIONS.TASK_DELETE),
  asyncHandler(controller.deleteTask)
);

/**
 * @openapi
 * /workspaces/{workspaceId}/tasks/{taskId}/move:
 *   post:
 *     summary: Drag-drop move (column + fractional position, WIP limits)
 *     tags: [Tasks]
 */
taskRouter.post(
  '/workspaces/:workspaceId/tasks/:taskId/move',
  ...auth,
  validate({ params: taskIdParam, body: moveTaskSchema }),
  tenantScope,
  authorize(PERMISSIONS.TASK_UPDATE),
  asyncHandler(controller.moveTask)
);

taskRouter.get(
  '/workspaces/:workspaceId/tasks/:taskId/history',
  ...auth,
  validate({ params: taskIdParam }),
  tenantScope,
  authorize(PERMISSIONS.TASK_VIEW),
  asyncHandler(controller.getTaskHistory)
);

// ---------------------------------------------------------------------------
// Checklist
// ---------------------------------------------------------------------------

taskRouter.post(
  '/workspaces/:workspaceId/tasks/:taskId/checklist',
  ...auth,
  validate({ params: taskIdParam, body: checklistCreateSchema }),
  tenantScope,
  authorize(PERMISSIONS.TASK_UPDATE),
  asyncHandler(controller.addChecklistItem)
);
taskRouter.patch(
  '/workspaces/:workspaceId/tasks/:taskId/checklist/:itemId',
  ...auth,
  validate({ params: idParam('workspaceId', 'taskId', 'itemId'), body: checklistUpdateSchema }),
  tenantScope,
  authorize(PERMISSIONS.TASK_UPDATE),
  asyncHandler(controller.updateChecklistItem)
);
taskRouter.delete(
  '/workspaces/:workspaceId/tasks/:taskId/checklist/:itemId',
  ...auth,
  validate({ params: idParam('workspaceId', 'taskId', 'itemId') }),
  tenantScope,
  authorize(PERMISSIONS.TASK_UPDATE),
  asyncHandler(controller.deleteChecklistItem)
);

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

taskRouter.get(
  '/workspaces/:workspaceId/tasks/:taskId/comments',
  ...auth,
  validate({ params: taskIdParam }),
  tenantScope,
  authorize(PERMISSIONS.COMMENT_VIEW),
  asyncHandler(controller.listComments)
);
taskRouter.post(
  '/workspaces/:workspaceId/tasks/:taskId/comments',
  ...auth,
  validate({ params: taskIdParam, body: commentCreateSchema }),
  tenantScope,
  authorize(PERMISSIONS.COMMENT_CREATE),
  asyncHandler(controller.createComment)
);
taskRouter.patch(
  '/workspaces/:workspaceId/tasks/:taskId/comments/:commentId',
  ...auth,
  validate({ params: idParam('workspaceId', 'taskId', 'commentId'), body: commentUpdateSchema }),
  tenantScope,
  authorize(PERMISSIONS.COMMENT_UPDATE_OWN),
  asyncHandler(controller.updateComment)
);
taskRouter.delete(
  '/workspaces/:workspaceId/tasks/:taskId/comments/:commentId',
  ...auth,
  validate({ params: idParam('workspaceId', 'taskId', 'commentId') }),
  tenantScope,
  authorize(PERMISSIONS.COMMENT_VIEW),
  asyncHandler(controller.deleteComment)
);

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

taskRouter.post(
  '/workspaces/:workspaceId/tasks/:taskId/dependencies',
  ...auth,
  validate({ params: taskIdParam, body: dependencyCreateSchema }),
  tenantScope,
  authorize(PERMISSIONS.TASK_UPDATE),
  asyncHandler(controller.addDependency)
);
taskRouter.delete(
  '/workspaces/:workspaceId/tasks/:taskId/dependencies/:dependencyId',
  ...auth,
  validate({ params: idParam('workspaceId', 'taskId', 'dependencyId') }),
  tenantScope,
  authorize(PERMISSIONS.TASK_UPDATE),
  asyncHandler(controller.removeDependency)
);

// ---------------------------------------------------------------------------
// Watchers / recurrence
// ---------------------------------------------------------------------------

taskRouter.post(
  '/workspaces/:workspaceId/tasks/:taskId/watch',
  ...auth,
  validate({ params: taskIdParam }),
  tenantScope,
  authorize(PERMISSIONS.TASK_VIEW),
  asyncHandler(controller.toggleWatcher)
);
taskRouter.put(
  '/workspaces/:workspaceId/tasks/:taskId/recurrence',
  ...auth,
  validate({ params: taskIdParam, body: recurrenceSchema }),
  tenantScope,
  authorize(PERMISSIONS.TASK_UPDATE),
  asyncHandler(controller.setRecurrence)
);
taskRouter.delete(
  '/workspaces/:workspaceId/tasks/:taskId/recurrence',
  ...auth,
  validate({ params: taskIdParam }),
  tenantScope,
  authorize(PERMISSIONS.TASK_UPDATE),
  asyncHandler(controller.removeRecurrence)
);

// ---------------------------------------------------------------------------
// Labels (workspace-level)
// ---------------------------------------------------------------------------

taskRouter.get(
  '/workspaces/:workspaceId/labels',
  ...auth,
  validate({ params: workspaceIdParam }),
  tenantScope,
  authorize(PERMISSIONS.TASK_VIEW),
  asyncHandler(controller.listLabels)
);
taskRouter.post(
  '/workspaces/:workspaceId/labels',
  ...auth,
  validate({ params: workspaceIdParam, body: labelCreateSchema }),
  tenantScope,
  authorize(PERMISSIONS.TASK_UPDATE),
  asyncHandler(controller.createLabel)
);
taskRouter.patch(
  '/workspaces/:workspaceId/labels/:labelId',
  ...auth,
  validate({ params: idParam('workspaceId', 'labelId'), body: labelUpdateSchema }),
  tenantScope,
  authorize(PERMISSIONS.TASK_UPDATE),
  asyncHandler(controller.updateLabel)
);
taskRouter.delete(
  '/workspaces/:workspaceId/labels/:labelId',
  ...auth,
  validate({ params: idParam('workspaceId', 'labelId') }),
  tenantScope,
  authorize(PERMISSIONS.TASK_DELETE),
  asyncHandler(controller.deleteLabel)
);

// ---------------------------------------------------------------------------
// Custom fields
// ---------------------------------------------------------------------------

taskRouter.get(
  '/workspaces/:workspaceId/custom-fields',
  ...auth,
  validate({
    params: workspaceIdParam,
    query: z.object({ projectId: z.string().uuid().optional() }),
  }),
  tenantScope,
  authorize(PERMISSIONS.TASK_VIEW),
  asyncHandler(controller.listCustomFields)
);
taskRouter.post(
  '/workspaces/:workspaceId/custom-fields',
  ...auth,
  validate({ params: workspaceIdParam, body: customFieldCreateSchema }),
  tenantScope,
  authorize(PERMISSIONS.PROJECT_UPDATE),
  asyncHandler(controller.createCustomField)
);
taskRouter.delete(
  '/workspaces/:workspaceId/custom-fields/:fieldId',
  ...auth,
  validate({ params: idParam('workspaceId', 'fieldId') }),
  tenantScope,
  authorize(PERMISSIONS.PROJECT_UPDATE),
  asyncHandler(controller.deleteCustomField)
);
taskRouter.put(
  '/workspaces/:workspaceId/tasks/:taskId/custom-fields',
  ...auth,
  validate({ params: taskIdParam, body: customFieldValueSchema }),
  tenantScope,
  authorize(PERMISSIONS.TASK_UPDATE),
  asyncHandler(controller.setCustomFieldValue)
);

// ---------------------------------------------------------------------------
// Board columns
// ---------------------------------------------------------------------------

taskRouter.post(
  '/workspaces/:workspaceId/projects/:projectId/columns',
  ...auth,
  validate({ params: projectScopedParam, body: columnCreateSchema }),
  tenantScope,
  authorize(PERMISSIONS.PROJECT_UPDATE),
  asyncHandler(controller.createColumn)
);
taskRouter.patch(
  '/workspaces/:workspaceId/projects/:projectId/columns/:columnId',
  ...auth,
  validate({ params: idParam('workspaceId', 'projectId', 'columnId'), body: columnUpdateSchema }),
  tenantScope,
  authorize(PERMISSIONS.PROJECT_UPDATE),
  asyncHandler(controller.updateColumn)
);
taskRouter.delete(
  '/workspaces/:workspaceId/projects/:projectId/columns/:columnId',
  ...auth,
  validate({
    params: idParam('workspaceId', 'projectId', 'columnId'),
    query: z.object({ moveTasksTo: z.string().uuid().optional() }),
  }),
  tenantScope,
  authorize(PERMISSIONS.PROJECT_UPDATE),
  asyncHandler(controller.deleteColumn)
);
