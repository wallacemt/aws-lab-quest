import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { parseQuestionJson } from "@/lib/question-import";
import { prepareQuestionImport } from "@/lib/question-import-server";

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.response;
  let prepared;
  let dryRun = false;
  try {
    const source = await request.text();
    const questions = parseQuestionJson(source);
    const body = JSON.parse(source.replace(/^\uFEFF/, ""));
    const defaultCode = body.defaultCertificationCode;
    if (defaultCode !== undefined && (typeof defaultCode !== "string" || !defaultCode.trim())) throw new Error("Certificação inválida");
    if (body.dryRun !== undefined && typeof body.dryRun !== "boolean") throw new Error("dryRun inválido");
    dryRun = body.dryRun === true;
    prepared = await prepareQuestionImport(questions, defaultCode);
  } catch (error) {
    return NextResponse.json({ errors: [error instanceof Error ? error.message : "JSON inválido"] }, { status: 422 });
  }
  if (dryRun) return NextResponse.json({ dryRun: true, count: prepared.count, previewItems: prepared.previewItems });
  const ids = await prisma.$transaction(tx => prepared.create(tx), { timeout: 30000 });
  return NextResponse.json({ created: ids.length, ids }, { status: 201 });
}
