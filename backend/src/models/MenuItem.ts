/**
 * models/MenuItem.ts
 * A food item belonging to a specific canteen.
 * Supports categories, availability toggle and price.
 */

import { Schema, model, Document, Types } from 'mongoose';

export interface IMenuItem extends Document {
  _id: Types.ObjectId;
  canteen: Types.ObjectId;
  name: string;
  description?: string;
  category: string;
  price: number;
  imageUrl?: string;
  isAvailable: boolean;
  isVeg: boolean;
  preparationTimeMinutes: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const menuItemSchema = new Schema<IMenuItem>(
  {
    canteen: {
      type: Schema.Types.ObjectId,
      ref: 'Canteen',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true,
      maxlength: 100,
    },
    description: { type: String, trim: true, maxlength: 300 },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    imageUrl: { type: String, trim: true },
    isAvailable: { type: Boolean, default: true },
    isVeg: { type: Boolean, default: true },
    preparationTimeMinutes: { type: Number, default: 10, min: 1 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

menuItemSchema.set('toJSON', {
  transform(_doc, ret) {
    Reflect.deleteProperty(ret, '__v');
    return ret;
  },
});

menuItemSchema.index({ canteen: 1, isActive: 1, category: 1, name: 1 });

export const MenuItem = model<IMenuItem>('MenuItem', menuItemSchema);
