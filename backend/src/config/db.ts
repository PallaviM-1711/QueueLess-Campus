/**
 * db.ts
 * Mongoose connection factory with:
 *  - Single connection instance (not reconnecting on every import)
 *  - Explicit connect/disconnect functions for server lifecycle management
 *  - Connection-state logging (never logs the URI itself)
 */

import mongoose from 'mongoose';
import { env } from './env';

export async function connectDB(): Promise<void> {
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(env.MONGODB_URI);
  console.log('[DB] MongoDB connected successfully');
}

export async function disconnectDB(): Promise<void> {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.disconnect();
  console.log('[DB] MongoDB connection closed');
}

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
