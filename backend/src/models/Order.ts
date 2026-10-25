/**
 * models/Order.ts
 * Full order lifecycle from cart to pickup.
 *
 * pickupToken — a short, unique code printed/shown to the student
 *               and scanned/verified by canteen staff at pickup.
 */

import { Schema, model, Document, Types } from 'mongoose';
import { OrderStatus, PaymentMethod, PaymentStatus } from '../types/enums';

interface IOrderItem {
  menuItem: Types.ObjectId;
  name: string;      // snapshot — keeps history even if item is deleted
  price: number;     // snapshot
  quantity: number;
}

export interface IOrder extends Document {
  _id: Types.ObjectId;
  student: Types.ObjectId;
  canteen: Types.ObjectId;
  items: IOrderItem[];
  totalAmount: number;
  pickupSlot: Types.ObjectId;
  pickupToken: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  /** Razorpay fields — populated only for online payments */
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new Schema<IOrderItem>(
  {
    menuItem: { type: Schema.Types.ObjectId, ref: 'MenuItem', required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    canteen: {
      type: Schema.Types.ObjectId,
      ref: 'Canteen',
      required: true,
      index: true,
    },
    items: { type: [orderItemSchema], required: true },
    totalAmount: { type: Number, required: true, min: 0 },
    pickupSlot: {
      type: Schema.Types.ObjectId,
      ref: 'PickupSlot',
      required: true,
    },
    pickupToken: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
    },
    status: {
      type: String,
      enum: Object.values(OrderStatus),
      default: OrderStatus.PENDING,
    },
    paymentMethod: {
      type: String,
      enum: Object.values(PaymentMethod),
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.UNPAID,
    },
    razorpayOrderId: { type: String, select: false },
    razorpayPaymentId: { type: String, select: false },
    razorpaySignature: { type: String, select: false },
    notes: { type: String, maxlength: 200 },
  },
  { timestamps: true }
);

orderSchema.set('toJSON', {
  transform(_doc, ret) {
    Reflect.deleteProperty(ret, '__v');
    Reflect.deleteProperty(ret, 'razorpaySignature');
    return ret;
  },
});

export const Order = model<IOrder>('Order', orderSchema);
