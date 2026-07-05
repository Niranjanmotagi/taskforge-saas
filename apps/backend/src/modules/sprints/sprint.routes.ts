import { Router } from 'express';
import type { Request, Response } from 'express';
import { PERMISSIONS } from '@taskforge/shared-types';
import { asyncHandler } from '@/utils/async-handler';
import { authenticate, authorize, tenantScope, validate } from '@/middlewares';
import { ok, created } from '@/utils/response';
import * as sprintService from './sprint.service';
import {
  assignTasksSchema,
  completeSprintSchema,
  createSprintSchema,
  sprintIdParam,
  updateSprintSchema,
} from './sprint.validation';
import { projectScopedParam } from '@/modules/tasks/task.validation';

export const sprintRouter = Router();

const auth = [authenticate] as const;

/**
 * @openapi
 * /workspaces/{workspaceId}/projects/{projectId}/sprints:
 *   get: { summary: List sprints with counts, tags: [Sprints] }
 *   post: { summary: Create a sprint, tags: [Sprints] }
 */
sprintRouter.get(
  '/workspaces/:workspaceId/projects/:projectId/sprints',
  ...auth,
  validate({ params: projectScopedParam }),
  tenantScope,
  authorize(PERMISSIONS.SPRINT_VIEW),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await sprintService.listSprints(req.workspace!.id, req.params.projectId));
  })
);
sprintRouter.post(
  '/workspaces/:workspaceId/projects/:projectId/sprints',
  ...auth,
  validate({ params: projectScopedParam, body: createSprintSchema }),
  tenantScope,
  authorize(PERMISSIONS.SPRINT_MANAGE),
  asyncHandler(async (req: Request, res: Response) => {
    created(res, await sprintService.createSprint(req.workspace!.id, req.params.projectId, req.user!.id, req.body));
  })
);

/**
 * @openapi
 * /workspaces/{workspaceId}/projects/{projectId}/sprints/{sprintId}:
 *   patch: { summary: Update sprint (single ACTIVE enforced), tags: [Sprints] }
 *   delete: { summary: Delete sprint (tasks detach), tags: [Sprints] }
 */
sprintRouter.patch(
  '/workspaces/:workspaceId/projects/:projectId/sprints/:sprintId',
  ...auth,
  validate({ params: sprintIdParam, body: updateSprintSchema }),
  tenantScope,
  authorize(PERMISSIONS.SPRINT_MANAGE),
  asyncHandler(async (req: Request, res: Response) => {
    ok(
      res,
      await sprintService.updateSprint(
        req.workspace!.id,
        req.params.projectId,
        req.params.sprintId,
        req.user!.id,
        req.body
      )
    );
  })
);
sprintRouter.delete(
  '/workspaces/:workspaceId/projects/:projectId/sprints/:sprintId',
  ...auth,
  validate({ params: sprintIdParam }),
  tenantScope,
  authorize(PERMISSIONS.SPRINT_MANAGE),
  asyncHandler(async (req: Request, res: Response) => {
    await sprintService.deleteSprint(req.workspace!.id, req.params.projectId, req.params.sprintId);
    ok(res, null);
  })
);

/**
 * @openapi
 * /workspaces/{workspaceId}/projects/{projectId}/sprints/{sprintId}/complete:
 *   post: { summary: Complete sprint; open tasks move to backlog/next sprint, tags: [Sprints] }
 */
sprintRouter.post(
  '/workspaces/:workspaceId/projects/:projectId/sprints/:sprintId/complete',
  ...auth,
  validate({ params: sprintIdParam, body: completeSprintSchema }),
  tenantScope,
  authorize(PERMISSIONS.SPRINT_MANAGE),
  asyncHandler(async (req: Request, res: Response) => {
    ok(
      res,
      await sprintService.completeSprint(
        req.workspace!.id,
        req.params.projectId,
        req.params.sprintId,
        req.user!.id,
        req.body.moveOpenTasksToSprintId
      )
    );
  })
);

/**
 * @openapi
 * /workspaces/{workspaceId}/projects/{projectId}/sprints/{sprintId}/tasks:
 *   post: { summary: Bulk-assign tasks to sprint, tags: [Sprints] }
 */
sprintRouter.post(
  '/workspaces/:workspaceId/projects/:projectId/sprints/:sprintId/tasks',
  ...auth,
  validate({ params: sprintIdParam, body: assignTasksSchema }),
  tenantScope,
  authorize(PERMISSIONS.SPRINT_MANAGE),
  asyncHandler(async (req: Request, res: Response) => {
    ok(
      res,
      await sprintService.assignTasks(
        req.workspace!.id,
        req.params.projectId,
        req.params.sprintId,
        req.body.taskIds
      )
    );
  })
);
