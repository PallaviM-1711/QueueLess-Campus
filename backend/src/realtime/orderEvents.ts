import { Types } from 'mongoose';
import { Server, Socket } from 'socket.io';
import { verifyToken, JwtPayload } from '../utils/jwt';
import { User } from '../models/User';
import { Order } from '../models/Order';
import { Canteen } from '../models/Canteen';
import { UserRole } from '../types/enums';
import { setSocketServer } from './socket';

type SocketUser = JwtPayload;

declare module 'socket.io' {
  interface SocketData {
    orderUser?: SocketUser;
  }
}

interface JoinResult {
  success: boolean;
  message?: string;
}

type Ack = (result: JoinResult) => void;

function respond(ack: unknown, result: JoinResult): void {
  if (typeof ack === 'function') (ack as Ack)(result);
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && Types.ObjectId.isValid(value);
}

async function canManageCanteen(user: SocketUser, canteenId: string): Promise<boolean> {
  const canteen = await Canteen.findOne({
    _id: canteenId,
    university: user.universityId,
    isActive: true,
  }).select('university');
  if (!canteen) return false;
  if (user.role === UserRole.SUPER_ADMIN) return true;
  return (
    (user.role === UserRole.STAFF || user.role === UserRole.CANTEEN_ADMIN) &&
    user.canteenId === canteen._id.toString()
  );
}

export function configureOrderSocket(io: Server): void {
  setSocketServer(io);

  io.use((socket, next) => {
    const rawToken: unknown = socket.handshake.auth?.token;
    if (typeof rawToken !== 'string' || !rawToken.trim()) {
      next(new Error('Authentication required'));
      return;
    }

    try {
      const payload = verifyToken(rawToken.replace(/^Bearer\s+/i, '').trim());
      void User.findById(payload.userId)
        .select('role university canteen isActive isEmailVerified')
        .then((user) => {
          if (
            !user ||
            !user.isActive ||
            !user.isEmailVerified ||
            user.role !== payload.role ||
            user.university.toString() !== payload.universityId ||
            (user.canteen?.toString() ?? undefined) !== payload.canteenId
          ) {
            next(new Error('Authentication is no longer valid'));
            return;
          }
          socket.data.orderUser = payload;
          next();
        })
        .catch((error: unknown) => {
          console.error('[Socket] Failed to validate connection identity:', error);
          next(new Error('Unable to authenticate connection'));
        });
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.orderUser;
    if (!user) {
      socket.disconnect(true);
      return;
    }
    void socket.join(`user:${user.userId}`);

    socket.on('order:subscribe', (input: unknown, ack?: unknown) => {
      void (async () => {
        const orderId =
          typeof input === 'object' && input !== null && 'orderId' in input
            ? input.orderId
            : undefined;
        if (!validId(orderId)) {
          respond(ack, { success: false, message: 'Invalid order identifier' });
          return;
        }
        const order = await Order.findById(orderId).select('student canteen');
        if (!order) {
          respond(ack, { success: false, message: 'Order not found' });
          return;
        }
        const isOwner = order.student.toString() === user.userId;
        const isManager = await canManageCanteen(user, order.canteen.toString());
        if (!isOwner && !isManager) {
          respond(ack, { success: false, message: 'Access denied' });
          return;
        }
        await socket.join(`order:${orderId}`);
        respond(ack, { success: true });
      })().catch((error: unknown) => {
        console.error('[Socket] Failed to authorize order subscription:', error);
        respond(ack, { success: false, message: 'Could not subscribe to order' });
      });
    });

    socket.on('canteen:subscribe', (input: unknown, ack?: unknown) => {
      void (async () => {
        const canteenId =
          typeof input === 'object' && input !== null && 'canteenId' in input
            ? input.canteenId
            : undefined;
        if (!validId(canteenId) || !(await canManageCanteen(user, canteenId))) {
          respond(ack, { success: false, message: 'Access denied' });
          return;
        }
        await socket.join(`canteen:${canteenId}`);
        respond(ack, { success: true });
      })().catch((error: unknown) => {
        console.error('[Socket] Failed to authorize canteen subscription:', error);
        respond(ack, { success: false, message: 'Could not subscribe to canteen' });
      });
    });
  });
}
