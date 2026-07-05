import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { PERMISSIONS } from '@taskforge/shared-types';
import { asyncHandler } from '@/utils/async-handler';
import { authenticate, authorize, heavyLimiter, idParam, tenantScope, validate, workspaceIdParam } from '@/middlewares';
import { ok } from '@/utils/response';
import * as aiService from './ai.service';

export const aiRouter = Router();

// All AI endpoints: auth -> tenant -> AI permission -> heavy rate limit.
const gate = (params: Parameters<typeof validate>[0]['params'], body?: Parameters<typeof validate>[0]['body']) =>
  [authenticate, heavyLimiter, validate({ params, ...(body ? { body } : {}) }), tenantScope, authorize(PERMISSIONS.AI_USE)] as const;

/**
 * @openapi
 * /workspaces/{workspaceId}/projects/{projectId}/ai/generate-tasks:
 *   post: { summary: AI task generator from a feature description, tags: [AI] }
 */
aiRouter.post(
  '/workspaces/:workspaceId/projects/:projectId/ai/generate-tasks',
  ...gate(idParam('workspaceId', 'projectId'), z.object({ prompt: z.string().trim().min(10).max(4000) })),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await aiService.generateTasks(req.workspace!.id, req.params.projectId, req.body.prompt));
  })
);

/**
 * @openapi
 * /workspaces/{workspaceId}/projects/{projectId}/ai/plan-sprint:
 *   post: { summary: AI sprint planner over the backlog, tags: [AI] }
 */
aiRouter.post(
  '/workspaces/:workspaceId/projects/:projectId/ai/plan-sprint',
  ...gate(
    idParam('workspaceId', 'projectId'),
    z.object({
      durationDays: z.number().int().min(3).max(60).default(14),
      capacityHours: z.number().int().positive().max(10000).optional(),
    })
  ),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await aiService.planSprint(req.workspace!.id, req.params.projectId, req.body));
  })
);

/**
 * @openapi
 * /workspaces/{workspaceId}/ai/meeting-summary:
 *   post: { summary: AI meeting summary (decisions + action items), tags: [AI] }
 */
aiRouter.post(
  '/workspaces/:workspaceId/ai/meeting-summary',
  ...gate(workspaceIdParam, z.object({ transcript: z.string().trim().min(50).max(100_000) })),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await aiService.summarizeMeeting(req.workspace!.id, req.body.transcript));
  })
);

/**
 * @openapi
 * /workspaces/{workspaceId}/projects/{projectId}/ai/risk-analysis:
 *   post: { summary: AI delivery risk analysis, tags: [AI] }
 */
aiRouter.post(
  '/workspaces/:workspaceId/projects/:projectId/ai/risk-analysis',
  ...gate(idParam('workspaceId', 'projectId')),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await aiService.analyzeRisk(req.workspace!.id, req.params.projectId));
  })
);

/**
 * @openapi
 * /workspaces/{workspaceId}/tasks/{taskId}/ai/suggest-priority:
 *   post: { summary: AI priority suggestion for a task, tags: [AI] }
 */
aiRouter.post(
  '/workspaces/:workspaceId/tasks/:taskId/ai/suggest-priority',
  ...gate(idParam('workspaceId', 'taskId')),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await aiService.suggestPriority(req.workspace!.id, req.params.taskId));
  })
);

/**
 * @openapi
 * /workspaces/{workspaceId}/projects/{projectId}/ai/predict-deadline:
 *   post: { summary: AI completion-date forecast from throughput, tags: [AI] }
 */
aiRouter.post(
  '/workspaces/:workspaceId/projects/:projectId/ai/predict-deadline',
  ...gate(idParam('workspaceId', 'projectId')),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await aiService.predictDeadline(req.workspace!.id, req.params.projectId));
  })
);
