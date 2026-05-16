import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAiModel } from "@/lib/ai";

type Body = {
  userName?: string;
  certificationCode?: string;
  scorePercent?: number;
  passed?: boolean;
  correctAnswers?: number;
  totalQuestions?: number;
  bestArea?: string | null;
  weakestArea?: string | null;
};

function fallbackMessage(passed: boolean, firstName: string): string {
  if (passed) {
    return `Excelente desempenho, ${firstName}! Voce provou que esta pronto para a certificacao. O awslq acredita em voce!`;
  }
  return `Nao desanime, ${firstName}! Cada tentativa e um passo a mais na sua jornada. Continue praticando — o awslq acredita em voce!`;
}

function firstName(name: string): string {
  return (name.trim().split(/\s+/)[0] ?? name).trim();
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Body;

  const name = typeof body.userName === "string" && body.userName.trim() ? body.userName.trim() : "estudante";
  const first = firstName(name);
  const cert = body.certificationCode ?? "AWS";
  const score = typeof body.scorePercent === "number" ? body.scorePercent : 0;
  const passed = body.passed ?? score >= 70;
  const correct = body.correctAnswers ?? 0;
  const total = body.totalQuestions ?? 0;
  const bestArea = body.bestArea ?? null;
  const weakestArea = body.weakestArea ?? null;

  const context = [
    `Nome: ${name}`,
    `Certificacao: ${cert}`,
    `Resultado: ${score}% (${correct}/${total} questoes corretas)`,
    `Status: ${passed ? "APROVADO" : "NAO APROVADO"}`,
    bestArea ? `Melhor area: ${bestArea}` : null,
    weakestArea ? `Area mais fraca: ${weakestArea}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const systemPrompt = passed
    ? `Voce e o tutor motivacional do AWS Lab Quest, um app gamificado de estudos para certificacoes AWS. Escreva uma mensagem curta (3-4 frases) em portugues, calorosa e pessoal, parabenizando o estudante por ter atingido a pontuacao minima no simulado. Mencione o esforco e dedicacao, nao apenas o resultado. Se houver uma area de destaque, elogie especificamente. Termine SEMPRE com a frase exata: "O awslq acredita em voce!". Escreva apenas o texto da mensagem, sem aspas, sem prefixo.`
    : `Voce e o tutor motivacional do AWS Lab Quest, um app gamificado de estudos para certificacoes AWS. Escreva uma mensagem curta (3-4 frases) em portugues, acolhedora e encorajadora, para um estudante que nao atingiu a pontuacao minima no simulado. Mostre empatia real, normalize o erro como parte da jornada, e aponte um caminho concreto de melhora (se houver area fraca, mencione-a). Termine SEMPRE com a frase exata: "O awslq acredita em voce!". Escreva apenas o texto da mensagem, sem aspas, sem prefixo.`;

  const userPrompt = `Dados do simulado:\n${context}\n\nEscreva a mensagem personalizada para ${first}:`;

  try {
    const model = getAiModel();
    const result = await Promise.race([
      model.generateContent([systemPrompt, userPrompt]),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 12000)),
    ]);

    const text = result.response.text().trim();
    const message = text.length > 20 ? text : fallbackMessage(passed, first);

    return NextResponse.json({ message });
  } catch {
    return NextResponse.json({ message: fallbackMessage(passed, first) });
  }
}
