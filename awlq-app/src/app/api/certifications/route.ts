import { NextResponse } from "next/server";
import { listActiveCertificationPresets } from "@/lib/certification-service";

export async function GET() {
  const certifications = await listActiveCertificationPresets();
  return NextResponse.json({ certifications });
}
