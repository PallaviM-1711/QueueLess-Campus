/**
 * middleware/authenticate.ts
 * Verifies the JWT from the Authorization header and attaches
 * the decoded payload to req.user.
 *
 * Usage: router.get('/protected', authenticate, handler)
 */

import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../utils/jwt';
import { createError } from './errorHandler';
import { UserRole } from '../types/enums';

// Augment Express Request to carry our decoded user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(createError('Authentication required — no token provided', 401));
  }

  const token = authHeader.split(' ')[1];

  try {
    req.user = verifyToken(token);
    next();
  } catch (err: unknown) {
    const message =
      err instanceof Error && err.name === 'TokenExpiredError'
        ? 'Session expired — please log in again'
        : 'Invalid or malformed token';
    next(createError(message, 401));
  }
}

/**
 * authorize(...roles)
 * Must be used AFTER authenticate.
 * Returns 403 if the authenticated user's role is not in the allowed list.
 */
export function authorize(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }
    if (!roles.includes(req.user.role)) {
      return next(
        createError(
          `Access denied — required role: ${roles.join(' or ')}`,
          403
        )
      );
    }
    next();
  };
}

