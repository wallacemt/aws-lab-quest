import nodemailer from "nodemailer";

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
};

let cachedTransporter: nodemailer.Transporter | null = null;

function getRequiredEnv(name: "MAIL_USERNAME" | "MAIL_PASSWORD"): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} nao configurada.`);
  }
  return value;
}

function getEmailFromAddress(mailUsername: string): string {
  const explicitFrom = process.env.EMAIL_FROM?.trim();
  if (explicitFrom) {
    return explicitFrom;
  }

  return `AWS Quest <${mailUsername}>`;
}

function getTransporter(): nodemailer.Transporter {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const mailUsername = getRequiredEnv("MAIL_USERNAME");
  const mailPassword = getRequiredEnv("MAIL_PASSWORD");

  cachedTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: mailUsername,
      pass: mailPassword,
    },
  });

  return cachedTransporter;
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const mailUsername = getRequiredEnv("MAIL_USERNAME");
  const from = getEmailFromAddress(mailUsername);
  const transporter = getTransporter();

  await transporter.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
  });
}
