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
  universityId: Types.ObjectId
): string {
  const payload: JwtPayload = {
    userId: userId.toString(),
    role,
    universityId: universityId.toString(),
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
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}

