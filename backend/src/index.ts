/**
 * index.ts — Backend Entry Point
 *
 * Boot order:
 *  1. Validate environment variables (throws immediately if invalid)
 *  2. Create Express app
 *  3. Attach middleware (Helmet, CORS, JSON body parser)
 *  4. Register routes
 *  5. Attach 404 and global error handlers
 *  6. Connect to MongoDB
 *  7. Start HTTP + Socket.IO server
 */

import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Server as SocketIOServer } from 'socket.io';

// Config — must be first so env vars are loaded before anything else
import { env } from './config/env';
import { connectDB, disconnectDB } from './config/db';

// Middleware
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';

// Routes
import healthRouter from './routes/health.route';
import authRouter from './routes/auth.route';
import menuRouter from './routes/menu.route';
import bookingRouter from './routes/booking.route';
import ordersRouter from './routes/orders.route';
import staffOrdersRouter from './routes/staffOrders.route';
import adminRouter from './routes/admin.route';
import paymentsRouter from './routes/payments.route';
import { configureOrderSocket } from './realtime/orderEvents';

// ── Express app setup ────────────────────────────────────────────────────────
const app = express();

if (env.TRUST_PROXY_HOPS > 0) {
  app.set('trust proxy', env.TRUST_PROXY_HOPS);
}

app.use(helmet());

// CORS — only allow the configured client origin
app.use(
  cors({
    origin: env.CLIENT_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
);

// Body parsers
app.use(
  '/api/payments/razorpay/webhook',
  express.raw({ type: 'application/json', limit: '100kb' })
);
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/canteens', menuRouter);
app.use('/api/canteens', bookingRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/canteens', staffOrdersRouter);
app.use('/api/admin', adminRouter);
app.use('/api/payments', paymentsRouter);

// Placeholder index — gives a clean response instead of 404 on GET /
app.get('/', (_req, res) => {
  res.json({ message: 'QueueLess Campus API — see /api/health' });
});

// 404 handler (must be after routes)
app.use(notFound);

// Global error handler (must be last and have 4 args)
app.use(errorHandler);

// ── HTTP + Socket.IO server ──────────────────────────────────────────────────
const httpServer = http.createServer(app);

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: env.CLIENT_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});
configureOrderSocket(io);

let isShuttingDown = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[Server] ${signal} received; shutting down`);

  try {
    await new Promise<void>((resolve, reject) => {
      io.close((error) => (error ? reject(error) : resolve()));
    });
  } catch (err) {
    console.error('[Fatal] Error closing the HTTP server:', err);
    process.exitCode = 1;
  }

  try {
    await disconnectDB();
  } catch (err) {
    console.error('[Fatal] Error disconnecting from MongoDB:', err);
    process.exitCode = 1;
  }
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

// Basic Socket.IO connection log (real event handlers come in Phase 4)
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

// ── Start ────────────────────────────────────────────────────────────────────
async function bootstrap(): Promise<void> {
  await connectDB();

  httpServer.listen(env.PORT, () => {
    console.log(
      `[Server] Running in ${env.NODE_ENV} mode on http://localhost:${env.PORT}`
    );
    console.log(`[Server] Health check → http://localhost:${env.PORT}/api/health`);
  });
}

bootstrap().catch((err) => {
  console.error('[Fatal] Failed to start server:', err);
  process.exit(1);
});

export { io };
