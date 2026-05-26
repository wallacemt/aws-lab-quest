import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

type ImportItem = {
  statement: string;
  options: Partial<Record<"A" | "B" | "C" | "D" | "E", string>>;
  correctOption?: string;
  correctOptions?: string[];
  difficulty?: "easy" | "medium" | "hard";
  questionType?: "single" | "multi";
  topic?: string;
  certificationCode?: string;
  explanations?: Partial<Record<"A" | "B" | "C" | "D" | "E", string>>;
  awsServiceCodes?: string[];   // match exato por code
  awsServiceNames?: string[];   // match fuzzy por name/code (gerado pelo extrator)
};

type Body = {
  questions: ImportItem[];
  defaultCertificationCode?: string;
  dryRun?: boolean;
};

const VALID_OPTIONS = new Set(["A", "B", "C", "D", "E"]);
const VALID_DIFFICULTY = new Set(["easy", "medium", "hard", "nightmare"]);

function validateItem(item: ImportItem, index: number): string | null {
  if (!item.statement?.trim()) return `Item ${index + 1}: statement obrigatorio`;
  if (!item.options || Object.keys(item.options).length < 2) return `Item ${index + 1}: minimo 2 opcoes`;
  if (!item.correctOption && (!item.correctOptions || item.correctOptions.length === 0))
    return `Item ${index + 1}: correctOption ou correctOptions obrigatorio`;
  const correct = item.correctOptions ?? (item.correctOption ? [item.correctOption] : []);
  for (const c of correct) {
    if (!VALID_OPTIONS.has(c)) return `Item ${index + 1}: opcao correta invalida '${c}'`;
    if (!item.options[c as "A"]) return `Item ${index + 1}: opcao correta '${c}' nao existe nas opcoes`;
  }
  if (item.difficulty && !VALID_DIFFICULTY.has(item.difficulty))
    return `Item ${index + 1}: difficulty invalida '${item.difficulty}'`;
  return null;
}

