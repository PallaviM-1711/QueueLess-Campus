import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { body, matchedData, param, query, validationResult } from 'express-validator';
import { authenticate, authorize } from '../middleware/authenticate';
import { authorizeCanteenManagement } from '../middleware/canteenAccess';
import { createError } from '../middleware/errorHandler';
import { OrderStatus, UserRole } from '../types/enums';
import {
  listCanteenOrders,
  updateCanteenOrderStatus,
} from '../services/staffOrders.service';
import { getSocketServer } from '../realtime/socket';

const router = Router();

function routeParam(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function asyncHandler(
  handler: (req: Request, res: Response) => Promise<void>
): RequestHandler {
  return (req, res, next) => {
    void handler(req, res).catch(next);
  };
}

function validateRequest(req: Request, _res: Response, next: NextFunction): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    next(createError(errors.array()[0].msg, 400));
    return;
  }
  next();
}

const staffRoles = [UserRole.STAFF, UserRole.CANTEEN_ADMIN, UserRole.SUPER_ADMIN];

router.get(
  '/:canteenId/orders',
  authenticate,
  authorize(...staffRoles),
  param('canteenId').isMongoId().withMessage('Invalid canteen identifier'),
  query('status').optional().isIn(Object.values(OrderStatus))
    .withMessage('Invalid order status'),
  validateRequest,
  authorizeCanteenManagement,
  asyncHandler(async (req, res) => {
    const { status } = matchedData<{ status?: OrderStatus }>(req, { locations: ['query'] });
    const orders = await listCanteenOrders(routeParam(req, 'canteenId'), status);
    res.json({ success: true, orders });
  })
);

router.patch(
  '/:canteenId/orders/:orderId/status',
  authenticate,
  authorize(...staffRoles),
  param('canteenId').isMongoId().withMessage('Invalid canteen identifier'),
  param('orderId').isMongoId().withMessage('Invalid order identifier'),
  body('status').isIn(Object.values(OrderStatus))
    .withMessage('Invalid order status'),
  validateRequest,
  authorizeCanteenManagement,
  asyncHandler(async (req, res) => {
    const { status } = matchedData<{ status: OrderStatus }>(req, { locations: ['body'] });
    const order = await updateCanteenOrderStatus(
      routeParam(req, 'canteenId'),
      routeParam(req, 'orderId'),
      status
    );
    const event = {
      orderId: order._id.toString(),
      status: order.status,
      paymentStatus: order.paymentStatus,
      updatedAt: order.updatedAt,
    };
    getSocketServer()
      .to(`order:${event.orderId}`)
      .to(`user:${order.student._id.toString()}`)
      .to(`canteen:${routeParam(req, 'canteenId')}`)
      .emit('order:changed', event);
    res.json({ success: true, order });
  })
);

export default router;
