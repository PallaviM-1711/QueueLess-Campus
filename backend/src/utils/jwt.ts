/**
 * utils/jwt.ts
 * Stateless JWT helpers — sign and verify tokens.
 * The secret is loaded from the validated env config.
 */

import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { env } from '../config/env';
import { UserRole } from '../types/enums';

export interface JwtPayload {
  userId: string;
  role: UserRole;
  universityId: string;
  canteenId?: string;
}

/**
 * Signs a new JWT for a user.
 * @param userId   Mongoose ObjectId as string
 * @param role     User's role
 * @param universityId  University ObjectId as string
 */
export function signToken(
  userId: Types.ObjectId,
  role: UserRole,
  universityId: Types.ObjectId,
  canteenId?: Types.ObjectId
): string {
  const payload: JwtPayload = {
    userId: userId.toString(),
    role,
    universityId: universityId.toString(),
    ...(canteenId && { canteenId: canteenId.toString() }),
  };

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

/**
 * Verifies a JWT and returns the decoded payload.
 * Throws JsonWebTokenError or TokenExpiredError on failure.
 */
export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (
    typeof decoded !== 'object' ||
    decoded === null ||
    typeof decoded.userId !== 'string' ||
    !/^[a-f\d]{24}$/i.test(decoded.userId) ||
    typeof decoded.universityId !== 'string' ||
    !/^[a-f\d]{24}$/i.test(decoded.universityId) ||
    (decoded.canteenId !== undefined &&
      (typeof decoded.canteenId !== 'string' || !/^[a-f\d]{24}$/i.test(decoded.canteenId))) ||
    !Object.values(UserRole).includes(decoded.role)
  ) {
    throw new Error('Invalid token payload');
  }
  return {
    userId: decoded.userId,
    role: decoded.role,
    universityId: decoded.universityId,
    ...(typeof decoded.canteenId === 'string' && { canteenId: decoded.canteenId }),
  };
}
