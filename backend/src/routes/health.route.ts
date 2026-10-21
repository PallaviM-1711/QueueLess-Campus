/**
 * health.route.ts
 * GET /api/health
 * Returns server uptime and MongoDB connection status.
 * Used by Render/Vercel health checks and local smoke tests.
 */

import { Router, Request, Response } from 'express';
import { getDbStatus } from '../config/db';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const db = getDbStatus();
  const uptime = Math.floor(process.uptime());

  res.status(200).json({
    success: true,
    message: 'QueueLess Campus API is running',
    timestamp: new Date().toISOString(),
    uptime: `${uptime}s`,
    environment: process.env.NODE_ENV ?? 'development',
    database: db,
  });
});

export default router;

