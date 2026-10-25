/**
 * services/auth.service.ts
 * Business logic for registration, login, email verification
 * and fetching the current user profile.
 *
 * Controllers stay thin — all logic lives here.
 */

import { Types } from 'mongoose';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import bcrypt from 'bcryptjs';
import { env } from '../config/env';
import { User, IUser } from '../models/User';
import { University } from '../models/University';
import { Canteen } from '../models/Canteen';
import { UserRole } from '../types/enums';
import { signToken } from '../utils/jwt';
import { generateOtp } from '../utils/otp';
import { sendOtpEmail, sendStaffInvitationEmail } from '../utils/mailer';
import { createError } from '../middleware/errorHandler';

const MAX_OTP_ATTEMPTS = 5;

function hashOtp(otp: string): string {
  return createHmac('sha256', env.JWT_SECRET).update(otp).digest('hex');
}

function matchesOtp(storedHash: string, otp: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(storedHash)) return false;
  const candidateHash = hashOtp(otp);
  return timingSafeEqual(Buffer.from(storedHash, 'hex'), Buffer.from(candidateHash, 'hex'));
}

// ── Register ─────────────────────────────────────────────────────────────────

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface AuthUser {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  university: string;
  canteen?: string;
  isEmailVerified: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function toAuthUser(user: IUser): AuthUser {
  return {
    _id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    university: user.university.toString(),
    ...(user.canteen && { canteen: user.canteen.toString() }),
    isEmailVerified: user.isEmailVerified,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
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

  const normalizedEmail = email.trim().toLowerCase();
  // 2. Check for duplicate email
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    throw createError('An account with this email already exists', 409);
  }

  // 3. Generate OTP
  const { otp, expiry } = generateOtp();

  // 4. Create user (password is hashed by pre-save hook)
  const user = await User.create({
    name,
    email: normalizedEmail,
    password,
    role: UserRole.STUDENT,
    university: university._id,
    isEmailVerified: false,
    emailOtp: hashOtp(otp),
    emailOtpExpiry: expiry,
    emailOtpAttempts: 0,
  });

  // Keep the account so the student can request another code if delivery fails.
  try {
    await sendOtpEmail(normalizedEmail, name, otp);
  } catch {
    console.error('[Auth] Verification email delivery failed');
    throw createError(
      'Your account was created, but the verification email could not be sent. Please try resending the code.',
      503
    );
  }

  return {
    message: `Account created. A 6-digit verification code has been sent to ${normalizedEmail}. Please verify within 10 minutes.`,
  };
}

// ── Verify Email ──────────────────────────────────────────────────────────────

export async function verifyEmail(
  email: string,
  otp: string
): Promise<{ token: string; user: AuthUser }> {
  // Select fields hidden by default
  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({
    email: normalizedEmail,
    role: UserRole.STUDENT,
    isActive: true,
  })
    .select('+emailOtp +emailOtpExpiry +emailOtpAttempts');

  const invalidCode = createError('Invalid or expired verification code', 400);
  if (!user || user.isEmailVerified) throw invalidCode;

  if (
    !user.emailOtp ||
    !user.emailOtpExpiry ||
    user.emailOtpAttempts >= MAX_OTP_ATTEMPTS ||
    new Date() > user.emailOtpExpiry
  ) {
    throw invalidCode;
  }

  if (!matchesOtp(user.emailOtp, otp.trim())) {
    user.emailOtpAttempts += 1;
    if (user.emailOtpAttempts >= MAX_OTP_ATTEMPTS) {
      user.emailOtp = undefined;
      user.emailOtpExpiry = undefined;
    }
    await user.save();
    throw invalidCode;
  }

  // Mark verified and clear OTP
  user.isEmailVerified = true;
  user.emailOtp = undefined;
  user.emailOtpExpiry = undefined;
  user.emailOtpAttempts = 0;
  await user.save();

  const token = signToken(
    user._id as Types.ObjectId,
    user.role,
    user.university as unknown as Types.ObjectId,
    user.canteen
  );

  return { token, user: toAuthUser(user) };
}

// ── Resend OTP ────────────────────────────────────────────────────────────────

export async function resendOtp(email: string): Promise<{ message: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({
    email: normalizedEmail,
    role: UserRole.STUDENT,
    isActive: true,
  })
    .select('+emailOtp +emailOtpExpiry +emailOtpAttempts');
  const genericMessage = 'If the address is registered and unverified, a new code will be sent.';
  if (!user || user.isEmailVerified) return { message: genericMessage };

  const { otp, expiry } = generateOtp();
  user.emailOtp = hashOtp(otp);
  user.emailOtpExpiry = expiry;
  user.emailOtpAttempts = 0;
  await user.save();

  try {
    await sendOtpEmail(normalizedEmail, user.name, otp);
  } catch {
    console.error('[Auth] Verification email delivery failed');
    throw createError('The verification email could not be sent. Please try again later.', 503);
  }

  return { message: genericMessage };
}

export async function acceptStaffInvitation(
  token: string,
  password: string
): Promise<{ message: string }> {
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.findOneAndUpdate(
    {
      staffInviteTokenHash: tokenHash,
      staffInviteExpiry: { $gt: new Date() },
      isEmailVerified: false,
      isActive: true,
      role: { $in: [UserRole.STAFF, UserRole.CANTEEN_ADMIN] },
    },
    {
      $set: { password: passwordHash, isEmailVerified: true, emailOtpAttempts: 0 },
      $unset: {
        staffInviteTokenHash: 1,
        staffInviteExpiry: 1,
        emailOtp: 1,
        emailOtpExpiry: 1,
      },
    },
    { new: true }
  );
  if (!user) throw createError('Invitation link is invalid, expired, or already used', 400);
  return { message: 'Staff account activated. You can now sign in.' };
}

export interface StaffInvitationInput {
  name: string;
  email: string;
  role: UserRole.STAFF | UserRole.CANTEEN_ADMIN;
  canteenId: string;
}

export async function inviteStaffMember(
  universityId: string,
  input: StaffInvitationInput
): Promise<{ message: string }> {
  const university = await University.findOne({ _id: universityId, isActive: true });
  if (!university) throw createError('University is not active', 404);
  const canteen = await Canteen.findOne({
    _id: input.canteenId,
    university: university._id,
    isActive: true,
  });
  if (!canteen) throw createError('Canteen not found in your university', 404);

  const normalizedEmail = input.email.trim().toLowerCase();
  const emailDomain = normalizedEmail.split('@')[1];
  if (emailDomain !== university.emailDomain) {
    throw createError('Staff email must use the university email domain', 400);
  }
  if (await User.exists({ email: normalizedEmail })) {
    throw createError('An account with this email already exists', 409);
  }

  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  let user: IUser;
  try {
    user = await User.create({
      name: input.name,
      email: normalizedEmail,
      password: randomBytes(32).toString('base64url'),
      role: input.role,
      university: university._id,
      canteen: canteen._id,
      isEmailVerified: false,
      isActive: true,
      staffInviteTokenHash: tokenHash,
      staffInviteExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 11000
    ) {
      throw createError('An account with this email already exists', 409);
    }
    throw error;
  }

  try {
    await sendStaffInvitationEmail(
      normalizedEmail,
      user.name,
      input.role === UserRole.STAFF ? 'Canteen staff member' : 'Canteen administrator',
      canteen.name,
      token
    );
  } catch {
    let accountRemoved = false;
    try {
      const deletion = await User.deleteOne({
        _id: user._id,
        staffInviteTokenHash: tokenHash,
      });
      accountRemoved = deletion.deletedCount === 1;
    } catch (cleanupError) {
      console.error('[Admin] Could not clean up failed staff invitation:', cleanupError);
    }
    console.error('[Admin] Staff invitation email delivery failed');
    if (!accountRemoved) {
      throw createError(
        'Invitation email failed and the pending account could not be removed; contact an administrator',
        503
      );
    }
    throw createError('Invitation email could not be sent; no staff account was created', 503);
  }

  return { message: `Invitation sent to ${normalizedEmail}. It expires in 24 hours.` };
}

export async function resendStaffInvitation(
  universityId: string,
  staffId: string
): Promise<{ message: string }> {
  const user = await User.findOne({
    _id: staffId,
    university: universityId,
    isActive: true,
    isEmailVerified: false,
    role: { $in: [UserRole.STAFF, UserRole.CANTEEN_ADMIN] },
  }).select('+staffInviteTokenHash +staffInviteExpiry');
  if (!user) throw createError('Active pending staff invitation not found', 404);
  if (!user.canteen) throw createError('Staff account has no assigned canteen', 409);

  const canteen = await Canteen.findOne({
    _id: user.canteen,
    university: universityId,
    isActive: true,
  });
  if (!canteen) throw createError('Assigned canteen is not active', 409);

  const previousTokenHash = user.staffInviteTokenHash;
  const previousExpiry = user.staffInviteExpiry;
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  user.staffInviteTokenHash = tokenHash;
  user.staffInviteExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save();

  try {
    await sendStaffInvitationEmail(
      user.email,
      user.name,
      user.role === UserRole.STAFF ? 'Canteen staff member' : 'Canteen administrator',
      canteen.name,
      token
    );
  } catch {
    try {
      const rollbackUpdate: {
        $set?: Record<string, string | Date>;
        $unset?: Record<string, number>;
      } = {};
      const previousValues: Record<string, string | Date> = {};
      if (previousTokenHash) previousValues.staffInviteTokenHash = previousTokenHash;
      if (previousExpiry) previousValues.staffInviteExpiry = previousExpiry;
      if (Object.keys(previousValues).length > 0) rollbackUpdate.$set = previousValues;
      const unsetValues: Record<string, number> = {};
      if (!previousTokenHash) unsetValues.staffInviteTokenHash = 1;
      if (!previousExpiry) unsetValues.staffInviteExpiry = 1;
      if (Object.keys(unsetValues).length > 0) rollbackUpdate.$unset = unsetValues;
      const rollback = await User.updateOne(
        { _id: user._id, staffInviteTokenHash: tokenHash },
        rollbackUpdate
      );
      if (rollback.matchedCount !== 1) {
        console.error('[Admin] Previous staff invitation could not be restored after email failure');
      }
    } catch (rollbackError) {
      console.error('[Admin] Could not restore previous staff invitation:', rollbackError);
    }
    console.error('[Admin] Staff invitation email delivery failed');
    throw createError('Invitation email could not be sent; please try again later', 503);
  }

  return { message: `Invitation resent to ${user.email}. It expires in 24 hours.` };
}

// ── Login ─────────────────────────────────────────────────────────────────────

export interface LoginInput {
  email: string;
  password: string;
}

export async function loginUser(
  input: LoginInput
): Promise<{ token: string; user: AuthUser }> {
  const email = input.email.trim().toLowerCase();
  const { password } = input;

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
    user.university as unknown as Types.ObjectId,
    user.canteen
  );

  return { token, user: toAuthUser(user) };
}

// ── Get Me ────────────────────────────────────────────────────────────────────

export async function getMe(userId: string): Promise<IUser> {
  const user = await User.findById(userId).populate('university', 'name emailDomain');
  if (!user) throw createError('User not found', 404);
  if (!user.isActive) throw createError('Your account has been deactivated.', 403);
  return user;
}
