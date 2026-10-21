/**
 * services/auth.service.ts
 * Business logic for registration, login, email verification
 * and fetching the current user profile.
 *
 * Controllers stay thin — all logic lives here.
 */

import { Types } from 'mongoose';
import { User, IUser } from '../models/User';
import { University } from '../models/University';
import { UserRole } from '../types/enums';
import { signToken } from '../utils/jwt';
import { generateOtp } from '../utils/otp';
import { sendOtpEmail } from '../utils/mailer';
import { createError } from '../middleware/errorHandler';

// ── Register ─────────────────────────────────────────────────────────────────

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export async function registerStudent(input: RegisterInput): Promise<{ message: string }> {
  const { name, email, password } = input;

  // 1. Derive the email domain and find a matching university
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) throw createError('Invalid email address', 400);

  const university = await University.findOne({ emailDomain: domain, isActive: true });
  if (!university) {
    throw createError(
      `No registered university found for email domain "@${domain}". ` +
      'Please use your college email address.',
      400
    );
  }

  // 2. Check for duplicate email
  const existing = await User.findOne({ email });
  if (existing) {
    throw createError('An account with this email already exists', 409);
  }

  // 3. Generate OTP
  const { otp, expiry } = generateOtp();

  // 4. Create user (password is hashed by pre-save hook)
  const user = await User.create({
    name,
    email,
    password,
    role: UserRole.STUDENT,
    university: university._id,
    isEmailVerified: false,
    emailOtp: otp,
    emailOtpExpiry: expiry,
  });

  // 5. Send verification email (non-blocking — don't fail registration if mail fails)
  try {
    await sendOtpEmail(email, name, otp);
  } catch (mailErr) {
    console.error('[Auth] Failed to send OTP email:', (mailErr as Error).message);
  }

  return {
    message: `Account created. A 6-digit verification code has been sent to ${email}. Please verify within 10 minutes.`,
  };
}

// ── Verify Email ──────────────────────────────────────────────────────────────

export async function verifyEmail(
  email: string,
  otp: string
): Promise<{ token: string; user: Partial<IUser> }> {
  // Select fields hidden by default
  const user = await User.findOne({ email })
    .select('+emailOtp +emailOtpExpiry');

  if (!user) throw createError('User not found', 404);
  if (user.isEmailVerified) throw createError('Email is already verified', 400);

  if (!user.emailOtp || !user.emailOtpExpiry) {
    throw createError('No verification code found — please request a new one', 400);
  }

  if (new Date() > user.emailOtpExpiry) {
    throw createError('Verification code has expired — please request a new one', 400);
  }

  if (user.emailOtp !== otp.trim()) {
    throw createError('Invalid verification code', 400);
  }

  // Mark verified and clear OTP
  user.isEmailVerified = true;
  user.emailOtp = undefined;
  user.emailOtpExpiry = undefined;
  await user.save();

  const token = signToken(
    user._id as Types.ObjectId,
    user.role,
    user.university as unknown as Types.ObjectId
  );

  return { token, user: user.toJSON() };
}

// ── Resend OTP ────────────────────────────────────────────────────────────────

export async function resendOtp(email: string): Promise<{ message: string }> {
  const user = await User.findOne({ email }).select('+emailOtp +emailOtpExpiry');
  if (!user) throw createError('User not found', 404);
  if (user.isEmailVerified) throw createError('Email is already verified', 400);

  const { otp, expiry } = generateOtp();
  user.emailOtp = otp;
  user.emailOtpExpiry = expiry;
  await user.save();

  try {
    await sendOtpEmail(email, user.name, otp);
  } catch (mailErr) {
    console.error('[Auth] Failed to resend OTP:', (mailErr as Error).message);
  }

  return { message: 'A new verification code has been sent to your email.' };
}

// ── Login ─────────────────────────────────────────────────────────────────────

export interface LoginInput {
  email: string;
  password: string;
}

export async function loginUser(
  input: LoginInput
): Promise<{ token: string; user: Partial<IUser> }> {
  const { email, password } = input;

  // select password explicitly (it's select:false)
  const user = await User.findOne({ email }).select('+password');

  // Generic message to prevent user enumeration
  const authError = createError('Invalid email or password', 401);

  if (!user) throw authError;
  if (!user.isActive) throw createError('Your account has been deactivated. Contact support.', 403);

  const passwordMatch = await user.comparePassword(password);
  if (!passwordMatch) throw authError;

  if (!user.isEmailVerified) {
    throw createError('Please verify your email before logging in.', 403);
  }

  const token = signToken(
    user._id as Types.ObjectId,
    user.role,
    user.university as unknown as Types.ObjectId
  );

  return { token, user: user.toJSON() };
}

// ── Get Me ────────────────────────────────────────────────────────────────────

export async function getMe(userId: string): Promise<IUser> {
  const user = await User.findById(userId).populate('university', 'name emailDomain');
  if (!user) throw createError('User not found', 404);
  return user;
}

