import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Wrap async route handlers so rejected promises reach the global error
 * handler instead of hanging the request.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
