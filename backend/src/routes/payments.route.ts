import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { body, matchedData, param, validationResult } from 'express-validator';
import { authenticate, authorize } from '../middleware/authenticate';
import { createError } from '../middleware/errorHandler';
import { UserRole } from '../types/enums';
import { getSocketServer } from '../realtime/socket';
import {
  createRazorpayOrder,
  getRazorpayConfiguration,
  processRazorpayWebhook,
  verifyRazorpayCheckout,
} from '../services/razorpay.service';

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

function emitPaymentUpdate(order: {
  _id: { toString(): string };
  student: { toString(): string };
  canteen: { toString(): string };
  status: string;
  paymentStatus: string;
  updatedAt: Date;
}): void {
  const orderId = order._id.toString();
  getSocketServer()
    .to(`order:${orderId}`)
    .to(`user:${order.student.toString()}`)
    .to(`canteen:${order.canteen.toString()}`)
    .emit('order:changed', {
      orderId,
      status: order.status,
      paymentStatus: order.paymentStatus,
      updatedAt: order.updatedAt,
    });
}

router.get('/razorpay/config', (_req, res) => {
  res.json({ success: true, razorpay: getRazorpayConfiguration() });
});

router.post(
  '/razorpay/orders/:orderId',
  authenticate,
  authorize(UserRole.STUDENT),
  param('orderId').isMongoId().withMessage('Invalid order identifier'),
  validateRequest,
  asyncHandler(async (req, res) => {
    if (!req.user) throw createError('Authentication required', 401);
    const payment = await createRazorpayOrder(
      req.user.userId,
      routeParam(req, 'orderId')
    );
    res.json({ success: true, payment });
  })
);

router.post(
  '/razorpay/verify',
  authenticate,
  authorize(UserRole.STUDENT),
  body('orderId').isMongoId().withMessage('Invalid order identifier'),
  body('razorpayOrderId').isString().isLength({ min: 10, max: 64 })
    .withMessage('Invalid Razorpay order identifier'),
  body('razorpayPaymentId').isString().isLength({ min: 8, max: 64 })
    .withMessage('Invalid Razorpay payment identifier'),
  body('razorpaySignature').isString().isLength({ min: 64, max: 64 })
    .withMessage('Invalid Razorpay signature'),
  validateRequest,
  asyncHandler(async (req, res) => {
    if (!req.user) throw createError('Authentication required', 401);
    const input = matchedData<{
      orderId: string;
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    }>(req, { locations: ['body'] });
    const order = await verifyRazorpayCheckout(req.user.userId, {
      orderId: input.orderId,
      razorpayOrderId: input.razorpayOrderId,
      paymentId: input.razorpayPaymentId,
      signature: input.razorpaySignature,
    });
    emitPaymentUpdate(order);
    res.json({ success: true, order });
  })
);

router.post(
  '/razorpay/webhook',
  asyncHandler(async (req, res) => {
    if (!Buffer.isBuffer(req.body)) {
      throw createError('Webhook requires a raw JSON request body', 400);
    }
    const order = await processRazorpayWebhook(
      req.body,
      req.header('X-Razorpay-Signature')
    );
    if (order) emitPaymentUpdate(order);
    res.json({ success: true });
  })
);

export default router;
