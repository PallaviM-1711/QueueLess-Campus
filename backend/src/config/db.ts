/**
 * db.ts
 * Mongoose connection factory with:
 *  - Single connection instance (not reconnecting on every import)
 *  - Graceful shutdown on SIGINT / SIGTERM
 *  - Connection-state logging (never logs the URI itself)
 */

import mongoose from 'mongoose';
import { env } from './env';

let isConnected = false;

export async function connectDB(): Promise<void> {
  if (isConnected) return;

  try {
    await mongoose.connect(env.MONGODB_URI, {
      // Mongoose 8+ has no deprecated options to suppress
    });
    isConnected = true;
    console.log('[DB] MongoDB connected successfully');
  } catch (err) {
    console.error('[DB] Connection failed:', (err as Error).message);
    // Exit so the process manager (Render / PM2) can restart
    process.exit(1);
  }
}

// Graceful shutdown helpers
function disconnectDB(): void {
  if (!isConnected) return;
  mongoose.connection
    .close()
    .then(() => {
      isConnected = false;
      console.log('[DB] MongoDB connection closed');
    })
    .catch((err) => console.error('[DB] Error closing connection:', err));
}

process.on('SIGINT', () => {
  disconnectDB();
  process.exit(0);
});

process.on('SIGTERM', () => {
  disconnectDB();
  process.exit(0);
});

/**
 * Returns the current Mongoose connection ready state.
 *  0 = disconnected
 *  1 = connected
 *  2 = connecting
 *  3 = disconnecting
 */
export function getDbStatus(): { state: number; label: string } {
  const state = mongoose.connection.readyState;
  const labels: Record<number, string> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  return { state, label: labels[state] ?? 'unknown' };
}
