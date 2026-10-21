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
  const statusCode = err.statusCode ?? 500;
  const message =
    err.isOperational || process.env.NODE_ENV !== 'production'
      ? err.message
      : 'An unexpected error occurred';

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
