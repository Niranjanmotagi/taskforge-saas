import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z, type ZodTypeAny } from 'zod';
import { ApiError } from '@/utils/api-error';

interface Schemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/**
 * Zod validation middleware. Parses and REPLACES req.body/query/params with
 * the sanitized output, so handlers only ever see validated data.
 */
export function validate(schemas: Schemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const issues: Array<{ path: string; message: string }> = [];

    for (const key of ['params', 'query', 'body'] as const) {
      const schema = schemas[key];
      if (!schema) continue;
      const result = schema.safeParse(req[key]);
      if (result.success) {
        // Express 5 exposes query as a getter; assign defensively.
        Object.defineProperty(req, key, { value: result.data, writable: true });
      } else {
        issues.push(
          ...result.error.issues.map((i) => ({
            path: `${key}.${i.path.join('.')}`,
            message: i.message,
          }))
        );
      }
    }

    if (issues.length > 0) {
      return next(ApiError.badRequest('Validation failed', issues));
    }
    next();
  };
}

/** Common param schema for :workspaceId routes. */
export const workspaceIdParam = z.object({ workspaceId: z.string().uuid() });

/** Generic uuid param builder, e.g. idParam('projectId'). */
export function idParam(...names: string[]): ZodTypeAny {
  const shape: Record<string, ZodTypeAny> = {};
  for (const n of names) shape[n] = z.string().uuid();
  return z.object(shape).passthrough();
}
