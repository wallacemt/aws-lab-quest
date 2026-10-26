export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = input.from?.trim() || process.env.RESEND_FROM_EMAIL?.trim();
  const replyTo = input.replyTo?.trim() || process.env.RESEND_REPLY_TO?.trim();
  if (!apiKey || !from) throw new Error("RESEND_API_KEY e RESEND_FROM_EMAIL são obrigatórias para enviar e-mail.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Resend: falha no envio (HTTP ${response.status}).`);
  const result: unknown = await response.json();
  if (!result || typeof result !== "object" || !("id" in result) || typeof result.id !== "string" || !result.id)
    throw new Error("Resend: resposta de envio inválida.");
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