export async function POST(request: NextRequest) {
  const adminResult = await requireAdmin(request);
  if (!adminResult.ok) return adminResult.response;

  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body || !Array.isArray(body.questions)) {
    return NextResponse.json({ error: "Payload invalido: esperado { questions: [...] }" }, { status: 400 });
  }

  const { questions, defaultCertificationCode, dryRun = false } = body;

  if (questions.length === 0) {
    return NextResponse.json({ error: "Lista de questoes vazia" }, { status: 400 });
  }
  if (questions.length > 200) {
    return NextResponse.json({ error: "Maximo 200 questoes por importacao" }, { status: 400 });
  }

  const errors: string[] = [];
  for (let i = 0; i < questions.length; i++) {
    const err = validateItem(questions[i]!, i);
    if (err) errors.push(err);
  }
  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 422 });
  }

  const certCodes = Array.from(
    new Set(
      questions
        .map((q) => q.certificationCode ?? defaultCertificationCode)
        .filter((c): c is string => Boolean(c)),
    ),
  );

  const certMap = new Map<string, string>();
  if (certCodes.length > 0) {
    const presets = await prisma.certificationPreset.findMany({
      where: { code: { in: certCodes } },
      select: { id: true, code: true },
    });
    for (const p of presets) certMap.set(p.code, p.id);
  }

  // Pass 1 — match exato por code (awsServiceCodes)
  const allServiceCodes = Array.from(
    new Set(questions.flatMap((q) => q.awsServiceCodes ?? [])),
  );
  const serviceCodeMap = new Map<string, string>(); // code → id
  if (allServiceCodes.length > 0) {
    const svcs = await prisma.awsService.findMany({
      where: { code: { in: allServiceCodes } },
      select: { id: true, code: true },
    });
    for (const s of svcs) serviceCodeMap.set(s.code, s.id);
  }

  // Pass 2 — match fuzzy por nome (awsServiceNames gerado pelo extrator)
  const allServiceNames = Array.from(
    new Set(questions.flatMap((q) => q.awsServiceNames ?? [])),
  );
  const serviceNameMap = new Map<string, string>(); // nome normalizado → id
  if (allServiceNames.length > 0) {
    const allSvcs = await prisma.awsService.findMany({
      where: { active: true },
      select: { id: true, code: true, name: true },
    });
    for (const rawName of allServiceNames) {
      const normalized = rawName.toLowerCase().trim();
      // Tenta: código exato (case-insensitive)
      const byCode = allSvcs.find((s) => s.code.toLowerCase() === normalized);
      if (byCode) { serviceNameMap.set(normalized, byCode.id); continue; }
      // Tenta: nome contém o termo OU termo contém o código do serviço
      const byName = allSvcs.find(
        (s) =>
          s.name.toLowerCase().includes(normalized) ||
          normalized.includes(s.code.toLowerCase()),
      );
      if (byName) { serviceNameMap.set(normalized, byName.id); }
    }
  }

  // Mapa unificado retrocompatível para uso no loop abaixo
  const serviceMap = serviceCodeMap;

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      count: questions.length,
      previewItems: questions.slice(0, 10).map((q, i) => ({
        index: i + 1,
        statement: q.statement.slice(0, 120),
        difficulty: q.difficulty ?? "medium",
        questionType: q.questionType ?? "single",
        certificationCode: q.certificationCode ?? defaultCertificationCode ?? null,
        resolvedServiceIds: [
          ...(q.awsServiceCodes ?? []).map((c) => serviceMap.get(c)).filter(Boolean),
          ...(q.awsServiceNames ?? []).map((n) => serviceNameMap.get(n.toLowerCase().trim())).filter(Boolean),
        ].length,
        awsServiceNames: q.awsServiceNames ?? [],
        awsServiceCodes: q.awsServiceCodes ?? [],
      })),
    });
  }

  const created: string[] = [];

  for (const q of questions) {
    const certCode = q.certificationCode ?? defaultCertificationCode;
    const certId = certCode ? certMap.get(certCode) : undefined;

    const correctOptions = q.correctOptions ?? (q.correctOption ? [q.correctOption] : []);
    const isMulti = q.questionType === "multi" || correctOptions.length > 1;

    const externalId = `import-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const record = await prisma.studyQuestion.create({
      data: {
        externalId,
        statement: q.statement.trim(),
        topic: q.topic?.trim() ?? "OUTROS",
        difficulty: q.difficulty ?? "medium",
        questionType: isMulti ? "multi" : "single",
        usage: "SIMULADO",
        active: true,
        certificationPresetId: certId ?? null,
        optionA: q.options.A ?? "",
        optionB: q.options.B ?? "",
        optionC: q.options.C ?? "",
        optionD: q.options.D ?? "",
        optionE: q.options.E ?? null,
        correctOption: correctOptions[0] ?? "A",
        correctOptions: isMulti ? correctOptions : undefined,
        explanationA: q.explanations?.A ?? null,
        explanationB: q.explanations?.B ?? null,
        explanationC: q.explanations?.C ?? null,
        explanationD: q.explanations?.D ?? null,
        explanationE: q.explanations?.E ?? null,
      },
      select: { id: true },
    });

    const codeIds = (q.awsServiceCodes ?? [])
      .map((code) => serviceMap.get(code))
      .filter((id): id is string => Boolean(id));

    const nameIds = (q.awsServiceNames ?? [])
      .map((name) => serviceNameMap.get(name.toLowerCase().trim()))
      .filter((id): id is string => Boolean(id));

    const allServiceIds = Array.from(new Set([...codeIds, ...nameIds]));
    if (allServiceIds.length > 0) {
      await prisma.questionAwsService.createMany({
        data: allServiceIds.map((serviceId) => ({ questionId: record.id, serviceId })),
        skipDuplicates: true,
      });
    }

    created.push(record.id);
  }

  return NextResponse.json({ created: created.length, ids: created }, { status: 201 });
}
