import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { body, matchedData, validationResult } from 'express-validator';
import { authenticate, authorize } from '../middleware/authenticate';
import { createError } from '../middleware/errorHandler';
import { UserRole } from '../types/enums';
import {
  getStudentOrder,
  listStudentOrders,
  placeOrder,
  type PlaceOrderInput,
} from '../services/ordering.service';

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

router.post(
  '/',
  authenticate,
  authorize(UserRole.STUDENT),
  body('canteenId').isMongoId().withMessage('Invalid canteen identifier'),
  body('pickupSlotId').isMongoId().withMessage('Invalid pickup-slot identifier'),
  body('items')
    .isArray({ min: 1, max: 30 })
    .withMessage('An order must contain between 1 and 30 items')
    .bail()
    .custom((items: unknown[]) =>
      items.every(
        (item) =>
          typeof item === 'object' &&
          item !== null &&
          'menuItemId' in item &&
          typeof item.menuItemId === 'string' &&
          /^[a-f\d]{24}$/i.test(item.menuItemId) &&
          'quantity' in item &&
          Number.isInteger(item.quantity) &&
          Number(item.quantity) >= 1 &&
          Number(item.quantity) <= 50
      )
    )
    .withMessage('Each order item requires a valid menu item ID and quantity from 1 to 50'),
  body('notes').optional().isString().trim().isLength({ max: 200 })
    .withMessage('Order notes must be at most 200 characters'),
  validateRequest,
  asyncHandler(async (req, res) => {
    const input = matchedData<PlaceOrderInput>(req, { locations: ['body'] });
    if (!req.user) throw createError('Authentication required', 401);
    const order = await placeOrder(req.user.userId, input);
    res.status(201).json({ success: true, order });
  })
);

router.get(
  '/me',
  authenticate,
  authorize(UserRole.STUDENT),
  asyncHandler(async (req, res) => {
    if (!req.user) throw createError('Authentication required', 401);
    const orders = await listStudentOrders(req.user.userId);
    res.json({ success: true, orders });
  })
);

router.get(
  '/:orderId',
  authenticate,
  authorize(UserRole.STUDENT),
  asyncHandler(async (req, res) => {
    if (!req.user) throw createError('Authentication required', 401);
    const order = await getStudentOrder(req.user.userId, routeParam(req, 'orderId'));
    res.json({ success: true, order });
  })
);

export default router;
