import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import {
  buildTemplateVariables,
  ensureSystemTemplates,
  renderTemplateWithVariables,
} from "@/lib/admin-email-templates";
import { sendEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

function buildPasswordResetFallbackHtml(input: { name: string; url: string }) {
  return `
    <div style="margin:0;padding:24px;background:#0b1220;font-family:Segoe UI,Arial,sans-serif;color:#0f172a;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:0 auto;background:#f8fafc;border:1px solid #1e293b;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="padding:22px;background:linear-gradient(135deg,#0ea5e9,#22d3ee);text-align:center;">
            <p style="margin:0;font-size:11px;letter-spacing:1px;font-weight:700;text-transform:uppercase;color:#082f49;">AWS Lab Quest</p>
            <h1 style="margin:8px 0 4px 0;font-size:22px;line-height:1.2;color:#082f49;">Recuperacao de senha</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 22px;">
            <p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:#0f172a;">Ola, ${input.name}! Recebemos um pedido para redefinir sua senha.</p>
            <div style="margin:20px 0 10px 0;text-align:center;">
              <a href="${input.url}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#0f172a;color:#e2e8f0;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:.3px;text-transform:uppercase;">Redefinir senha</a>
            </div>
            <p style="margin:12px 0 0 0;font-size:12px;line-height:1.5;color:#475569;text-align:center;">Se nao foi voce, ignore este email com seguranca.</p>
          </td>
        </tr>
      </table>
    </div>
  `;
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      let subject = "Redefinicao de senha AWS Lab Quest";
      let html = buildPasswordResetFallbackHtml({
        name: user.name,
        url,
      });

      try {
        let template = await prisma.adminEmailTemplate.findUnique({ where: { code: "password-reset" } });

        if (!template) {
          await ensureSystemTemplates();
          template = await prisma.adminEmailTemplate.findUnique({ where: { code: "password-reset" } });
        }

        if (template?.active) {
          const variables = buildTemplateVariables({ name: user.name, resetUrl: url });
          subject = renderTemplateWithVariables(template.subject, variables);
          html = renderTemplateWithVariables(template.html, variables);
        }
      } catch {
        // Keep fallback template if dynamic template retrieval fails.
      }

      await sendEmail({
        to: user.email,
        subject,
        html,
      });
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh if older than 1 day
  },
  trustedOrigins: [process.env.BETTER_AUTH_URL ?? "http://localhost:3000"],
});

export type Session = typeof auth.$Infer.Session;
