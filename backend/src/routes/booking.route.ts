import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { body, matchedData, param, query, validationResult } from 'express-validator';
import { authenticate, authorize } from '../middleware/authenticate';
import {
  authorizeCanteenManagement,
  authorizeCanteenRead,
} from '../middleware/canteenAccess';
import { createError } from '../middleware/errorHandler';
import { UserRole } from '../types/enums';
import {
  createPickupSlot,
  listAvailableSlots,
  setPickupSlotActive,
  type CreateSlotInput,
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

function isValidDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) &&
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function isNotPastDay(value: string): boolean {
  return value >= new Date().toISOString().slice(0, 10);
}

router.get(
  '/:canteenId/pickup-slots',
  authenticate,
  param('canteenId').isMongoId().withMessage('Invalid canteen identifier'),
  query('date')
    .isString()
    .withMessage('Date is required in YYYY-MM-DD format')
    .bail()
    .custom(isValidDay)
    .withMessage('Date must be a valid YYYY-MM-DD date'),
  validateRequest,
  authorizeCanteenRead,
  asyncHandler(async (req, res) => {
    const date = matchedData<{ date: string }>(req, { locations: ['query'] }).date;
    const slots = await listAvailableSlots(routeParam(req, 'canteenId'), date);
    res.json({ success: true, slots });
  })
);

router.post(
  '/:canteenId/pickup-slots',
  authenticate,
  authorize(UserRole.STAFF, UserRole.CANTEEN_ADMIN, UserRole.SUPER_ADMIN),
  param('canteenId').isMongoId().withMessage('Invalid canteen identifier'),
  body('date')
    .isString()
    .withMessage('Date is required in YYYY-MM-DD format')
    .bail()
    .custom(isValidDay)
    .withMessage('Date must be a valid YYYY-MM-DD date')
    .bail()
    .custom(isNotPastDay)
    .withMessage('Pickup slots cannot be created for a past date'),
  body('startTime')
    .isString()
    .withMessage('Start time is required')
    .bail()
    .custom(isValidTime)
    .withMessage('Start time must use 24-hour HH:mm format'),
  body('endTime')
    .isString()
    .withMessage('End time is required')
    .bail()
    .custom(isValidTime)
    .withMessage('End time must use 24-hour HH:mm format')
    .bail()
    .custom((endTime, { req }) => isValidTime(req.body.startTime) && endTime > req.body.startTime)
    .withMessage('End time must be after start time'),
  body('capacity')
    .isInt({ min: 1, max: 500 })
    .withMessage('Capacity must be between 1 and 500')
    .toInt(),
  validateRequest,
  authorizeCanteenManagement,
  asyncHandler(async (req, res) => {
    const input = matchedData<CreateSlotInput>(req, { locations: ['body'] });
    const slot = await createPickupSlot(routeParam(req, 'canteenId'), input);
    res.status(201).json({ success: true, slot });
  })
);

router.patch(
  '/:canteenId/pickup-slots/:slotId',
  authenticate,
  authorize(UserRole.STAFF, UserRole.CANTEEN_ADMIN, UserRole.SUPER_ADMIN),
  param('canteenId').isMongoId().withMessage('Invalid canteen identifier'),
  param('slotId').isMongoId().withMessage('Invalid pickup-slot identifier'),
  body('isActive').isBoolean().withMessage('isActive must be a boolean').toBoolean(),
  validateRequest,
  authorizeCanteenManagement,
  asyncHandler(async (req, res) => {
    const { isActive } = matchedData<{ isActive: boolean }>(req, { locations: ['body'] });
    const slot = await setPickupSlotActive(
      routeParam(req, 'canteenId'),
      routeParam(req, 'slotId'),
      isActive
    );
    res.json({ success: true, slot });
  })
);

export default router;
