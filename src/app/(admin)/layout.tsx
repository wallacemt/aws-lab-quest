import { ReactNode } from "react";
import { AdminShellLayout } from "@/features/admin/screens/AdminShellLayout";

export default function AdminGroupLayout({ children }: { children: ReactNode }) {
  
  return <AdminShellLayout>{children}</AdminShellLayout>;
}
