/**
 * env.ts
 * Loads and validates required environment variables at startup.
 * Throws immediately if a required variable is missing, so the app
 * never starts in a misconfigured state.
 */

import dotenv from 'dotenv';
import path from 'path';

// Load .env from the backend root (one level above src/)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`[Config] Missing required environment variable: ${key}`);
  }
  return value;
}

function parsePort(value: string | undefined): number {
  const port = Number(value ?? '5000');
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('[Config] PORT must be an integer between 1 and 65535');
  }
  return port;
}

const jwtSecret = requireEnv('JWT_SECRET');
if (jwtSecret.length < 64) {
  throw new Error('[Config] JWT_SECRET must be at least 64 characters long');
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: parsePort(process.env.PORT),
  MONGODB_URI: requireEnv('MONGODB_URI'),
  JWT_SECRET: jwtSecret,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '7d',
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
} as const;
