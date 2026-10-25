import mongoose, { Types } from 'mongoose';
import { Order } from '../models/Order';
import { PickupSlot } from '../models/PickupSlot';
import { OrderStatus, PaymentStatus } from '../types/enums';
import { createError } from '../middleware/errorHandler';

const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.READY],
  [OrderStatus.READY]: [OrderStatus.PICKED_UP],
  [OrderStatus.PICKED_UP]: [],
  [OrderStatus.CANCELLED]: [],
};

export async function listCanteenOrders(canteenId: string, status?: OrderStatus) {
  if (!Types.ObjectId.isValid(canteenId)) throw createError('Invalid canteen identifier', 400);
  return Order.find({
    canteen: canteenId,
    ...(status && { status }),
  })
    .populate('student', 'name')
    .populate('pickupSlot', 'date startTime endTime')
    .sort({ createdAt: 1 })
    .limit(200);
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
  try {
    await session.withTransaction(async () => {
      const order = await Order.findOne({ _id: orderId, canteen: canteenId }).session(session);
      if (!order) throw createError('Order not found', 404);
      if (!allowedTransitions[order.status].includes(nextStatus)) {
        throw createError(`Cannot change order from ${order.status} to ${nextStatus}`, 409);
      }

      const updated = await Order.findOneAndUpdate(
        { _id: orderId, canteen: canteenId, status: order.status },
        {
          $set: {
            status: nextStatus,
            ...(nextStatus === OrderStatus.PICKED_UP && {
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
