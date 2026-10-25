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
  createMenuItem,
  deactivateMenuItem,
  getMenu,
  listCanteensForUser,
  updateMenuItem,
  type MenuItemInput,
  type MenuFilters,
} from '../services/menu.service';

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

const itemFields = [
  body('name').optional().isString().trim().isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  body('description').optional().isString().trim().isLength({ max: 300 })
    .withMessage('Description must be at most 300 characters'),
  body('category').optional().isString().trim().isLength({ min: 1, max: 50 })
    .withMessage('Category must be between 1 and 50 characters'),
  body('price').optional().isFloat({ min: 0, max: 100000 })
    .withMessage('Price must be between 0 and 100000'),
  body('imageUrl').optional({ values: 'falsy' }).isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage('Image URL must be an HTTP or HTTPS URL'),
  body('isAvailable').optional().isBoolean().withMessage('Availability must be a boolean'),
  body('isVeg').optional().isBoolean().withMessage('Vegetarian flag must be a boolean'),
  body('preparationTimeMinutes').optional().isInt({ min: 1, max: 240 })
    .withMessage('Preparation time must be between 1 and 240 minutes'),
];

function requireFields(fields: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!fields.some((field) => Object.prototype.hasOwnProperty.call(req.body, field))) {
      next(createError('Provide at least one menu item field to update', 400));
      return;
    }
    next();
  };
}

router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const canteens = await listCanteensForUser(
      req.user!.userId,
      req.user!.universityId
    );
    res.json({ success: true, canteens });
  })
);

router.get(
  '/:canteenId/menu',
  authenticate,
  param('canteenId').isMongoId().withMessage('Invalid canteen identifier'),
  query('search').optional().isString().trim().isLength({ max: 80 })
    .withMessage('Search must be at most 80 characters'),
  query('category').optional().isString().trim().isLength({ max: 50 })
    .withMessage('Category must be at most 50 characters'),
  query('isVeg').optional().isIn(['true', 'false']).withMessage('isVeg must be true or false'),
  validateRequest,
  authorizeCanteenRead,
  asyncHandler(async (req, res) => {
    const filters = matchedData<MenuFilters & { isVeg?: string }>(req, { locations: ['query'] });
    const result = await getMenu(routeParam(req, 'canteenId'), {
      search: filters.search,
      category: filters.category,
      ...(filters.isVeg !== undefined && { isVeg: filters.isVeg === 'true' }),
    });
    res.json({ success: true, ...result });
  })
);

router.post(
  '/:canteenId/menu',
  authenticate,
  authorize(UserRole.STAFF, UserRole.CANTEEN_ADMIN, UserRole.SUPER_ADMIN),
  param('canteenId').isMongoId().withMessage('Invalid canteen identifier'),
  ...itemFields.map((validator) => validator.optional({ checkFalsy: false })),
  body('name').exists().withMessage('Name is required'),
  body('category').exists().withMessage('Category is required'),
  body('price').exists().withMessage('Price is required'),
  validateRequest,
  authorizeCanteenManagement,
  asyncHandler(async (req, res) => {
    const input = matchedData<MenuItemInput>(req, { locations: ['body'] });
    const item = await createMenuItem(routeParam(req, 'canteenId'), input);
    res.status(201).json({ success: true, item });
  })
);

router.patch(
  '/:canteenId/menu/:itemId',
  authenticate,
  authorize(UserRole.STAFF, UserRole.CANTEEN_ADMIN, UserRole.SUPER_ADMIN),
  param('canteenId').isMongoId().withMessage('Invalid canteen identifier'),
  param('itemId').isMongoId().withMessage('Invalid menu item identifier'),
  ...itemFields,
  validateRequest,
  requireFields(['name', 'description', 'category', 'price', 'imageUrl', 'isAvailable', 'isVeg', 'preparationTimeMinutes']),
  authorizeCanteenManagement,
  asyncHandler(async (req, res) => {
    const input = matchedData<Partial<MenuItemInput>>(req, { locations: ['body'] });
    const item = await updateMenuItem(
      routeParam(req, 'canteenId'),
      routeParam(req, 'itemId'),
      input
    );
    res.json({ success: true, item });
  })
);

router.delete(
  '/:canteenId/menu/:itemId',
  authenticate,
  authorize(UserRole.STAFF, UserRole.CANTEEN_ADMIN, UserRole.SUPER_ADMIN),
  param('canteenId').isMongoId().withMessage('Invalid canteen identifier'),
  param('itemId').isMongoId().withMessage('Invalid menu item identifier'),
  validateRequest,
  authorizeCanteenManagement,
  asyncHandler(async (req, res) => {
    await deactivateMenuItem(routeParam(req, 'canteenId'), routeParam(req, 'itemId'));
    res.json({ success: true, message: 'Menu item deactivated' });
  })
);

export default router;
