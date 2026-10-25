import mongoose, { Types } from 'mongoose';
import { Canteen } from '../models/Canteen';
import { MenuItem } from '../models/MenuItem';
import { Order } from '../models/Order';
import { PickupSlot } from '../models/PickupSlot';
import { User } from '../models/User';
import { PaymentMethod, PaymentStatus, OrderStatus } from '../types/enums';
import { createError } from '../middleware/errorHandler';
import { generatePickupToken } from '../utils/token';

export interface CreateSlotInput {
  date: string;
  startTime: string;
  endTime: string;
  capacity: number;
}

export interface PlaceOrderInput {
  canteenId: string;
  pickupSlotId: string;
  items: Array<{ menuItemId: string; quantity: number }>;
  paymentMethod?: PaymentMethod;
  notes?: string;
}

function utcDateForDay(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

function isFuturePickup(date: Date, endTime: string): boolean {
  const day = date.toISOString().slice(0, 10);
  return new Date(`${day}T${endTime}:00.000Z`).getTime() > Date.now();
}

export async function listAvailableSlots(canteenId: string, day: string) {
  if (!Types.ObjectId.isValid(canteenId)) throw createError('Invalid canteen identifier', 400);
  const date = utcDateForDay(day);
  const slots = await PickupSlot.find({
    canteen: canteenId,
    date,
    isActive: true,
    $expr: { $lt: ['$booked', '$capacity'] },
  })
    .select('date startTime endTime capacity booked')
    .sort({ startTime: 1 })
    .lean();
  return slots.filter((slot) => isFuturePickup(slot.date, slot.endTime));
}

export async function createPickupSlot(
  canteenId: string,
  input: CreateSlotInput
) {
  if (!Types.ObjectId.isValid(canteenId)) throw createError('Invalid canteen identifier', 400);
  return PickupSlot.create({
    canteen: canteenId,
    date: utcDateForDay(input.date),
    startTime: input.startTime,
    endTime: input.endTime,
    capacity: input.capacity,
  });
}

export async function setPickupSlotActive(
  canteenId: string,
  slotId: string,
  isActive: boolean
) {
  if (!Types.ObjectId.isValid(slotId)) throw createError('Invalid pickup-slot identifier', 400);
  const slot = await PickupSlot.findOneAndUpdate(
    { _id: slotId, canteen: canteenId },
    { $set: { isActive } },
    { new: true, runValidators: true }
  );
  if (!slot) throw createError('Pickup slot not found', 404);
  return slot;
}

export async function placeOrder(studentId: string, input: PlaceOrderInput) {
  if (!Types.ObjectId.isValid(input.canteenId) || !Types.ObjectId.isValid(input.pickupSlotId)) {
    throw createError('Invalid canteen or pickup-slot identifier', 400);
  }

  const requested = new Map<string, number>();
  for (const item of input.items) {
    if (!Types.ObjectId.isValid(item.menuItemId)) {
      throw createError('Invalid menu item identifier', 400);
    }
    requested.set(item.menuItemId, (requested.get(item.menuItemId) ?? 0) + item.quantity);
  }
  if (requested.size === 0 || requested.size > 30) {
    throw createError('An order must contain between 1 and 30 unique menu items', 400);
  }
  for (const quantity of requested.values()) {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
      throw createError('Item quantities must be between 1 and 50', 400);
    }
  }

  const session = await mongoose.startSession();
  let createdOrder: InstanceType<typeof Order> | undefined;
  try {
    await session.withTransaction(async () => {
      const student = await User.findById(studentId)
        .select('isActive isEmailVerified role university')
        .session(session);
      const canteen = await Canteen.findOne({
        _id: input.canteenId,
        isActive: true,
      }).select('university isOpen').session(session);
      const slot = await PickupSlot.findOne({
        _id: input.pickupSlotId,
        canteen: input.canteenId,
        isActive: true,
        $expr: { $lt: ['$booked', '$capacity'] },
      }).session(session);
      const menuItems = await MenuItem.find({
        _id: { $in: [...requested.keys()] },
        canteen: input.canteenId,
        isActive: true,
        isAvailable: true,
      }).session(session);

      if (!student || !student.isActive || !student.isEmailVerified) {
        throw createError('Your account is not active', 403);
      }
      if (student.role !== 'student') throw createError('Student access is required', 403);
      if (!canteen) throw createError('Canteen not found', 404);
      if (!canteen.isOpen) throw createError('This canteen is currently closed', 409);
      if (student.university.toString() !== canteen.university.toString()) {
        throw createError('This canteen is outside your university', 403);
      }
      if (!slot || !isFuturePickup(slot.date, slot.endTime)) {
        throw createError('This pickup slot is no longer available', 409);
      }
      if (menuItems.length !== requested.size) {
        throw createError('One or more menu items are unavailable', 409);
      }

      const items = menuItems.map((menuItem) => {
        const quantity = requested.get(menuItem._id.toString());
        if (!quantity) throw createError('Invalid order item quantity', 400);
        return {
          menuItem: menuItem._id,
          name: menuItem.name,
          price: Math.round(menuItem.price * 100) / 100,
          quantity,
        };
      });
      const totalAmount =
        Math.round(items.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100) /
        100;
      const paymentMethod = input.paymentMethod ?? PaymentMethod.PAY_AT_PICKUP;
      if (paymentMethod === PaymentMethod.RAZORPAY && totalAmount < 1) {
        throw createError('Online payments require an order total of at least ₹1.00', 400);
      }

      const reservedSlot = await PickupSlot.findOneAndUpdate(
        {
          _id: slot._id,
          canteen: input.canteenId,
          isActive: true,
          $expr: { $lt: ['$booked', '$capacity'] },
        },
        { $inc: { booked: 1 } },
        { new: true, session }
      );
      if (!reservedSlot) throw createError('This pickup slot is full', 409);

      const [order] = await Order.create(
        [
          {
            student: student._id,
            canteen: canteen._id,
            items,
            totalAmount,
            pickupSlot: slot._id,
            pickupToken: generatePickupToken(),
            status: OrderStatus.PENDING,
            paymentMethod,
            paymentStatus: PaymentStatus.UNPAID,
            notes: input.notes,
          },
        ],
        { session }
      );
      createdOrder = order;
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('Transaction numbers are only allowed')
    ) {
      throw createError(
        'Order placement requires a MongoDB replica set. Use MongoDB Atlas or a local replica set.',
        503
      );
    }
    throw error;
  } finally {
    await session.endSession();
  }

  if (!createdOrder) throw new Error('Order transaction completed without creating an order');
  return Order.findById(createdOrder._id)
    .populate('canteen', 'name location')
    .populate('pickupSlot', 'date startTime endTime')
    .orFail();
}

export async function listStudentOrders(studentId: string) {
  const student = await User.findById(studentId).select('isActive isEmailVerified role');
  if (!student || !student.isActive || !student.isEmailVerified || student.role !== 'student') {
    throw createError('Student access is required', 403);
  }
  return Order.find({ student: studentId })
    .populate('canteen', 'name location')
    .populate('pickupSlot', 'date startTime endTime')
    .sort({ createdAt: -1 })
    .limit(100);
}

export async function getStudentOrder(studentId: string, orderId: string) {
  if (!Types.ObjectId.isValid(orderId)) throw createError('Invalid order identifier', 400);
  const student = await User.findById(studentId).select('isActive isEmailVerified role');
  if (!student || !student.isActive || !student.isEmailVerified || student.role !== 'student') {
    throw createError('Student access is required', 403);
  }
  const order = await Order.findOne({ _id: orderId, student: studentId })
    .populate('canteen', 'name location')
    .populate('pickupSlot', 'date startTime endTime');
  if (!order) throw createError('Order not found', 404);
  return order;
}
