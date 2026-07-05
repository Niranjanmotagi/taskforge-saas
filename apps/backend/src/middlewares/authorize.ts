import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { roleHasPermission, type Permission } from '@taskforge/shared-types';
import { ApiError } from '@/utils/api-error';

/**
 * RBAC permission gate. Must run after authenticate + tenantScope.
 * Usage: router.post('/', authenticate, tenantScope, authorize(PERMISSIONS.PROJECT_CREATE), handler)
 */
export function authorize(...required: Permission[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!req.workspace) {
      return next(ApiError.internal('authorize used before tenantScope'));
    }
    const role = req.workspace.role;
    const missing = required.filter((p) => !roleHasPermission(role, p));
    if (missing.length > 0) {
      return next(ApiError.forbidden());
    }
    next();
  };
}
