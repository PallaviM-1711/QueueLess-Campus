/**
 * utils/mailer.ts
 * Nodemailer transport wrapper.
 * All SMTP configuration comes from environment variables.
 * Falls back to a no-op log in development when SMTP is not configured.
 */

import nodemailer, { type SendMailOptions } from 'nodemailer';

function createTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    // Return a fake transport that just logs — useful in development
    return {
      sendMail: async (options: SendMailOptions) => {
        console.log('[Mailer] SMTP not configured — email would have been sent:');
        console.log(`  To: ${options.to}`);
        console.log(`  Subject: ${options.subject}`);
        console.log(`  Text: ${options.text}`);
        return { messageId: 'dev-no-op' };
      },
    };
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT ?? '587', 10),
    secure: parseInt(SMTP_PORT ?? '587', 10) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

const transport = createTransport();

export async function sendOtpEmail(
  to: string,
  name: string,
  otp: string
): Promise<void> {
  const from = process.env.EMAIL_FROM ?? '"QueueLess Campus" <no-reply@queuelesscampus.com>';

  await transport.sendMail({
    from,
    to,
    subject: 'QueueLess Campus — Verify your email',
    text: `Hi ${name},\n\nYour email verification code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you did not register, please ignore this email.\n\n— QueueLess Campus Team`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#e85d04">QueueLess Campus</h2>
        <p>Hi <strong>${name}</strong>,</p>
        <p>Your email verification code is:</p>
        <div style="font-size:2.5rem;font-weight:bold;letter-spacing:0.5rem;color:#e85d04;text-align:center;padding:1rem;background:#fff8f5;border-radius:8px;margin:1rem 0">
          ${otp}
        </div>
        <p style="color:#6b7280;font-size:0.9rem">This code expires in 10 minutes. If you did not register, please ignore this email.</p>
      </div>
    `,
  });
}
