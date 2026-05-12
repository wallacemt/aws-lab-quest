import { createHash, randomUUID } from "node:crypto";
import { StudyQuestionDifficulty, StudyQuestionUsage } from "@prisma/client";
import { extractJsonObject, getAiModel } from "@/lib/ai";
import { prisma } from "@/lib/prisma";

type ParsedOption = {
  content: string;
  explanation: string | null;
  isCorrect: boolean;
};

type ParsedVariant = {
  statement: string;
  topic: string;
  questionType: "single" | "multi";
  options: ParsedOption[];
};

type SourceQuestion = {
  id: string;
  statement: string;
  topic: string;
  difficulty: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionE: string | null;
  correctOption: string;
  certificationPresetId: string | null;
  certificationPreset: { code: string; name: string } | null;
};

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function buildVariantPrompt(source: SourceQuestion, certCode: string): string {
  const options = [
    `A) ${source.optionA}`,
    `B) ${source.optionB}`,
    `C) ${source.optionC}`,
    `D) ${source.optionD}`,
    source.optionE ? `E) ${source.optionE}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return [
    "Voce e um gerador de questoes de certificacao AWS.",
    `Certificacao: ${certCode}.`,
    "Abaixo esta uma questao original. Gere UMA variante MAIS DIFICIL sobre o mesmo topico.",
    "",
    "QUESTAO ORIGINAL:",
    source.statement,
    "",
    "OPCOES ORIGINAIS:",
    options,
    `RESPOSTA CORRETA: ${source.correctOption}`,
    "",
    "INSTRUCOES PARA A VARIANTE:",
    "- Mantenha o topico: " + source.topic,
    "- Dificuldade: hard",
    "- Adicione mais contexto, restricoes ou requisitos de arquitetura",
    "- As opcoes incorretas devem ser mais plausíveis",
    "- Em portugues brasileiro",
    "- Retorne SOMENTE JSON valido, sem markdown:",
    '{ "questions": [ { "statement": "...", "topic": "...", "questionType": "single", "options": [ { "content": "...", "explanation": "...", "isCorrect": true/false } ] } ] }',
    "- options: minimo 4, maximo 5 itens, apenas uma correta",
    "- explanation de cada opcao: minimo 40 caracteres",
  ].join("\n");
}

function parseVariantFromAi(text: string, fallbackTopic: string): ParsedVariant | null {
  const jsonStr = extractJsonObject(text);
  if (!jsonStr) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;
  const root = parsed as Record<string, unknown>;
  const questions = Array.isArray(root.questions) ? root.questions : Array.isArray(root) ? root : null;
  const raw = Array.isArray(questions) ? questions[0] : null;
  if (!raw || typeof raw !== "object") return null;

  const q = raw as Record<string, unknown>;
  const statement = normalizeText(String(q.statement ?? ""));
  if (statement.length < 20) return null;

  const optionsRaw = Array.isArray(q.options) ? q.options : [];
  const options: ParsedOption[] = optionsRaw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const content = normalizeText(String(o.content ?? o.text ?? ""));
      if (!content) return null;
      return {
        content,
        explanation: normalizeText(String(o.explanation ?? "")) || null,
        isCorrect: Boolean(o.isCorrect),
      };
    })
    .filter((item): item is ParsedOption => item !== null)
    .slice(0, 5);

  if (options.length < 4) return null;
  if (!options.some((o) => o.isCorrect)) options[0].isCorrect = true;

  const multiCount = options.filter((o) => o.isCorrect).length;
  const questionType: "single" | "multi" = q.questionType === "multi" && multiCount > 1 ? "multi" : "single";
  if (questionType === "single" && multiCount > 1) {
    let marked = false;
    for (const o of options) {
      if (o.isCorrect && !marked) { marked = true; continue; }
      o.isCorrect = false;
    }
  }

  return {
    statement,
    topic: normalizeText(String(q.topic ?? "")) || fallbackTopic,
    questionType,
    options,
  };
}

function buildUsageHash(variant: ParsedVariant): string {
  const canonical = [
    variant.statement.toLowerCase(),
    variant.topic.toLowerCase(),
    ...variant.options.map((o) => `${o.content.toLowerCase()}:${o.isCorrect ? "1" : "0"}`),
  ].join("|");
  return createHash("sha256").update(canonical).digest("hex");
}

export async function generateAndSaveVariant(source: SourceQuestion): Promise<string | null> {
  const certCode = source.certificationPreset?.code ?? "AWS";
  const prompt = buildVariantPrompt(source, certCode);

  let raw = "";
  try {
    const model = getAiModel();
    const response = await model.generateContent(prompt);
    raw = response.response.text();
  } catch {
    return null;
  }

  const variant = parseVariantFromAi(raw, source.topic);
  if (!variant) return null;

  const usageHash = buildUsageHash(variant);

  const correctOptions = variant.questionType === "multi"
    ? variant.options.map((o, i) => o.isCorrect ? ["A", "B", "C", "D", "E"][i] : null).filter(Boolean)
    : [];

  const optA = variant.options[0]?.content ?? "";
  const optB = variant.options[1]?.content ?? "";
  const optC = variant.options[2]?.content ?? "";
  const optD = variant.options[3]?.content ?? "";
  const optE = variant.options[4]?.content ?? null;

  const correctIdx = variant.options.findIndex((o) => o.isCorrect);
  const correctOption = (["A", "B", "C", "D", "E"][correctIdx] ?? "A") as string;

  try {
    const created = await prisma.studyQuestion.create({
      data: {
        id: randomUUID(),
        externalId: `variant-${source.id}-${Date.now()}`,
        statement: variant.statement,
        topic: variant.topic,
        usage: StudyQuestionUsage.SIMULADO,
        difficulty: StudyQuestionDifficulty.hard,
        questionType: variant.questionType as "single" | "multi",
        optionA: optA,
        optionB: optB,
        optionC: optC,
        optionD: optD,
        optionE: optE,
        correctOption,
        correctOptions: correctOptions.length > 0 ? correctOptions : undefined,
        explanationA: variant.options[0]?.explanation ?? null,
        explanationB: variant.options[1]?.explanation ?? null,
        explanationC: variant.options[2]?.explanation ?? null,
        explanationD: variant.options[3]?.explanation ?? null,
        explanationE: variant.options[4]?.explanation ?? null,
        usageHash,
        active: true,
        certificationPresetId: source.certificationPresetId ?? undefined,
        questionOptions: {
          create: variant.options.map((o, i) => ({
            order: i,
            content: o.content,
            isCorrect: o.isCorrect,
            explanation: o.explanation ?? "",
          })),
        },
      },
      select: { id: true },
    });
    return created.id;
  } catch {
    // usageHash collision ou outro erro de persistência — ignorar silenciosamente
    return null;
  }
}
