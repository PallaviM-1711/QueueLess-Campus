import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { body, matchedData, validationResult } from 'express-validator';
import { authenticate } from '../middleware/authenticate';
import { authRateLimit } from '../middleware/authRateLimit';
import { createError } from '../middleware/errorHandler';
import {
  getMe,
  loginUser,
  registerStudent,
  resendOtp,
  verifyEmail,
} from '../services/auth.service';

const router = Router();

function validateRequest(req: Request, _res: Response, next: NextFunction): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    next(createError(errors.array()[0].msg, 400));
    return;
  }
  next();
}

function asyncHandler(
  handler: (req: Request, res: Response) => Promise<void>
): RequestHandler {
  return (req, res, next) => {
    void handler(req, res).catch(next);
  };
}

interface RegisterBody {
  name: string;
  email: string;
  password: string;
}

interface EmailBody {
  email: string;
}

interface VerifyBody extends EmailBody {
  otp: string;
}

interface LoginBody extends EmailBody {
  password: string;
}

const emailValidation = body('email')
  .isString()
  .withMessage('A valid college email address is required')
  .bail()
  .isEmail()
  .withMessage('A valid college email address is required')
  .normalizeEmail();

const passwordValidation = body('password')
  .isString()
  .withMessage('Password must be a string')
  .bail()
  .isLength({ min: 8, max: 72 })
  .withMessage('Password must be between 8 and 72 characters')
  .bail()
  .custom((value: string) => Buffer.byteLength(value, 'utf8') <= 72)
  .withMessage('Password cannot exceed 72 UTF-8 bytes');

router.post(
  '/register',
  authRateLimit(10, 15 * 60 * 1000),
  body('name')
    .isString()
    .withMessage('Name is required')
    .bail()
    .trim()
    .isLength({ min: 2, max: 60 })
    .withMessage('Name must be between 2 and 60 characters'),
  emailValidation,
  passwordValidation,
  validateRequest,
  asyncHandler(async (req, res) => {
    const input = matchedData<RegisterBody>(req, { locations: ['body'] });
    const result = await registerStudent(input);
    res.status(201).json({ success: true, ...result });
  })
);

router.post(
  '/verify-email',
  authRateLimit(30, 15 * 60 * 1000),
  emailValidation,
  body('otp')
    .isString()
    .withMessage('Verification code must be six digits')
    .bail()
    .matches(/^\d{6}$/)
    .withMessage('Verification code must be six digits'),
  validateRequest,
  asyncHandler(async (req, res) => {
    const input = matchedData<VerifyBody>(req, { locations: ['body'] });
    const result = await verifyEmail(input.email, input.otp);
    res.json({ success: true, ...result });
  })
);

router.post(
  '/resend-otp',
  authRateLimit(10, 15 * 60 * 1000),
  emailValidation,
  validateRequest,
  asyncHandler(async (req, res) => {
    const { email } = matchedData<EmailBody>(req, { locations: ['body'] });
    const result = await resendOtp(email);
    res.json({ success: true, ...result });
  })
);

router.post(
  '/login',
  authRateLimit(30, 15 * 60 * 1000),
  emailValidation,
  passwordValidation,
  validateRequest,
  asyncHandler(async (req, res) => {
    const input = matchedData<LoginBody>(req, { locations: ['body'] });
    const result = await loginUser(input);
    res.json({ success: true, ...result });
  })
);

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    if (!req.user) throw createError('Authentication required', 401);
    const user = await getMe(req.user.userId);
    res.json({ success: true, user });
  })
);

export default router;
