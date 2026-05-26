import { NextRequest, NextResponse } from "next/server";
import { getUserAchievementSummary } from "@/lib/achievements";
import { requireAdmin } from "@/lib/admin-auth";
import { devAuditLog } from "@/lib/dev-audit";
import { getLevel } from "@/lib/levels";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

type PatchBody = {
  name?: string;
  username?: string;
  role?: string;
  accessStatus?: "pending" | "approved" | "rejected";
  accessDecisionReason?: string;
  active?: boolean;
  certificationPresetId?: string | null;
};

async function ensureNotLastActiveAdmin(userId: string, nextRole?: string, nextActive?: boolean): Promise<boolean> {
  const current = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, active: true } });
  if (!current) {
    return false;
  }

  const roleAfter = nextRole ?? current.role;
  const activeAfter = typeof nextActive === "boolean" ? nextActive : current.active;

  if (!(current.role === "admin" && current.active)) {
    return true;
  }

  if (roleAfter === "admin" && activeAfter) {
    return true;
  }

  const activeAdmins = await prisma.user.count({ where: { role: "admin", active: true } });
  return activeAdmins > 1;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const { userId } = await context.params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      role: true,
      accessStatus: true,
      active: true,
      lastSeen: true,
      createdAt: true,
      profile: {
        select: { avatarUrl: true, certification: true, favoriteTheme: true },
      },
      _count: {
        select: { questHistory: true, studyHistory: true },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Usuario nao encontrado." }, { status: 404 });
  }

  const [questAggregate, studyAggregate, allStudySessions, recentLabs, achievements] = await Promise.all([
    prisma.questHistory.aggregate({ where: { userId }, _sum: { xp: true } }),
    prisma.studySessionHistory.aggregate({ where: { userId }, _sum: { gainedXp: true }, _avg: { scorePercent: true } }),
    prisma.studySessionHistory.findMany({
      where: { userId },
      select: {
        id: true,
        sessionType: true,
        title: true,
        certificationCode: true,
        gainedXp: true,
        scorePercent: true,
        correctAnswers: true,
        totalQuestions: true,
        durationSeconds: true,
        completedAt: true,
        pack: { select: { name: true, artworkUrl: true } },
      },
      orderBy: { completedAt: "desc" },
    }),
    prisma.questHistory.findMany({
      where: { userId },
      orderBy: { completedAt: "desc" },
      take: 20,
      select: { id: true, title: true, theme: true, xp: true, tasksCount: true, completedAt: true, certification: true, userName: true, sourceLabText: true, taskSnapshot: true },
    }),
    getUserAchievementSummary(userId),
  ]);

  const totalXp = (questAggregate._sum.xp ?? 0) + (studyAggregate._sum.gainedXp ?? 0);
  const currentLevel = getLevel(totalXp);

  const certMap = new Map<string, { sessions: number; totalScore: number }>();
  for (const s of allStudySessions) {
    const code = s.certificationCode ?? "outros";
    const entry = certMap.get(code) ?? { sessions: 0, totalScore: 0 };
    entry.sessions += 1;
    entry.totalScore += s.scorePercent;
    certMap.set(code, entry);
  }
  const certBreakdown = Array.from(certMap.entries()).map(([code, data]) => ({
    code,
    sessions: data.sessions,
    avgScore: Math.round(data.totalScore / data.sessions),
  }));

  const recentSessions = allStudySessions.slice(0, 20).map((s) => ({
    ...s,
    pack: undefined,
    packName: s.pack?.name ?? null,
    packArtworkUrl: s.pack?.artworkUrl ?? null,
  }));

  const weakAreas = allStudySessions
    .filter((s) => s.scorePercent < 50)
    .slice(0, 10)
    .map((s) => ({ ...s, pack: undefined, packName: s.pack?.name ?? null, packArtworkUrl: s.pack?.artworkUrl ?? null }));

  const strongAreas = allStudySessions
    .filter((s) => s.scorePercent >= 80)
    .slice(0, 10)
    .map((s) => ({ ...s, pack: undefined, packName: s.pack?.name ?? null, packArtworkUrl: s.pack?.artworkUrl ?? null }));

  return NextResponse.json({
    user: {
      ...user,
      labsCompleted: user._count.questHistory,
      studySessions: user._count.studyHistory,
      _count: undefined,
    },
    totalXp,
    currentLevel,
    avgScore: Math.round(studyAggregate._avg.scorePercent ?? 0),
    certBreakdown,
    weakAreas,
    strongAreas,
    recentSessions,
    recentLabs,
    achievements,
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const { userId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as PatchBody;
  devAuditLog("admin.users.patch.request", {
    adminUserId: adminCheck.userId,
    userId,
    fields: Object.keys(body ?? {}),
  });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "Usuario nao encontrado." }, { status: 404 });
  }

  const allowed = await ensureNotLastActiveAdmin(userId, body.role, body.active);
  if (!allowed) {
    return NextResponse.json({ error: "Nao e permitido remover o ultimo admin ativo." }, { status: 400 });
  }

  const data: {
    name?: string;
    username?: string | null;
    role?: string;
    accessStatus?: "pending" | "approved" | "rejected";
    accessDecisionReason?: string;
    accessDecisionAt?: Date;
    active?: boolean;
  } = {};

  if (typeof body.name === "string" && body.name.trim()) {
    data.name = body.name.trim();
  }

  if (typeof body.username === "string") {
    data.username = body.username.trim() || null;
  }

  // LSF-2026-005: allowlist role values to prevent arbitrary role strings in DB
  const ALLOWED_ROLES = new Set(["admin", "user"]);
  if (typeof body.role === "string" && ALLOWED_ROLES.has(body.role.trim())) {
    data.role = body.role.trim();
  }

  if (body.accessStatus === "pending" || body.accessStatus === "approved" || body.accessStatus === "rejected") {
    data.accessStatus = body.accessStatus;
    data.accessDecisionAt = new Date();
    data.accessDecisionReason = body.accessDecisionReason?.trim() || `Status alterado para ${body.accessStatus}.`;
  }

  if (typeof body.active === "boolean") {
    data.active = body.active;
  }

  await prisma.user.update({ where: { id: userId }, data });

  if ("certificationPresetId" in body) {
    const presetId = body.certificationPresetId ?? null;
    await prisma.userProfile.upsert({
      where: { userId },
      create: { userId, certificationPresetId: presetId, certification: "" },
      update: { certificationPresetId: presetId },
    });
  }

  devAuditLog("admin.users.patch.completed", {
    adminUserId: adminCheck.userId,
    userId,
    fields: Object.keys(data),
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const { userId } = await context.params;
  devAuditLog("admin.users.delete.request", { adminUserId: adminCheck.userId, userId });

  const allowed = await ensureNotLastActiveAdmin(userId, undefined, false);
  if (!allowed) {
    return NextResponse.json({ error: "Nao e permitido desativar o ultimo admin ativo." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "Usuario nao encontrado." }, { status: 404 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      active: false,
      accessDecisionAt: new Date(),
      accessDecisionReason: "Conta desativada pelo administrador.",
    },
  });

  devAuditLog("admin.users.delete.completed", { adminUserId: adminCheck.userId, userId });

  return NextResponse.json({ ok: true });
}
