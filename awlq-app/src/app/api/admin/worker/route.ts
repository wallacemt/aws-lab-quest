import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (!authResult.ok) return authResult.response;

    const [
      ingestionSources,
      blueprintDomains,
      weakAreaReports,
      performanceStats,
      certifications,
      triggerHistory,
      triggerStats,
    ] = await Promise.all([
      prisma.ingestionSource.findMany({
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          displayName: true,
          url: true,
          status: true,
          lastFetchedAt: true,
          parsedDomainCount: true,
          generatedQuestionCount: true,
          errorMessage: true,
          active: true,
          certificationPreset: { select: { code: true, name: true } },
        },
      }),
      prisma.examBlueprintDomain.groupBy({
        by: ["certificationPresetId"],
        _count: { id: true },
        _sum: { weightPercent: true },
      }),
      prisma.weakAreaReport.findMany({
        orderBy: { analyzedAt: "desc" },
        take: 20,
        select: {
          id: true,
          analyzedAt: true,
          windowDays: true,
          sessionsAnalyzed: true,
          generationQueued: true,
          weakAreas: true,
          certificationPreset: { select: { code: true, name: true } },
        },
      }),
      prisma.questionPerformance.groupBy({
        by: ["flaggedForReview", "reviewResult"],
        _count: { id: true },
      }),
      prisma.certificationPreset.findMany({
        where: { active: true },
        select: { id: true, code: true, name: true },
        orderBy: { displayOrder: "asc" },
      }),
      prisma.workerTrigger.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          action: true,
          certificationPresetId: true,
          processed: true,
          processedAt: true,
          createdAt: true,
        },
      }),
      prisma.workerTrigger.groupBy({
        by: ["action", "processed"],
        _count: { id: true },
      }),
    ]);

    const flagged = performanceStats
      .filter((r) => r.flaggedForReview)
      .reduce((s, r) => s + r._count.id, 0);
    const improved = performanceStats
      .filter((r) => r.reviewResult === "improved")
      .reduce((s, r) => s + r._count.id, 0);
    const retired = performanceStats
      .filter((r) => r.reviewResult === "retired")
      .reduce((s, r) => s + r._count.id, 0);

    const certMap = new Map(certifications.map((c) => [c.id, c]));
    const blueprintStats = blueprintDomains.map((row) => ({
      certificationPresetId: row.certificationPresetId,
      cert: certMap.get(row.certificationPresetId) ?? null,
      domainCount: row._count.id,
      totalWeight: row._sum.weightPercent ?? 0,
    }));

    const queueStats = triggerStats.reduce<Record<string, { total: number; pending: number; processed: number }>>(
      (acc, row) => {
        const action = row.action;
        if (!acc[action]) acc[action] = { total: 0, pending: 0, processed: 0 };
        acc[action].total += row._count.id;
        if (row.processed) acc[action].processed += row._count.id;
        else acc[action].pending += row._count.id;
        return acc;
      },
      {}
    );

    return NextResponse.json({
      ingestionSources,
      blueprintStats,
      weakAreaReports,
      performance: { flagged, improved, retired },
      certifications,
      triggerHistory,
      queueStats,
    });
  } catch (error) {
    console.error("GET /api/admin/worker error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAdmin(req);
    if (!authResult.ok) return authResult.response;

    let body;
    try {
      body = (await req.json()) as {
        action: string;
        certificationPresetId?: string;
      };
    } catch {
      return NextResponse.json(
        { error: "JSON inválido" },
        { status: 400 }
      );
    }

    const validActions = ["generate", "analyze-feedback", "fetch-sources", "quality-scan"];
    if (!validActions.includes(body.action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    await prisma.workerTrigger.create({
      data: {
        action: body.action,
        certificationPresetId: body.certificationPresetId ?? null,
      },
    });

    return NextResponse.json({ ok: true, action: body.action });
  } catch (error) {
    console.error("POST /api/admin/worker error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
