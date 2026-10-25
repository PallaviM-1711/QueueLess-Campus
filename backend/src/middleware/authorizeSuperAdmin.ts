import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import { UserRole } from '../types/enums';
import { createError } from './errorHandler';

export async function authorizeSuperAdmin(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw createError('Authentication required', 401);
    const user = await User.findById(req.user.userId)
      .select('role university isActive isEmailVerified');
    if (
      !user ||
      !user.isActive ||
      !user.isEmailVerified ||
      user.role !== UserRole.SUPER_ADMIN ||
      req.user.role !== UserRole.SUPER_ADMIN
    ) {
      throw createError('Super-admin access is required', 403);
    }
    if (user.university.toString() !== req.user.universityId) {
      throw createError('Your university access has changed; please sign in again', 401);
    }
    next();
  } catch (error) {
    next(error);
  }
}
