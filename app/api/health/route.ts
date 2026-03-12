import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const start = Date.now();

  let dbStatus: "ok" | "error" = "error";
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = "ok";
  } catch {
    dbStatus = "error";
  }

  return NextResponse.json({
    status: dbStatus === "ok" ? "ok" : "degraded",
    db: dbStatus,
    uptime: process.uptime(),
    responseTime: `${Date.now() - start}ms`,
    timestamp: new Date().toISOString(),
  });
}
