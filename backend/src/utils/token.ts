/**
 * utils/token.ts
 * Generates a unique, URL-safe pickup token for orders.
 * Format: 3-char prefix + 5 random uppercase alphanumeric chars → e.g. "QLQ7X2K"
 */

import crypto from 'crypto';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars (0,O,1,I)

export function generatePickupToken(): string {
  const bytes = crypto.randomBytes(5);
  let token = 'QL'; // QueueLess prefix
  for (const byte of bytes) {
    token += CHARS[byte % CHARS.length];
  }
  return token;
}

