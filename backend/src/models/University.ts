/**
 * models/University.ts
 * Top-level university record.
 * A university owns multiple canteens.
 * Super-admins are scoped to a university.
 */

import { Schema, model, Document } from 'mongoose';

export interface IUniversity extends Document {
  name: string;
  /** e.g. "vit.ac.in" — used to validate student email domains */
  emailDomain: string;
  address?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const universitySchema = new Schema<IUniversity>(
  {
    name: {
      type: String,
      required: [true, 'University name is required'],
      trim: true,
      unique: true,
    },
    emailDomain: {
      type: String,
      required: [true, 'Email domain is required'],
      trim: true,
      lowercase: true,
      /** e.g. "vit.ac.in" */
      match: [/^[a-z0-9.-]+\.[a-z]{2,}$/, 'Invalid email domain format'],
    },
    address: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const University = model<IUniversity>('University', universitySchema);

