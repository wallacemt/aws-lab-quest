import { prisma } from "@/lib/prisma";
import { getSystemEmailTemplates } from "@/features/admin/email/templates";

const ALLOWED_VARIABLES = ["name", "app_url", "logo_url", "reset_url"] as const;

const STATIC_LOGO_URL =
  "https://djitwkagdqgbhanenonk.supabase.co/storage/v1/object/public/aws-lab-quest/simulado-artwork/android-chrome-512x512.png";

type TemplateVariables = {
  name: string;
  app_url: string;
  logo_url: string;
  reset_url: string;
};

function getBaseAppUrl(): string {
  return process.env.APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
}

export function renderTemplateWithVariables(template: string, vars: TemplateVariables): string {
  let rendered = template;

  for (const key of ALLOWED_VARIABLES) {
    const value = vars[key] ?? "";
    const pattern = new RegExp(`{{\\s*${key}\\s*}}`, "gi");
    rendered = rendered.replace(pattern, value);
  }

  return rendered;
}

export async function ensureSystemTemplates(): Promise<void> {
  const drafts = getSystemEmailTemplates({ name: "Aluno" });

  for (const draft of drafts) {
    await prisma.adminEmailTemplate.upsert({
      where: { code: draft.code },
      create: {
        code: draft.code,
        name: draft.name,
        description: draft.description,
        subject: draft.subject,
        html: draft.html,
        text: draft.text,
        active: true,
        isSystem: true,
      },
      update: {
        // System templates are code-managed — regenerate to apply placeholder/URL changes.
        isSystem: true,
        subject: draft.subject,
        html: draft.html,
        text: draft.text ?? null,
      },
    });
  }
}

export function buildTemplateVariables(input: { name: string; resetUrl?: string }): TemplateVariables {
  const appUrl = getBaseAppUrl();
  return {
    name: input.name,
    app_url: appUrl,
    logo_url: STATIC_LOGO_URL,
    reset_url: input.resetUrl ?? `${appUrl}/login`,
  };
}
