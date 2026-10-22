import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ImportItem } from "./question-import";

export async function prepareQuestionImport(questions: ImportItem[], defaultCertificationCode?: string) {
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

  const missing = certCodes.filter(code => !certMap.has(code));
  if (missing.length) throw new Error(`Certificação não encontrada: ${missing.join(", ")}`);

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

  return {
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
    count: questions.length,
    async create(tx: Prisma.TransactionClient, forcedCertificationId?: string) {
      const created: string[] = [];

      for (const q of questions) {
        const certCode = q.certificationCode ?? defaultCertificationCode;
        const certId = forcedCertificationId ?? (certCode ? certMap.get(certCode) : undefined);

        const correctOptions = q.correctOptions ?? (q.correctOption ? [q.correctOption] : []);
        const isMulti = q.questionType === "multi" || correctOptions.length > 1;

        const externalId = `import-${crypto.randomUUID()}`;

        const record = await tx.studyQuestion.create({
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
          await tx.questionAwsService.createMany({
            data: allServiceIds.map((serviceId) => ({ questionId: record.id, serviceId })),
            skipDuplicates: true,
          });
        }

        created.push(record.id);
      }

      return created;
    },
  };
}
