import { Router } from 'express';
import type { Request, Response } from 'express';
import { PERMISSIONS } from '@taskforge/shared-types';
import { asyncHandler } from '@/utils/async-handler';
import { authenticate, authorize, tenantScope, validate, workspaceIdParam } from '@/middlewares';
import { ok, created, paginationMeta } from '@/utils/response';
import * as timeService from './time.service';
import {
  entryIdParam,
  listEntriesQuerySchema,
  manualEntrySchema,
  startTimerSchema,
} from './time.validation';

export const timeRouter = Router();

const auth = [authenticate] as const;
const scoped = (perm: Parameters<typeof authorize>[0]) =>
  [...auth, validate({ params: workspaceIdParam }), tenantScope, authorize(perm)] as const;

/**
 * @openapi
 * /workspaces/{workspaceId}/time/active:
 *   get: { summary: Current running/paused timer, tags: [Time] }
 */
timeRouter.get(
  '/workspaces/:workspaceId/time/active',
  ...scoped(PERMISSIONS.TIME_TRACK),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await timeService.getActiveTimer(req.workspace!.id, req.user!.id));
  })
);

/**
 * @openapi
 * /workspaces/{workspaceId}/time/start:
 *   post: { summary: Start a timer (stops any previous active one), tags: [Time] }
 */
timeRouter.post(
  '/workspaces/:workspaceId/time/start',
  ...auth,
  validate({ params: workspaceIdParam, body: startTimerSchema }),
  tenantScope,
  authorize(PERMISSIONS.TIME_TRACK),
  asyncHandler(async (req: Request, res: Response) => {
    created(res, await timeService.startTimer(req.workspace!.id, req.user!.id, req.body));
  })
);

timeRouter.post(
  '/workspaces/:workspaceId/time/pause',
  ...scoped(PERMISSIONS.TIME_TRACK),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await timeService.pauseTimer(req.workspace!.id, req.user!.id));
  })
);

timeRouter.post(
  '/workspaces/:workspaceId/time/resume',
  ...scoped(PERMISSIONS.TIME_TRACK),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await timeService.resumeTimer(req.workspace!.id, req.user!.id));
  })
);

timeRouter.post(
  '/workspaces/:workspaceId/time/stop',
  ...scoped(PERMISSIONS.TIME_TRACK),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await timeService.stopTimer(req.workspace!.id, req.user!.id));
  })
);

/**
 * @openapi
 * /workspaces/{workspaceId}/time/entries:
 *   post: { summary: Manual time entry, tags: [Time] }
 *   get: { summary: List entries (own unless TIME_VIEW_ALL), tags: [Time] }
 */
timeRouter.post(
  '/workspaces/:workspaceId/time/entries',
  ...auth,
  validate({ params: workspaceIdParam, body: manualEntrySchema }),
  tenantScope,
  authorize(PERMISSIONS.TIME_TRACK),
  asyncHandler(async (req: Request, res: Response) => {
    created(res, await timeService.createManualEntry(req.workspace!.id, req.user!.id, req.body));
  })
);
timeRouter.get(
  '/workspaces/:workspaceId/time/entries',
  ...auth,
  validate({ params: workspaceIdParam, query: listEntriesQuerySchema }),
  tenantScope,
  authorize(PERMISSIONS.TIME_TRACK),
  asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as never as Parameters<typeof timeService.listEntries>[2];
    const result = await timeService.listEntries(
      req.workspace!.id,
      { userId: req.user!.id, role: req.workspace!.role },
      query
    );
    ok(
      res,
      { entries: result.entries, totalMinutes: result.totalMinutes, billableAmountCents: result.billableAmountCents },
      paginationMeta(query.page, query.limit, result.total)
    );
  })
);

timeRouter.delete(
  '/workspaces/:workspaceId/time/entries/:entryId',
  ...auth,
  validate({ params: entryIdParam }),
  tenantScope,
  authorize(PERMISSIONS.TIME_TRACK),
  asyncHandler(async (req: Request, res: Response) => {
    await timeService.deleteEntry(req.workspace!.id, req.params.entryId, {
      userId: req.user!.id,
      role: req.workspace!.role,
    });
    ok(res, null);
  })
);
