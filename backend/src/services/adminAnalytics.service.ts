import { Types } from 'mongoose';
import { Canteen } from '../models/Canteen';
import { Order } from '../models/Order';
import { createError } from '../middleware/errorHandler';
import { OrderStatus, PaymentStatus } from '../types/enums';

interface AnalyticsRange {
  from: string;
  to: string;
}

interface AnalyticsSummaryRow {
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  unpaidOrders: number;
  revenue: number;
  averagePreparationMilliseconds: number | null;
}

interface CanteenAnalyticsRow {
  _id: Types.ObjectId;
  orders: number;
  revenue: number;
}

interface PopularItemRow {
  name: string;
  unitsOrdered: number;
  orderCount: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDateOnly(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw createError('Analytics dates must use YYYY-MM-DD format', 400);
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (dateOnly(date) !== value) {
    throw createError('Analytics date is invalid', 400);
  }
  return date;
}

function resolveRange(from?: string, to?: string): {
  range: AnalyticsRange;
  start: Date;
  endExclusive: Date;
} {
  if (Boolean(from) !== Boolean(to)) {
    throw createError('Provide both analytics start and end dates', 400);
  }
  const end = to ? parseDateOnly(to) : new Date(Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate()
  ));
  const start = from
    ? parseDateOnly(from)
    : new Date(end.getTime() - 29 * DAY_MS);
  const days = Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1;
  if (days < 1 || days > 366) {
    throw createError('Analytics date range must be between 1 and 366 days', 400);
  }
  return {
    range: { from: dateOnly(start), to: dateOnly(end) },
    start,
    endExclusive: new Date(end.getTime() + DAY_MS),
  };
}

export async function getAdminAnalytics(
  universityId: string,
  input: { from?: string; to?: string }
) {
  if (!Types.ObjectId.isValid(universityId)) {
    throw createError('Invalid university identifier', 400);
  }
  const { range, start, endExclusive } = resolveRange(input.from, input.to);
  const canteens = await Canteen.find({ university: universityId })
    .select('_id name')
    .lean();
  const canteenIds = canteens.map((canteen) => canteen._id);
  const match = {
    canteen: { $in: canteenIds },
    createdAt: { $gte: start, $lt: endExclusive },
  };

  const [summaryRows, canteenRows, popularItems] = await Promise.all([
    Order.aggregate<AnalyticsSummaryRow>([
      { $match: match },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          completedOrders: {
            $sum: { $cond: [{ $eq: ['$status', OrderStatus.PICKED_UP] }, 1, 0] },
          },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ['$status', OrderStatus.CANCELLED] }, 1, 0] },
          },
          unpaidOrders: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$paymentStatus', PaymentStatus.UNPAID] },
                    { $ne: ['$status', OrderStatus.CANCELLED] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          revenue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$status', OrderStatus.CANCELLED] },
                    { $eq: ['$paymentStatus', PaymentStatus.PAID] },
                  ],
                },
                '$totalAmount',
                0,
              ],
            },
          },
          averagePreparationMilliseconds: {
            $avg: {
              $cond: [
                {
                  $and: [
                    { $eq: [{ $type: '$preparationStartedAt' }, 'date'] },
                    { $eq: [{ $type: '$readyAt' }, 'date'] },
                    { $gte: ['$readyAt', '$preparationStartedAt'] },
                    { $ne: ['$status', OrderStatus.CANCELLED] },
                  ],
                },
                { $subtract: ['$readyAt', '$preparationStartedAt'] },
                null,
              ],
            },
          },
        },
      },
    ]),
    Order.aggregate<CanteenAnalyticsRow>([
      { $match: match },
      {
        $group: {
          _id: '$canteen',
          orders: { $sum: 1 },
          revenue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$status', OrderStatus.CANCELLED] },
                    { $eq: ['$paymentStatus', PaymentStatus.PAID] },
                  ],
                },
                '$totalAmount',
                0,
              ],
            },
          },
        },
      },
    ]),
    Order.aggregate<PopularItemRow>([
      { $match: { ...match, status: { $ne: OrderStatus.CANCELLED } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: { name: '$items.name', orderId: '$_id' },
          unitsOrdered: { $sum: '$items.quantity' },
        },
      },
      {
        $group: {
          _id: '$_id.name',
          unitsOrdered: { $sum: '$unitsOrdered' },
          orderCount: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          name: '$_id',
          unitsOrdered: 1,
          orderCount: 1,
        },
      },
      { $sort: { unitsOrdered: -1, orderCount: -1, name: 1 } },
      { $limit: 10 },
    ]),
  ]);

  const summary = summaryRows[0];
  const canteenNames = new Map(canteens.map((canteen) => [
    canteen._id.toString(),
    canteen.name,
  ]));
  const canteenStats = new Map(canteenRows.map((row) => [
    row._id.toString(),
    row,
  ]));

  return {
    range,
    summary: {
      totalOrders: summary?.totalOrders ?? 0,
      completedOrders: summary?.completedOrders ?? 0,
      cancelledOrders: summary?.cancelledOrders ?? 0,
      unpaidOrders: summary?.unpaidOrders ?? 0,
      revenue: Math.round((summary?.revenue ?? 0) * 100) / 100,
      averagePreparationMinutes:
        summary?.averagePreparationMilliseconds == null
          ? null
          : Math.round((summary.averagePreparationMilliseconds / 60_000) * 10) / 10,
    },
    canteens: canteens.map((canteen) => {
      const stats = canteenStats.get(canteen._id.toString());
      return {
        canteenId: canteen._id.toString(),
        name: canteenNames.get(canteen._id.toString()) ?? canteen.name,
        orders: stats?.orders ?? 0,
        revenue: Math.round((stats?.revenue ?? 0) * 100) / 100,
      };
    }).sort((a, b) => b.orders - a.orders || a.name.localeCompare(b.name)),
    popularItems: popularItems.map((item) => ({
      name: item.name,
      unitsOrdered: item.unitsOrdered,
      orderCount: item.orderCount,
    })),
  };
}
