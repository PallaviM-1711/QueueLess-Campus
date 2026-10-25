import { Request, Response, NextFunction } from 'express';
import { Canteen } from '../models/Canteen';
import { User } from '../models/User';
import { UserRole } from '../types/enums';
import { createError } from './errorHandler';

export async function authorizeCanteenRead(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw createError('Authentication required', 401);
    const [user, canteen] = await Promise.all([
      User.findById(req.user.userId).select('university isActive isEmailVerified'),
      Canteen.findOne({
        _id: req.params.canteenId,
        isActive: true,
        university: req.user.universityId,
      }).select('_id'),
    ]);
    if (!user || !user.isActive || !user.isEmailVerified) {
      throw createError('Your account is not active', 403);
    }
    if (!canteen) throw createError('Canteen not found', 404);
    if (user.university.toString() !== req.user.universityId) {
      throw createError('Your account access has changed; please sign in again', 401);
    }
    next();
  } catch (error) {
    next(error);
  }
}

export async function authorizeCanteenManagement(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw createError('Authentication required', 401);
    const [user, canteen] = await Promise.all([
      User.findById(req.user.userId).select('role university canteen isActive isEmailVerified'),
      Canteen.findOne({
        _id: req.params.canteenId,
        isActive: true,
        university: req.user.universityId,
      }).select('_id university'),
    ]);
    if (!user || !user.isActive || !user.isEmailVerified) {
      throw createError('Your account is not active', 403);
    }
    if (!canteen) throw createError('Canteen not found', 404);

    const isAssignedManager =
      (user.role === UserRole.STAFF || user.role === UserRole.CANTEEN_ADMIN) &&
      user.canteen?.toString() === canteen._id.toString();
    const isUniversityAdmin =
      user.role === UserRole.SUPER_ADMIN &&
      user.university.toString() === canteen.university.toString();

    if (!isAssignedManager && !isUniversityAdmin) {
      throw createError('You do not have menu management access to this canteen', 403);
    }
    next();
  } catch (error) {
    next(error);
  }
}
