import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { PERMISSIONS } from '@taskforge/shared-types';
import { asyncHandler } from '@/utils/async-handler';
import { authenticate, authorize, idParam, tenantScope, validate, workspaceIdParam } from '@/middlewares';
import { ok } from '@/utils/response';
import * as reportService from './report.service';

export const reportRouter = Router();

const auth = [authenticate] as const;

/**
 * @openapi
 * /workspaces/{workspaceId}/reports/dashboard:
 *   get: { summary: Dashboard stats, charts, activity, deadlines, tags: [Reports] }
 */
reportRouter.get(
  '/workspaces/:workspaceId/reports/dashboard',
  ...auth,
  validate({ params: workspaceIdParam }),
  tenantScope,
  authorize(PERMISSIONS.WORKSPACE_VIEW),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await reportService.dashboard(req.workspace!.id, req.user!.id));
  })
);

/**
 * @openapi
 * /workspaces/{workspaceId}/projects/{projectId}/reports/burndown/{sprintId}:
 *   get: { summary: Sprint burndown series, tags: [Reports] }
 */
reportRouter.get(
  '/workspaces/:workspaceId/projects/:projectId/reports/burndown/:sprintId',
  ...auth,
  validate({ params: idParam('workspaceId', 'projectId', 'sprintId') }),
  tenantScope,
  authorize(PERMISSIONS.REPORT_VIEW),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await reportService.burndown(req.workspace!.id, req.params.projectId, req.params.sprintId));
  })
);

/**
 * @openapi
 * /workspaces/{workspaceId}/projects/{projectId}/reports/velocity:
 *   get: { summary: Velocity across completed sprints, tags: [Reports] }
 */
reportRouter.get(
  '/workspaces/:workspaceId/projects/:projectId/reports/velocity',
  ...auth,
  validate({ params: idParam('workspaceId', 'projectId') }),
  tenantScope,
  authorize(PERMISSIONS.REPORT_VIEW),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await reportService.velocity(req.workspace!.id, req.params.projectId));
  })
);

/**
 * @openapi
 * /workspaces/{workspaceId}/reports/workload:
 *   get: { summary: Per-member open tasks and estimates, tags: [Reports] }
 */
reportRouter.get(
  '/workspaces/:workspaceId/reports/workload',
  ...auth,
  validate({
    params: workspaceIdParam,
    query: z.object({ projectId: z.string().uuid().optional() }),
  }),
  tenantScope,
  authorize(PERMISSIONS.REPORT_VIEW),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await reportService.workload(req.workspace!.id, req.query.projectId as string | undefined));
  })
);

/**
 * @openapi
 * /workspaces/{workspaceId}/reports/time:
 *   get: { summary: Time & billable report by user/project, tags: [Reports] }
 */
reportRouter.get(
  '/workspaces/:workspaceId/reports/time',
  ...auth,
  validate({
    params: workspaceIdParam,
    query: z.object({
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional(),
      projectId: z.string().uuid().optional(),
      userId: z.string().uuid().optional(),
    }),
  }),
  tenantScope,
  authorize(PERMISSIONS.REPORT_VIEW),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await reportService.timeReport(req.workspace!.id, req.query as never));
  })
);
