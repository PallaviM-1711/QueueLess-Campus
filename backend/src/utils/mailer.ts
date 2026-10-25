/**
 * utils/mailer.ts
 * Nodemailer transport wrapper.
 * All SMTP configuration comes from environment variables.
 * Falls back to a no-op log in development when SMTP is not configured.
 */

import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env';

let transport: Transporter | undefined;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character];
  });
}

function getTransport(): Transporter {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    throw new Error('Email delivery is not configured. Set the SMTP environment variables.');
  }

  transport ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  return transport;
}

export async function sendOtpEmail(
  to: string,
  name: string,
  otp: string
): Promise<void> {
  const from = env.EMAIL_FROM || env.SMTP_USER;
  const safeName = escapeHtml(name);

  await getTransport().sendMail({
    from,
    to,
    subject: 'QueueLess Campus — Verify your email',
    text: `Hi ${name},\n\nYour email verification code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you did not register, please ignore this email.\n\n— QueueLess Campus Team`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#e85d04">QueueLess Campus</h2>
        <p>Hi <strong>${safeName}</strong>,</p>
        <p>Your email verification code is:</p>
        <div style="font-size:2.5rem;font-weight:bold;letter-spacing:0.5rem;color:#e85d04;text-align:center;padding:1rem;background:#fff8f5;border-radius:8px;margin:1rem 0">
          ${otp}
        </div>
        <p style="color:#6b7280;font-size:0.9rem">This code expires in 10 minutes. If you did not register, please ignore this email.</p>
      </div>
    `,
  });
}

export async function sendStaffInvitationEmail(
  to: string,
  name: string,
  roleName: string,
  canteenName: string,
  token: string
): Promise<void> {
  const from = env.EMAIL_FROM || env.SMTP_USER;
  const safeName = escapeHtml(name);
  const safeRole = escapeHtml(roleName);
  const safeCanteen = escapeHtml(canteenName);
  const invitationUrl = new URL('/accept-invitation', env.CLIENT_ORIGIN);
  invitationUrl.hash = token;

  await getTransport().sendMail({
    from,
    to,
    subject: 'QueueLess Campus — Staff account invitation',
    text: [
      `Hi ${name},`,
      '',
      `You have been invited as ${roleName} for ${canteenName}.`,
      `Accept the invitation and set your password within 24 hours: ${invitationUrl}`,
      '',
      'If you were not expecting this invitation, you can ignore this email.',
      '',
      '— QueueLess Campus Team',
    ].join('\n'),
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#e85d04">QueueLess Campus</h2>
        <p>Hi <strong>${safeName}</strong>,</p>
        <p>You have been invited as <strong>${safeRole}</strong> for <strong>${safeCanteen}</strong>.</p>
        <p><a href="${escapeHtml(invitationUrl.toString())}">Accept invitation and set your password</a></p>
        <p style="color:#6b7280;font-size:0.9rem">This link expires in 24 hours. If you were not expecting this invitation, ignore this email.</p>
      </div>
    `,
  });
}
