import { config } from "./config";

export interface WelcomeEmailResult {
  sent: boolean;
}

// Resend is optional (see .env). Without RESEND_API_KEY configured, this
// logs the email content instead of sending — so account creation never
// hard-fails just because email isn't set up yet.
export async function sendWelcomeEmail(to: string, name: string | null, tempPassword: string): Promise<WelcomeEmailResult> {
  const subject = "Welcome to LeadsGen";
  const greeting = name ? `Hi ${name},` : "Hi,";
  const text = `${greeting}

An account has been created for you on LeadsGen.

Email: ${to}
Temporary password: ${tempPassword}

Please log in and change your password as soon as possible — you'll be asked to on first login.`;

  if (!config.resendApiKey || !config.resendFromEmail) {
    console.warn(`[email] Resend not configured — welcome email for ${to} was not sent. Content:\n${text}`);
    return { sent: false };
  }

  const { Resend } = await import("resend");
  const resend = new Resend(config.resendApiKey);
  const { error } = await resend.emails.send({
    from: config.resendFromEmail,
    to,
    subject,
    text,
  });

  if (error) {
    console.error(`[email] Resend failed to send welcome email to ${to}:`, error);
    return { sent: false };
  }

  return { sent: true };
}
