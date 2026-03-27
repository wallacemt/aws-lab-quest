type BaseEmailParams = {
  name: string;
  appUrl?: string;
  logoUrl?: string;
};

type InviteParams = BaseEmailParams;
type FreeAccessParams = BaseEmailParams;

export type SystemTemplateDraft = {
  code: string;
  name: string;
  description: string;
  subject: string;
  html: string;
  text: string;
};

function getAppUrl(params: BaseEmailParams): string {
  return params.appUrl ?? process.env.APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
}

function getLogoUrl(params: BaseEmailParams): string {
  return params.logoUrl ?? `${getAppUrl(params)}/android-chrome-192x192.png`;
}

function renderBrandedEmail(input: {
  title: string;
  subtitle: string;
  intro: string;
  highlights: string[];
  ctaLabel: string;
  ctaHref: string;
  footer: string;
  logoUrl: string;
}): string {
  const highlightItems = input.highlights.map((item) => `<li style="margin-bottom:6px;">${item}</li>`).join("");

  return `
    <div style="margin:0;padding:24px;background:#0b1220;font-family:Segoe UI,Arial,sans-serif;color:#0f172a;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:0 auto;background:#f8fafc;border:1px solid #1e293b;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="padding:22px;background:linear-gradient(135deg,#0ea5e9,#22d3ee);text-align:center;">
            <img src="${input.logoUrl}" alt="AWS Quest" width="72" height="72" style="display:block;margin:0 auto 10px auto;border-radius:16px;border:2px solid rgba(255,255,255,0.7);" />
            <p style="margin:0;font-size:11px;letter-spacing:1px;font-weight:700;text-transform:uppercase;color:#082f49;">AWS Lab Quest</p>
            <h1 style="margin:8px 0 4px 0;font-size:22px;line-height:1.2;color:#082f49;">${input.title}</h1>
            <p style="margin:0;font-size:13px;color:#0c4a6e;">${input.subtitle}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 22px;">
            <p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:#0f172a;">${input.intro}</p>
            <ul style="margin:0 0 18px 18px;padding:0;font-size:14px;line-height:1.5;color:#0f172a;">${highlightItems}</ul>
            <div style="margin:20px 0 10px 0;text-align:center;">
              <a href="${input.ctaHref}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#0f172a;color:#e2e8f0;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:.3px;text-transform:uppercase;">${input.ctaLabel}</a>
            </div>
            <p style="margin:12px 0 0 0;font-size:12px;line-height:1.5;color:#475569;text-align:center;">${input.footer}</p>
          </td>
        </tr>
      </table>
    </div>
  `;
}

export function renderDailyPraticeInviteTemplate(params: InviteParams) {
  const appUrl = getAppUrl(params);
  const logoUrl = getLogoUrl(params);

  const subject = "Sua trilha AWS de hoje ja esta pronta";
  const html = renderBrandedEmail({
    title: `Ola, ${params.name}!`,
    subtitle: "Seu treino diario esta esperando por voce.",
    intro: "Manter consistencia diaria acelera sua aprovacao nas certificacoes AWS.",
    highlights: [
      "Knowledge Check para reforco rapido",
      "Simulado para testar estrategia",
      "Lab para praticar cenario real",
    ],
    ctaLabel: "Comecar pratica agora",
    ctaHref: `${appUrl}/`,
    footer: "Dica: 20 minutos por dia geram progresso continuo.",
    logoUrl,
  });

  return {
    subject,
    html,
    text: `Ola, ${params.name}! Sua pratica diaria esta pronta. Acesse ${appUrl} e faca um KC, Simulado ou Lab hoje.`,
  };
}

export function renderFreeAcessTemplate(params: FreeAccessParams) {
  const appUrl = getAppUrl(params);
  const logoUrl = getLogoUrl(params);

  const subject = "Seu acesso foi liberado";
  const html = renderBrandedEmail({
    title: `Parabens, ${params.name}!`,
    subtitle: "Seu acesso ao AWS Lab Quest foi aprovado.",
    intro: "Seu ambiente de estudo esta pronto para acelerar sua preparacao.",
    highlights: ["Monte uma rotina com Labs e KC", "Acompanhe seu nivel e badges", "Use simulados para medir evolucao"],
    ctaLabel: "Entrar na plataforma",
    ctaHref: `${appUrl}/login`,
    footer: "Seja bem-vindo(a)! Vamos construir sua aprovacao certificacao por certificacao.",
    logoUrl,
  });

  return {
    subject,
    html,
    text: `Parabens, ${params.name}! Seu acesso ao AWS Lab Quest foi liberado. Entre em ${appUrl}/login e comece agora.`,
  };
}

export function getSystemEmailTemplates(params: BaseEmailParams = { name: "Aluno" }): SystemTemplateDraft[] {
  const daily = renderDailyPraticeInviteTemplate(params);
  const freeAccess = renderFreeAcessTemplate(params);

  return [
    {
      code: "daily-practice-invite",
      name: "Convite de pratica diaria",
      description: "Mensagem de engajamento diario para usuarios ativos.",
      subject: daily.subject,
      html: daily.html,
      text: daily.text,
    },
    {
      code: "free-access",
      name: "Acesso liberado",
      description: "Comunicado de aprovacao de acesso na plataforma.",
      subject: freeAccess.subject,
      html: freeAccess.html,
      text: freeAccess.text,
    },
  ];
}
