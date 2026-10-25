/**
 * models/PickupSlot.ts
 * Backend-enforced pickup time slots for a canteen.
 * Capacity limits are checked on booking — no over-booking.
 */

import { Schema, model, Document, Types } from 'mongoose';

export interface IPickupSlot extends Document {
  _id: Types.ObjectId;
  canteen: Types.ObjectId;
  date: Date;       // the calendar date of this slot
  startTime: string; // "12:00"
  endTime: string;   // "12:15"
  capacity: number;  // max orders in this slot
  booked: number;    // current confirmed bookings
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const pickupSlotSchema = new Schema<IPickupSlot>(
  {
    canteen: {
      type: Schema.Types.ObjectId,
      ref: 'Canteen',
      required: true,
      index: true,
    },
    date: { type: Date, required: true },
    startTime: { type: String, required: true }, // "12:00"
    endTime: { type: String, required: true },   // "12:15"
    capacity: { type: Number, required: true, min: 1 },
    booked: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Composite index — one slot definition per canteen+date+startTime
pickupSlotSchema.index({ canteen: 1, date: 1, startTime: 1 }, { unique: true });

pickupSlotSchema.set('toJSON', {
  transform(_doc, ret) {
    Reflect.deleteProperty(ret, '__v');
    return ret;
  },
});

export const PickupSlot = model<IPickupSlot>('PickupSlot', pickupSlotSchema);

