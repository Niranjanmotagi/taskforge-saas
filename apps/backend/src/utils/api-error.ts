import { ERROR_CODES, type ErrorCode } from '@taskforge/shared-types';

/**
 * Operational error carrying an HTTP status and a stable machine-readable code.
 * Anything not an ApiError reaching the error handler is treated as a bug
 * (500, details hidden in production).
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: Array<{ path: string; message: string }>;
  public readonly isOperational = true;

  constructor(
    statusCode: number,
    message: string,
    code: ErrorCode = ERROR_CODES.INTERNAL_ERROR,
    details?: Array<{ path: string; message: string }>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, details?: Array<{ path: string; message: string }>) {
    return new ApiError(400, message, ERROR_CODES.VALIDATION_ERROR, details);
  }

  static unauthorized(message = 'Authentication required', code: ErrorCode = ERROR_CODES.UNAUTHORIZED) {
    return new ApiError(401, message, code);
  }

  static forbidden(message = 'You do not have permission to perform this action') {
    return new ApiError(403, message, ERROR_CODES.FORBIDDEN);
  }

  static notFound(resource = 'Resource') {
    return new ApiError(404, `${resource} not found`, ERROR_CODES.NOT_FOUND);
  }

  static conflict(message: string) {
    return new ApiError(409, message, ERROR_CODES.CONFLICT);
  }

  static planLimit(message: string) {
    return new ApiError(402, message, ERROR_CODES.PLAN_LIMIT_REACHED);
  }

  static tooManyRequests(message = 'Too many requests, please slow down') {
    return new ApiError(429, message, ERROR_CODES.RATE_LIMITED);
  }

  static internal(message = 'Something went wrong') {
    return new ApiError(500, message, ERROR_CODES.INTERNAL_ERROR);
  }
}
