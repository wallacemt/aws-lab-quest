import { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminShellLayout } from "@/features/admin/screens/AdminShellLayout";

// LSF-2026-103: gate the whole /admin route group server-side. Without this,
// `children` (the requested admin page, a Server Component) is rendered and its
// RSC payload sent to the browser before AdminShellLayout's client-side check
// ever runs — redirect() here stops that render from happening at all.
export default async function AdminGroupLayout({ children }: { children: ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);

  const user = session?.user
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true, active: true },
      })
    : null;

  if (!user || !user.active || user.role !== "admin") {
    redirect("/admin/login");
  }

  return <AdminShellLayout>{children}</AdminShellLayout>;
}
