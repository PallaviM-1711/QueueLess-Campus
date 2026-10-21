/**
 * notFound.ts
 * Catch-all 404 middleware — registered after all known routes.
 */

import { Request, Response, NextFunction } from 'express';
import { createError } from './errorHandler';

export function notFound(req: Request, _res: Response, next: NextFunction): void {
  next(createError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}
