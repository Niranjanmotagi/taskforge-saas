import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  // Host AND credentials must be present — a half-configured SMTP (e.g. the
  // .env.example placeholder host without a user) falls back to dev logging.
  if (!env.SMTP_HOST || !env.SMTP_USER) {
    logger.warn('SMTP not configured — emails will be logged instead of sent');
    return null;
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    });
  }
  return transporter;
}

export interface MailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send an email. Falls back to logging when SMTP is unconfigured (dev),
 * so flows remain testable without a mail server.
 */
export async function sendMail(options: MailOptions): Promise<void> {
  const t = getTransporter();
  if (!t) {
    // Surface the primary action link so flows are testable without SMTP.
    const link = /href="([^"]+)"/.exec(options.html)?.[1];
    logger.info(`[mail:dev] to=${options.to} subject="${options.subject}"${link ? ` link=${link}` : ''}`);
    return;
  }
  await t.sendMail({
    from: `"${env.EMAIL_FROM_NAME}" <${env.EMAIL_FROM_ADDRESS}>`,
    ...options,
  });
  logger.debug(`mail sent to=${options.to} subject="${options.subject}"`);
}
