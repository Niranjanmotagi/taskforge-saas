import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ERROR_CODES } from '@taskforge/shared-types';
import { ApiError } from '@/utils/api-error';
import { logger } from '@/lib/logger';
import { env } from '@/config/env';

/** 404 for unmatched routes. */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl}`));
}

/**
 * Global error handler: maps known error families onto the response envelope.
 * Non-operational errors are logged with stack and masked in production.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  let error: ApiError;

  if (err instanceof ApiError) {
    error = err;
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    error = mapPrismaError(err);
  } else if (err instanceof SyntaxError && 'body' in err) {
    error = ApiError.badRequest('Malformed JSON body');
  } else {
    error = ApiError.internal();
  }

  if (error.statusCode >= 500) {
    logger.error(err instanceof Error ? err.stack ?? err.message : String(err), {
      requestId: req.requestId,
      path: req.originalUrl,
    });
  }

  const message =
    error.statusCode >= 500 && env.isProduction ? 'Something went wrong' : error.message;

  res.status(error.statusCode).json({
    success: false,
    error: {
      code: error.code,
      message,
      ...(error.details ? { details: error.details } : {}),
    },
  });
}

function mapPrismaError(err: Prisma.PrismaClientKnownRequestError): ApiError {
  switch (err.code) {
    case 'P2002': {
      const target = Array.isArray(err.meta?.target) ? (err.meta.target as string[]).join(', ') : 'field';
      return ApiError.conflict(`A record with this ${target} already exists`);
    }
    case 'P2025':
      return ApiError.notFound('Record');
    case 'P2003':
      return ApiError.badRequest('Related record does not exist');
    default:
      return new ApiError(500, 'Database error', ERROR_CODES.INTERNAL_ERROR);
  }
}
