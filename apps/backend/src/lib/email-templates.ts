import { env } from '@/config/env';

/**
 * Minimal, brand-consistent transactional email templates.
 * Kept as functions (not files) so they are type-checked with their params.
 */

function layout(title: string, bodyHtml: string, ctaLabel?: string, ctaUrl?: string): string {
  const button =
    ctaLabel && ctaUrl
      ? `<a href="${ctaUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 28px;border-radius:8px;margin:24px 0;">${ctaLabel}</a>`
      : '';
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;padding:40px;text-align:left;">
        <tr><td style="font-size:20px;font-weight:700;color:#111827;padding-bottom:8px;">${env.APP_NAME}</td></tr>
        <tr><td style="font-size:17px;font-weight:600;color:#111827;padding:16px 0 8px;">${title}</td></tr>
        <tr><td style="font-size:14px;line-height:22px;color:#4b5563;">${bodyHtml}</td></tr>
        ${button ? `<tr><td align="center">${button}</td></tr>` : ''}
        <tr><td style="font-size:12px;color:#9ca3af;padding-top:24px;border-top:1px solid #e5e7eb;">
          If you didn't request this, you can safely ignore this email.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export const emailTemplates = {
  verifyEmail(name: string, url: string) {
    return {
      subject: `Verify your ${env.APP_NAME} email`,
      html: layout(
        `Welcome, ${name}!`,
        `Thanks for signing up. Please confirm your email address to activate your account. This link expires in 24 hours.`,
        'Verify email',
        url
      ),
    };
  },
  resetPassword(name: string, url: string) {
    return {
      subject: `Reset your ${env.APP_NAME} password`,
      html: layout(
        `Hi ${name},`,
        `We received a request to reset your password. Click below to choose a new one. This link expires in 1 hour.`,
        'Reset password',
        url
      ),
    };
  },
  workspaceInvite(inviterName: string, workspaceName: string, url: string) {
    return {
      subject: `${inviterName} invited you to ${workspaceName} on ${env.APP_NAME}`,
      html: layout(
        `You're invited!`,
        `<strong>${inviterName}</strong> has invited you to join the workspace <strong>${workspaceName}</strong>. This invitation expires in 7 days.`,
        'Accept invitation',
        url
      ),
    };
  },
  suspiciousLogin(name: string, details: { ip: string; browser: string; location: string; time: string }) {
    return {
      subject: `New sign-in to your ${env.APP_NAME} account`,
      html: layout(
        `Hi ${name}, we noticed a new sign-in`,
        `A sign-in from an unrecognized device just occurred:<br/><br/>
         <strong>IP:</strong> ${details.ip}<br/>
         <strong>Device:</strong> ${details.browser}<br/>
         <strong>Location:</strong> ${details.location}<br/>
         <strong>Time:</strong> ${details.time}<br/><br/>
         If this was you, no action is needed. Otherwise, reset your password immediately and review your active sessions.`
      ),
    };
  },
  notification(title: string, body: string, link: string) {
    return {
      subject: title,
      html: layout(title, body, 'Open in app', link),
    };
  },
  paymentFailed(workspaceName: string, url: string) {
    return {
      subject: `Payment failed for ${workspaceName}`,
      html: layout(
        `Action needed: payment failed`,
        `We could not process the latest payment for <strong>${workspaceName}</strong>. Please update your payment method to avoid service interruption.`,
        'Update billing',
        url
      ),
    };
  },
};
