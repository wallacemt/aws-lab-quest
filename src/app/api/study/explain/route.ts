import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAiModel, extractJsonObject } from "@/lib/ai";
import { prisma } from "@/lib/prisma";

type Body = {
  questionId?: string;
  selectedOption?: "A" | "B" | "C" | "D" | "E";
};

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as Body;
  if (!body.questionId || !body.selectedOption) {
    return NextResponse.json({ error: "Informe questionId e selectedOption." }, { status: 400 });
  }

  const question = await prisma.studyQuestion.findUnique({
    where: { id: body.questionId },
    include: {
      certificationPreset: { select: { code: true, name: true } },
      awsService: { select: { code: true, name: true } },
    },
  });

  if (!question) {
    return NextResponse.json({ error: "Questao nao encontrada." }, { status: 404 });
  }

  try {
    const model = getAiModel();

    const prompt = `
Explique uma questão de certificação AWS em português (pt-BR), de forma didática e objetiva.

Contexto:
- Certificação: ${question.certificationPreset?.name ?? question.certificationPreset?.code ?? "AWS"}
- Assunto: ${question.awsService?.name ?? question.topic}
- Enunciado: ${question.statement}
- Alternativa marcada pelo aluno: ${body.selectedOption}
- Alternativa correta oficial: ${question.correctOption}

Alternativas:
A) ${question.optionA}
B) ${question.optionB}
C) ${question.optionC}
D) ${question.optionD}
E) ${question.optionE ?? "(não aplicável)"}

Regras:
- Retorne APENAS JSON válido (sem markdown).
- JSON deve conter:
{
  "summary": "resumo curto da lógica da questão",
  "options": {
    "A": "por que está certa/errada",
    "B": "por que está certa/errada",
    "C": "por que está certa/errada",
    "D": "por que está certa/errada",
    "E": "por que está certa/errada ou não aplicável"
  }
}
- Seja consistente com a alternativa correta oficial (${question.correctOption}).
- Se uma alternativa não existir, explique como "nao aplicavel".
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonText = extractJsonObject(text);

    if (!jsonText) {
      throw new Error("A IA nao retornou JSON valido.");
    }

    const parsed = JSON.parse(jsonText) as {
      summary?: string;
      options?: Partial<Record<"A" | "B" | "C" | "D" | "E", string>>;
    };

    const normalized = {
      summary: parsed.summary ?? "Resumo indisponivel.",
      options: {
        A: parsed.options?.A ?? question.explanationA ?? "Sem explicacao.",
        B: parsed.options?.B ?? question.explanationB ?? "Sem explicacao.",
        C: parsed.options?.C ?? question.explanationC ?? "Sem explicacao.",
        D: parsed.options?.D ?? question.explanationD ?? "Sem explicacao.",
        E: parsed.options?.E ?? question.explanationE ?? "Nao aplicavel.",
      },
    };

    await prisma.studyQuestion.update({
      where: { id: question.id },
      data: {
        explanationA: normalized.options.A,
        explanationB: normalized.options.B,
        explanationC: normalized.options.C,
        explanationD: normalized.options.D,
        explanationE: normalized.options.E,
      },
    });

    return NextResponse.json({
      summary: normalized.summary,
      options: normalized.options,
      correctOption: question.correctOption,
      selectedOption: body.selectedOption,
    });
  } catch (error) {
    return NextResponse.json(
      {
        summary: "Explicacao offline usando base local.",
        options: {
          A: question.explanationA ?? "Sem explicacao.",
          B: question.explanationB ?? "Sem explicacao.",
          C: question.explanationC ?? "Sem explicacao.",
          D: question.explanationD ?? "Sem explicacao.",
          E: question.explanationE ?? "Nao aplicavel.",
        },
        correctOption: question.correctOption,
        selectedOption: body.selectedOption,
        aiError: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 200 },
    );
  }
}
