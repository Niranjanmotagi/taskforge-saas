import { Router } from 'express';
import { PERMISSIONS } from '@taskforge/shared-types';
import { asyncHandler } from '@/utils/async-handler';
import { authenticate, authorize, tenantScope, validate, workspaceIdParam } from '@/middlewares';
import * as controller from './project.controller';
import {
  createProjectSchema,
  duplicateProjectSchema,
  listProjectsQuerySchema,
  projectIdParam,
  updateProjectSchema,
} from './project.validation';

export const projectRouter = Router();

// Shared middleware prefix for all project routes.
const base = [authenticate] as const;

/**
 * @openapi
 * /workspaces/{workspaceId}/projects:
 *   post:
 *     summary: Create a project (default board columns + chat channel provisioned)
 *     tags: [Projects]
 *   get:
 *     summary: List projects (filter by status/search/favorites/templates, paginated)
 *     tags: [Projects]
 */
projectRouter.post(
  '/workspaces/:workspaceId/projects',
  ...base,
  validate({ params: workspaceIdParam, body: createProjectSchema }),
  tenantScope,
  authorize(PERMISSIONS.PROJECT_CREATE),
  asyncHandler(controller.createProject)
);
projectRouter.get(
  '/workspaces/:workspaceId/projects',
  ...base,
  validate({ params: workspaceIdParam, query: listProjectsQuerySchema }),
  tenantScope,
  authorize(PERMISSIONS.PROJECT_VIEW),
  asyncHandler(controller.listProjects)
);

/**
 * @openapi
 * /workspaces/{workspaceId}/projects/{projectId}:
 *   get:
 *     summary: Project detail with columns, sprints, progress
 *     tags: [Projects]
 *   patch:
 *     summary: Update project (status=ARCHIVED archives it)
 *     tags: [Projects]
 *   delete:
 *     summary: Soft-delete project
 *     tags: [Projects]
 */
projectRouter.get(
  '/workspaces/:workspaceId/projects/:projectId',
  ...base,
  validate({ params: projectIdParam }),
  tenantScope,
  authorize(PERMISSIONS.PROJECT_VIEW),
  asyncHandler(controller.getProject)
);
projectRouter.patch(
  '/workspaces/:workspaceId/projects/:projectId',
  ...base,
  validate({ params: projectIdParam, body: updateProjectSchema }),
  tenantScope,
  authorize(PERMISSIONS.PROJECT_UPDATE),
  asyncHandler(controller.updateProject)
);
projectRouter.delete(
  '/workspaces/:workspaceId/projects/:projectId',
  ...base,
  validate({ params: projectIdParam }),
  tenantScope,
  authorize(PERMISSIONS.PROJECT_DELETE),
  asyncHandler(controller.deleteProject)
);

/**
 * @openapi
 * /workspaces/{workspaceId}/projects/{projectId}/favorite:
 *   post:
 *     summary: Toggle personal favorite flag
 *     tags: [Projects]
 */
projectRouter.post(
  '/workspaces/:workspaceId/projects/:projectId/favorite',
  ...base,
  validate({ params: projectIdParam }),
  tenantScope,
  authorize(PERMISSIONS.PROJECT_VIEW),
  asyncHandler(controller.toggleFavorite)
);

/**
 * @openapi
 * /workspaces/{workspaceId}/projects/{projectId}/duplicate:
 *   post:
 *     summary: Duplicate a project (columns, members, optionally tasks)
 *     tags: [Projects]
 */
projectRouter.post(
  '/workspaces/:workspaceId/projects/:projectId/duplicate',
  ...base,
  validate({ params: projectIdParam, body: duplicateProjectSchema }),
  tenantScope,
  authorize(PERMISSIONS.PROJECT_CREATE),
  asyncHandler(controller.duplicateProject)
);

/**
 * @openapi
 * /workspaces/{workspaceId}/projects/{projectId}/health/refresh:
 *   post:
 *     summary: Recompute derived project health
 *     tags: [Projects]
 */
projectRouter.post(
  '/workspaces/:workspaceId/projects/:projectId/health/refresh',
  ...base,
  validate({ params: projectIdParam }),
  tenantScope,
  authorize(PERMISSIONS.PROJECT_VIEW),
  asyncHandler(controller.refreshHealth)
);
