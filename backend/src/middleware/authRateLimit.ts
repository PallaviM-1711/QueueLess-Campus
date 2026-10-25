import { Request, Response, NextFunction } from 'express';

interface RateLimitWindow {
  count: number;
  resetAt: number;
}

const windows = new Map<string, RateLimitWindow>();

export function authRateLimit(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = `${req.ip}:${req.baseUrl}${req.path}`;
    let window = windows.get(key);

    if (!window || window.resetAt <= now) {
      window = { count: 0, resetAt: now + windowMs };
      windows.set(key, window);
    }

    window.count += 1;
    if (window.count > maxRequests) {
      res.setHeader('Retry-After', Math.ceil((window.resetAt - now) / 1000));
      res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.',
      });
      return;
    }

    if (windows.size > 10_000) {
      for (const [entryKey, entry] of windows) {
        if (entry.resetAt <= now) windows.delete(entryKey);
      }
    }
    next();
  };
}
