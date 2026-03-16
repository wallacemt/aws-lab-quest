import { ReactNode } from "react";
import { AppRouteShell } from "@/components/layout/AppRouteShell";

export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return <AppRouteShell>{children}</AppRouteShell>;
}
