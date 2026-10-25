/**
 * models/Canteen.ts
 * Represents one physical canteen within a university.
 * Managed by one or more users with role canteen_admin/staff.
 */

import { Schema, model, Document, Types } from 'mongoose';

export interface ICanteen extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  university: Types.ObjectId;
  location?: string;
  imageUrl?: string;
  isOpen: boolean;
  openingTime: string; // "08:00"
  closingTime: string; // "20:00"
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const canteenSchema = new Schema<ICanteen>(
  {
    name: {
      type: String,
      required: [true, 'Canteen name is required'],
      trim: true,
      maxlength: [80, 'Name must be at most 80 characters'],
    },
    description: { type: String, trim: true, maxlength: 300 },
    university: {
      type: Schema.Types.ObjectId,
      ref: 'University',
      required: true,
    },
    location: { type: String, trim: true },
    imageUrl: { type: String, trim: true },
    isOpen: { type: Boolean, default: false },
    openingTime: { type: String, default: '08:00' },
    closingTime: { type: String, default: '20:00' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

canteenSchema.set('toJSON', {
  transform(_doc, ret) {
    Reflect.deleteProperty(ret, '__v');
    return ret;
  },
});

export const Canteen = model<ICanteen>('Canteen', canteenSchema);
