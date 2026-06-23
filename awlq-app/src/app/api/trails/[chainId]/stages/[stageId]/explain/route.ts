import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAiModelForContext } from "@/lib/ai";

type RouteContext = { params: Promise<{ chainId: string; stageId: string }> };

/**
 * POST /api/trails/[chainId]/stages/[stageId]/explain
 *
 * Returns a cached AI-generated explanation for this stage, or generates one
 * on first call. The explanation is shared across all users (cached per stageId).
 *
 * Body: {} (empty)
 * Returns: { markdown: string; cached: boolean }
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { chainId, stageId } = await context.params;

  // Load stage and verify it belongs to the chain
  const stage = await prisma.questChainStage.findFirst({
    where: { id: stageId, chainId },
    select: {
      id: true,
      title: true,
      awsServiceId: true,
      topic: true,
      chain: { select: { name: true, certificationPresetId: true } },
      explain: { select: { markdown: true } },
    },
  });

  if (!stage) return NextResponse.json({ error: "Stage not found" }, { status: 404 });

  // Return cached explanation if available
  if (stage.explain) {
    return NextResponse.json({ markdown: stage.explain.markdown, cached: true });
  }

  // Load user profile for personalization
  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      favoriteTheme: true,
      certificationPreset: { select: { name: true, code: true } },
    },
  });

  const subject = stage.awsServiceId ?? stage.topic ?? stage.title;
  const certName = profile?.certificationPreset?.name ?? stage.chain.certificationPresetId ?? "AWS";
  const favoriteTheme = profile?.favoriteTheme?.trim() || null;

  const analogyInstruction = favoriteTheme
    ? `\n\n## Analogia com ${favoriteTheme}\nCrie uma analogia criativa e memorável usando "${favoriteTheme}" para fixar este conceito.`
    : "";

  const prompt = `Você é um instrutor AWS especialista e pedagogo experiente. Explique de forma detalhada, didática e envolvente o seguinte tópico para um estudante que está se preparando para a certificação ${certName}.

## Tópico: ${stage.title}${subject !== stage.title ? ` (${subject})` : ""}
Trilha: ${stage.chain.name}

Estruture sua resposta em Markdown com as seguintes seções:

## O que é ${stage.title}?
Explique o conceito de forma clara, objetiva e com exemplos concretos.

## Como funciona
Descreva o funcionamento interno, componentes principais e arquitetura.

## Casos de uso na AWS
Liste 3-5 cenários reais onde este serviço/conceito é utilizado.
${analogyInstruction}

## Pontos-chave para a prova (${certName})
Liste os aspectos mais cobrados na certificação com dicas práticas.

## Armadilhas comuns
Mencione erros frequentes e conceitos que costumam confundir.

## Resumo
Síntese em 4-5 pontos principais para fixação.

---

Regras:
- Escreva em português (pt-BR)
- Seja detalhado (mínimo 800 palavras)
- Use exemplos concretos e práticos
- Mantenha um tom educativo e motivador
- Use formatação Markdown rica (listas, bold, code blocks quando relevante)`;

  let markdown: string;
  try {
    const aiModel = await getAiModelForContext("QUESTION_EXPLAIN");
    const result = await aiModel.generateContent(prompt);
    markdown = result.response.text().trim();
    if (!markdown) throw new Error("Empty AI response");
  } catch (err) {
    return NextResponse.json(
      { error: `Falha ao gerar explicação: ${err instanceof Error ? err.message : "Erro desconhecido"}` },
      { status: 500 },
    );
  }

  // Persist explanation for future reuse
  await prisma.trailStageExplain.create({
    data: { stageId, markdown },
  });

  return NextResponse.json({ markdown, cached: false });
}
