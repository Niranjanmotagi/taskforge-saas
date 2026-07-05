import type { Response } from 'express';
import type { ApiMeta } from '@taskforge/shared-types';

/** Send a success envelope: { success: true, data, meta? }. */
export function ok<T>(res: Response, data: T, meta?: ApiMeta, statusCode = 200): Response {
  return res.status(statusCode).json({ success: true, data, ...(meta ? { meta } : {}) });
}

/** 201 Created variant. */
export function created<T>(res: Response, data: T): Response {
  return ok(res, data, undefined, 201);
}

/** 204-style empty success (kept as 200 + null for consistent envelopes). */
export function noContent(res: Response): Response {
  return ok(res, null);
}

/** Build pagination meta from totals. */
export function paginationMeta(page: number, limit: number, total: number): ApiMeta {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return { page, limit, total, totalPages, hasMore: page < totalPages };
}
