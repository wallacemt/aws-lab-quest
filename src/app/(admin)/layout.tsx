import { ReactNode } from "react";
import { AdminShellLayout } from "@/features/admin/components/AdminShellLayout";

export default function AdminGroupLayout({ children }: { children: ReactNode }) {
  return <AdminShellLayout>{children}</AdminShellLayout>;
}
