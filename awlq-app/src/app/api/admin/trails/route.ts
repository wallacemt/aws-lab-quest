import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/trails
 * Lists all QuestChains with their stages and a per-chain count of users
 * who have any progress on that chain.
 *
 * POST /api/admin/trails
 * Creates a new QuestChain.
 * Body: { name, description?, certificationPresetId?, displayOrder? }
 */

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const chains = await prisma.questChain.findMany({
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    include: {
      stages: {
        orderBy: { position: "asc" },
      },
    },
  });

  // QuestChain.certificationPresetId has no Prisma relation to CertificationPreset
  // (it's a plain string column), so resolve display labels with a separate lookup.
  const certPresetIds = [...new Set(chains.map((c) => c.certificationPresetId).filter((id): id is string => id !== null))];
  const certPresets = certPresetIds.length
    ? await prisma.certificationPreset.findMany({
        where: { id: { in: certPresetIds } },
        select: { id: true, code: true, name: true },
      })
    : [];
  const certPresetById = new Map(certPresets.map((c) => [c.id, { code: c.code, name: c.name }]));

  // Count distinct users with progress on each chain
  const chainIds = chains.map((c) => c.id);

  // Map chainId → user count via stage lookup
  const stageToChain = new Map<string, string>();
  for (const chain of chains) {
    for (const stage of chain.stages) {
      stageToChain.set(stage.id, chain.id);
    }
  }

  const allProgress = await prisma.questChainProgress.findMany({
    where: { stage: { chainId: { in: chainIds } } },
    select: { userId: true, stageId: true },
  });

  const userCountByChain = new Map<string, Set<string>>();
  for (const p of allProgress) {
    const chainId = stageToChain.get(p.stageId);
    if (!chainId) continue;
    if (!userCountByChain.has(chainId)) userCountByChain.set(chainId, new Set());
    userCountByChain.get(chainId)!.add(p.userId);
  }

  const result = chains.map((chain) => ({
    ...chain,
    userCount: userCountByChain.get(chain.id)?.size ?? 0,
    certificationPreset: chain.certificationPresetId ? (certPresetById.get(chain.certificationPresetId) ?? null) : null,
  }));

  return NextResponse.json({ chains: result });
}

type CreateChainBody = {
  name?: string;
  description?: string;
  certificationPresetId?: string;
  displayOrder?: number;
};

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = (await request.json()) as CreateChainBody;

  if (!body.name || body.name.trim().length === 0) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const chain = await prisma.questChain.create({
    data: {
      name: body.name.trim(),
      description: body.description?.trim() ?? null,
      certificationPresetId: body.certificationPresetId ?? null,
      displayOrder: typeof body.displayOrder === "number" ? body.displayOrder : 0,
    },
  });

  return NextResponse.json({ chain }, { status: 201 });
}
