import nodemailer from "nodemailer";
import { config } from "../config.js";

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransport() {
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
  await getTransport().sendMail({
    from: config.email.from,
    to,
    subject,
    html,
  });
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
