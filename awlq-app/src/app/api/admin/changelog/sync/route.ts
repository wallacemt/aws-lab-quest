import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

/**
 * POST /api/admin/changelog/sync
 * Enqueues a manual changelog fetch job in the worker via HTTP.
 * The worker must be running and accessible at WORKER_INTERNAL_URL.
 *
 * Note: This uses BullMQ's REST trigger pattern — we cannot import BullMQ
 * directly in Next.js API routes due to the shared-redis dual-connection constraint.
 * Instead, we write a WorkerTrigger row which the trigger-poller picks up.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  // Import prisma lazily to avoid module resolution issues
  const { prisma } = await import("@/lib/prisma");

  await prisma.workerTrigger.create({
    data: {
      action: "changelog-fetch",
      source: "manual",
      payload: { manual: true },
    },
  });

  return NextResponse.json({ ok: true, message: "Changelog sync enqueued." });
}
