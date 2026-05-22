import nodemailer from "nodemailer";
import { config } from "../config.js";
import { logger } from "../shared/logger.js";

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransport() {
  if (!config.email.username || !config.email.password) {
    throw new Error(
      "Email credentials not configured. Set MAIL_USERNAME and MAIL_PASSWORD in the worker .env file. " +
      "For Gmail with 2FA, generate an App Password at https://myaccount.google.com/apppasswords"
    );
  }
  if (!transport) {
    transport = nodemailer.createTransport({
      service: "gmail",
      auth: { user: config.email.username, pass: config.email.password },
    });
  }
  return transport;
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const transporter = getTransport();
  try {
    await transporter.sendMail({
      from: config.email.from,
      to,
      subject,
      html,
    });
  } catch (err) {
    transport = null; // reset so next attempt re-creates transporter
    logger.error({ err, to }, "sendEmail: SMTP error");
    throw err;
  }
}

function resolveVar(template: string, vars: Record<string, string>): string {
  return template.replace(/{{\s*(\w+)\s*}}/g, (_, key: string) => vars[key] ?? "");
}

export function buildEmailContent(
  html: string,
  subject: string,
  vars: Record<string, string>
): { html: string; subject: string } {
  return {
    html: resolveVar(html, vars),
    subject: resolveVar(subject, vars),
  };
}
