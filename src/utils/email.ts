import nodemailer, { Transporter } from 'nodemailer';

// Email transport. Configured entirely by environment so the app never hard
// -depends on an SMTP server:
//   SMTP_URL   — e.g. smtps://user:pass@smtp.example.com  (takes precedence)
//   SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_SECURE   — discrete settings
//   MAIL_FROM  — from address (default below)
// With nothing configured, sends are a no-op (logged in dev) and never throw,
// so notifications still create their in-app row.

interface Mail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

let resolved = false;
let transporter: Transporter | null = null;

function getTransport(): Transporter | null {
  if (resolved) return transporter;
  resolved = true;

  if (process.env.SMTP_URL) {
    transporter = nodemailer.createTransport(process.env.SMTP_URL);
  } else if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' }
        : undefined,
    });
  }
  return transporter;
}

export async function sendEmail(mail: Mail): Promise<{ delivered: boolean; reason?: string }> {
  const from = process.env.MAIL_FROM || 'Education Hub <no-reply@educationhub.local>';
  const t = getTransport();

  if (!t) {
    // No SMTP configured — visible in dev, silent in test/production.
    if (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'production') {
      console.log(`[email:dev] to=${mail.to} subject="${mail.subject}"`);
    }
    return { delivered: false, reason: 'no-transport' };
  }

  try {
    await t.sendMail({ from, to: mail.to, subject: mail.subject, text: mail.text, html: mail.html });
    return { delivered: true };
  } catch (err) {
    console.error('email send failed:', err);
    return { delivered: false, reason: 'send-error' };
  }
}
