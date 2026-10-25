import mongoose, { Types } from 'mongoose';
import { Order } from '../models/Order';
import { PickupSlot } from '../models/PickupSlot';
import { OrderStatus, PaymentMethod, PaymentStatus } from '../types/enums';
import { createError } from '../middleware/errorHandler';

const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.READY],
  [OrderStatus.READY]: [OrderStatus.PICKED_UP],
  [OrderStatus.PICKED_UP]: [],
  [OrderStatus.CANCELLED]: [],
};

interface CanteenOrderRecord {
  _id: string;
  student: { _id: string; name: string } | null;
  items: Array<{ menuItem: string; name: string; price: number; quantity: number }>;
  totalAmount: number;
  pickupSlot: { _id: string; date: Date; startTime: string; endTime: string } | null;
  pickupToken: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentAttemptExists: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function listCanteenOrders(
  canteenId: string,
  status?: OrderStatus
): Promise<CanteenOrderRecord[]> {
  if (!Types.ObjectId.isValid(canteenId)) throw createError('Invalid canteen identifier', 400);
  const orders = await Order.find({
    canteen: canteenId,
    ...(status && { status }),
  })
    .select('+razorpayOrderId')
    .populate<{ student: { _id: Types.ObjectId; name: string } | null }>('student', 'name')
    .populate<{
      pickupSlot: {
        _id: Types.ObjectId;
        date: Date;
        startTime: string;
        endTime: string;
      } | null;
    }>('pickupSlot', 'date startTime endTime')
    .sort({ createdAt: 1 })
    .limit(200);
  return orders.map((order): CanteenOrderRecord => ({
    _id: order._id.toString(),
    student: order.student
      ? { _id: order.student._id.toString(), name: order.student.name }
      : null,
    items: order.items.map((item) => ({
      menuItem: item.menuItem.toString(),
      name: item.name,
      price: item.price,
      quantity: item.quantity,
    })),
    totalAmount: order.totalAmount,
    pickupSlot: order.pickupSlot
      ? {
          _id: order.pickupSlot._id.toString(),
          date: order.pickupSlot.date,
          startTime: order.pickupSlot.startTime,
          endTime: order.pickupSlot.endTime,
        }
      : null,
    pickupToken: order.pickupToken,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    paymentAttemptExists: Boolean(order.razorpayOrderId),
    notes: order.notes,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  }));
}

export async function updateCanteenOrderStatus(
  canteenId: string,
  orderId: string,
  nextStatus: OrderStatus
) {
  if (!Types.ObjectId.isValid(canteenId) || !Types.ObjectId.isValid(orderId)) {
    throw createError('Invalid canteen or order identifier', 400);
  }

  const session = await mongoose.startSession();
  let updatedOrder: InstanceType<typeof Order> | undefined;
  const transitionAt = new Date();
  try {
    await session.withTransaction(async () => {
      const order = await Order.findOne({ _id: orderId, canteen: canteenId })
        .select('+razorpayOrderId')
        .session(session);
      if (!order) throw createError('Order not found', 404);
      if (!allowedTransitions[order.status].includes(nextStatus)) {
        throw createError(`Cannot change order from ${order.status} to ${nextStatus}`, 409);
      }
      if (nextStatus === OrderStatus.CANCELLED && order.paymentStatus === PaymentStatus.PAID) {
        throw createError('Paid orders cannot be cancelled without a refund', 409);
      }
      if (
        nextStatus === OrderStatus.CANCELLED &&
        order.paymentMethod === PaymentMethod.RAZORPAY &&
        order.razorpayOrderId
      ) {
        throw createError(
          'This order has an active Razorpay payment order and cannot be cancelled safely',
          409
        );
      }
      if (
        order.paymentMethod === PaymentMethod.RAZORPAY &&
        nextStatus !== OrderStatus.CANCELLED &&
        order.paymentStatus !== PaymentStatus.PAID
      ) {
        throw createError('Razorpay payment must be confirmed before preparation', 409);
      }

      const updated = await Order.findOneAndUpdate(
        { _id: orderId, canteen: canteenId, status: order.status },
        {
          $set: {
            status: nextStatus,
            ...(nextStatus === OrderStatus.PREPARING && {
              preparationStartedAt: transitionAt,
            }),
            ...(nextStatus === OrderStatus.READY && { readyAt: transitionAt }),
            ...(nextStatus === OrderStatus.PICKED_UP &&
              order.paymentMethod === PaymentMethod.PAY_AT_PICKUP && {
              paymentStatus: PaymentStatus.PAID,
            }),
          },
        },
        { new: true, session }
      );
      if (!updated) throw createError('Order status changed concurrently; refresh and retry', 409);

      if (nextStatus === OrderStatus.CANCELLED) {
        const slotUpdate = await PickupSlot.updateOne(
          { _id: order.pickupSlot, canteen: canteenId, booked: { $gt: 0 } },
          { $inc: { booked: -1 } },
          { session }
        );
        if (slotUpdate.matchedCount !== 1) {
          throw new Error('Could not release pickup-slot reservation for cancelled order');
        }
      }
      updatedOrder = updated;
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('Transaction numbers are only allowed')
    ) {
      throw createError(
        'Order updates require a MongoDB replica set. Use MongoDB Atlas or a local replica set.',
        503
      );
    }
    throw error;
  } finally {
    await session.endSession();
  }

  if (!updatedOrder) throw new Error('Order transaction completed without updating an order');
  return Order.findById(updatedOrder._id)
    .populate('student', 'name')
    .populate('pickupSlot', 'date startTime endTime')
    .orFail();
}

export async function markOrderPickedUpByToken(canteenId: string, pickupToken: string) {
  if (!Types.ObjectId.isValid(canteenId)) {
    throw createError('Invalid canteen identifier', 400);
  }
  const order = await Order.findOne({
    canteen: canteenId,
    pickupToken: pickupToken.toUpperCase(),
  }).select('_id');
  if (!order) throw createError('Pickup token was not found for this canteen', 404);
  return updateCanteenOrderStatus(canteenId, order._id.toString(), OrderStatus.PICKED_UP);
}
