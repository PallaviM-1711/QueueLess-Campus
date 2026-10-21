/**
 * utils/otp.ts
 * Generates a 6-digit numeric OTP and an expiry timestamp.
 * Used for college email verification.
 */

import crypto from 'crypto';

const OTP_TTL_MINUTES = 10;

export function generateOtp(): { otp: string; expiry: Date } {
  // Generate a cryptographically random 6-digit number
  const otp = (crypto.randomInt(0, 1_000_000)).toString().padStart(6, '0');
  const expiry = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
  return { otp, expiry };
}

