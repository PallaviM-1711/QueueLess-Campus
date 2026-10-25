/**
 * errorHandler.ts
 * Global Express error-handling middleware.
 * Must be registered AFTER all routes (4 parameters required by Express).
 */

import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const duplicateKey = 'code' in err && err.code === 11000;
  const validationError = err.name === 'ValidationError' || err.name === 'CastError';
  const statusCode = err.statusCode ?? (duplicateKey ? 409 : validationError ? 400 : 500);
  const defaultMessage = duplicateKey
    ? 'A record with this value already exists'
    : validationError
      ? 'The submitted data is invalid'
      : 'An unexpected error occurred';
  const message =
    err.isOperational || process.env.NODE_ENV !== 'production'
      ? err.message
      : defaultMessage;

  console.error(`[Error] ${statusCode} — ${err.message}`);

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

/** Helper to create an operational error with a status code */
export function createError(message: string, statusCode: number): AppError {
  const err: AppError = new Error(message);
  err.statusCode = statusCode;
  err.isOperational = true;
  return err;
}
