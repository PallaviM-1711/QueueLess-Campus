import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { body, matchedData, param, validationResult } from 'express-validator';
import { authenticate } from '../middleware/authenticate';
import { authorizeSuperAdmin } from '../middleware/authorizeSuperAdmin';
import { createError } from '../middleware/errorHandler';
import { UserRole } from '../types/enums';
import {
  createAdminCanteen,
  listAdminCanteens,
  listAdminStaff,
  updateAdminCanteen,
  updateAdminStaff,
  type CanteenInput,
} from '../services/admin.service';
import { inviteStaffMember, resendStaffInvitation } from '../services/auth.service';
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

function requireFields(fields: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!fields.some((field) => Object.prototype.hasOwnProperty.call(req.body, field))) {
      next(createError('Provide at least one field to update', 400));
      return;
    }
    next();
  };
}

const protectedByUniversityAdmin = [authenticate, authorizeSuperAdmin];
const optionalCanteenFields = [
  body('name').optional().isString().trim().isLength({ min: 2, max: 80 })
    .withMessage('Canteen name must be between 2 and 80 characters'),
  body('description').optional({ values: 'falsy' }).isString().trim().isLength({ max: 300 })
    .withMessage('Description must be at most 300 characters'),
  body('location').optional({ values: 'falsy' }).isString().trim().isLength({ max: 120 })
    .withMessage('Location must be at most 120 characters'),
  body('imageUrl').optional({ values: 'falsy' })
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage('Image URL must be an HTTP or HTTPS URL'),
  body('openingTime').optional().matches(/^([01]\d|2[0-3]):[0-5]\d$/)
    .withMessage('Opening time must use HH:mm format'),
  body('closingTime').optional().matches(/^([01]\d|2[0-3]):[0-5]\d$/)
    .withMessage('Closing time must use HH:mm format'),
  body('isOpen').optional().isBoolean().toBoolean()
    .withMessage('Open status must be a boolean'),
];
router.get(
  '/canteens',
  ...protectedByUniversityAdmin,
  asyncHandler(async (req, res) => {
    const canteens = await listAdminCanteens(req.user!.universityId);
    res.json({ success: true, canteens });
  })
);

router.post(
  '/canteens',
  ...protectedByUniversityAdmin,
  body('name').isString().trim().isLength({ min: 2, max: 80 })
    .withMessage('Canteen name must be between 2 and 80 characters'),
  ...optionalCanteenFields.slice(1),
  validateRequest,
  asyncHandler(async (req, res) => {
    const input = matchedData<CanteenInput>(req, { locations: ['body'] });
    const canteen = await createAdminCanteen(req.user!.universityId, input);
    res.status(201).json({ success: true, canteen });
  })
);

router.patch(
  '/canteens/:canteenId',
  ...protectedByUniversityAdmin,
  param('canteenId').isMongoId().withMessage('Invalid canteen identifier'),
  ...optionalCanteenFields,
  validateRequest,
  requireFields([
    'name',
    'description',
    'location',
    'imageUrl',
    'openingTime',
    'closingTime',
    'isOpen',
  ]),
  asyncHandler(async (req, res) => {
    const input = matchedData<Partial<CanteenInput>>(req, { locations: ['body'] });
    const canteen = await updateAdminCanteen(
      req.user!.universityId,
      routeParam(req, 'canteenId'),
      input
    );
    res.json({ success: true, canteen });
  })
);

router.get(
  '/staff',
  ...protectedByUniversityAdmin,
  asyncHandler(async (req, res) => {
    const staff = await listAdminStaff(req.user!.universityId);
    res.json({ success: true, staff });
  })
);

router.post(
  '/staff',
  ...protectedByUniversityAdmin,
  body('name').isString().trim().isLength({ min: 2, max: 60 })
    .withMessage('Name must be between 2 and 60 characters'),
  body('email').isEmail().normalizeEmail()
    .withMessage('A valid staff email address is required'),
  body('role').isIn([UserRole.STAFF, UserRole.CANTEEN_ADMIN])
    .withMessage('Staff role must be staff or canteen_admin'),
  body('canteenId').isMongoId().withMessage('Invalid canteen identifier'),
  validateRequest,
  asyncHandler(async (req, res) => {
    const input = matchedData<{
      name: string;
      email: string;
      role: UserRole.STAFF | UserRole.CANTEEN_ADMIN;
      canteenId: string;
    }>(req, { locations: ['body'] });
    const result = await inviteStaffMember(req.user!.universityId, input);
    res.status(201).json({ success: true, ...result });
  })
);

router.post(
  '/staff/:staffId/resend-invitation',
  ...protectedByUniversityAdmin,
  param('staffId').isMongoId().withMessage('Invalid staff identifier'),
  validateRequest,
  asyncHandler(async (req, res) => {
    const result = await resendStaffInvitation(
      req.user!.universityId,
      routeParam(req, 'staffId')
    );
    res.json({ success: true, ...result });
  })
);

router.patch(
  '/staff/:staffId',
  ...protectedByUniversityAdmin,
  param('staffId').isMongoId().withMessage('Invalid staff identifier'),
  body('canteenId').optional().isMongoId().withMessage('Invalid canteen identifier'),
  body('isActive').optional().isBoolean().toBoolean()
    .withMessage('Active status must be a boolean'),
  validateRequest,
  requireFields(['canteenId', 'isActive']),
  asyncHandler(async (req, res) => {
    const input = matchedData<{ canteenId?: string; isActive?: boolean }>(
      req,
      { locations: ['body'] }
    );
    const staff = await updateAdminStaff(
      req.user!.universityId,
      routeParam(req, 'staffId'),
      input
    );
    getSocketServer().in(`user:${staff._id.toString()}`).disconnectSockets(true);
    res.json({ success: true, staff });
  })
);

export default router;
