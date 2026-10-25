/**
 * models/User.ts
 * Covers all roles: student, staff, canteen_admin, super_admin.
 *
 * Security decisions:
 *  - Password is never returned in queries (select: false)
 *  - Verification code data is never returned in queries (select: false)
 *  - Verification codes are hashed before storage
 */

import { Schema, model, Document, Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { UserRole } from '../types/enums';

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  university: Types.ObjectId;
  /** For staff/canteen_admin — which canteen they manage */
  canteen?: Types.ObjectId;
  isEmailVerified: boolean;
  emailOtp?: string;
  emailOtpExpiry?: Date;
  emailOtpAttempts: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  /** Instance method — compare raw password against stored hash */
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [60, 'Name must be at most 60 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // never returned in queries by default
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.STUDENT,
    },
    university: {
      type: Schema.Types.ObjectId,
      ref: 'University',
      required: [true, 'University is required'],
    },
    canteen: {
      type: Schema.Types.ObjectId,
      ref: 'Canteen',
      default: null,
    },
    isEmailVerified: { type: Boolean, default: false },
    emailOtp: { type: String, select: false },
    emailOtpExpiry: { type: Date, select: false },
    emailOtpAttempts: { type: Number, default: 0, select: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// ── Hash password before saving ───────────────────────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ── Instance method: compare passwords ───────────────────────────────────────
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// ── Hide sensitive fields in JSON output ──────────────────────────────────────
userSchema.set('toJSON', {
  transform(_doc, ret) {
    Reflect.deleteProperty(ret, 'password');
    Reflect.deleteProperty(ret, 'emailOtp');
    Reflect.deleteProperty(ret, 'emailOtpExpiry');
    Reflect.deleteProperty(ret, '__v');
    return ret;
  },
});

export const User = model<IUser>('User', userSchema);
