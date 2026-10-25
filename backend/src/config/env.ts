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

function optionalPort(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('[Config] SMTP_PORT must be an integer between 1 and 65535');
  }
  return port;
}

function parseProxyHops(value: string | undefined): number {
  const hops = Number(value ?? '0');
  if (!Number.isInteger(hops) || hops < 0) {
    throw new Error('[Config] TRUST_PROXY_HOPS must be a non-negative integer');
  }
  return hops;
}

const jwtSecret = requireEnv('JWT_SECRET');
if (jwtSecret.length < 64) {
  throw new Error('[Config] JWT_SECRET must be at least 64 characters long');
}

const smtp = {
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: optionalPort(process.env.SMTP_PORT) ?? 587,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  EMAIL_FROM: process.env.EMAIL_FROM,
};

const smtpConfigured = Boolean(smtp.SMTP_HOST && smtp.SMTP_USER && smtp.SMTP_PASS);
const smtpPartiallyConfigured =
  Boolean(smtp.SMTP_HOST || smtp.SMTP_USER || smtp.SMTP_PASS) && !smtpConfigured;
if (smtpPartiallyConfigured) {
  throw new Error('[Config] Configure SMTP_HOST, SMTP_USER, and SMTP_PASS together');
}

const razorpay = {
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
};
const razorpayPartiallyConfigured =
  Boolean(razorpay.RAZORPAY_KEY_ID || razorpay.RAZORPAY_KEY_SECRET) &&
  !(razorpay.RAZORPAY_KEY_ID && razorpay.RAZORPAY_KEY_SECRET);
if (razorpayPartiallyConfigured) {
  throw new Error('[Config] Configure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET together');
}
if (razorpay.RAZORPAY_WEBHOOK_SECRET && !razorpay.RAZORPAY_KEY_ID) {
  throw new Error('[Config] Configure Razorpay API keys before setting the webhook secret');
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: parsePort(process.env.PORT),
  TRUST_PROXY_HOPS: parseProxyHops(process.env.TRUST_PROXY_HOPS),
  MONGODB_URI: requireEnv('MONGODB_URI'),
  JWT_SECRET: jwtSecret,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '7d',
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  ...smtp,
  ...razorpay,
} as const;
