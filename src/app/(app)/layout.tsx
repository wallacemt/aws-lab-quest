import { ReactNode } from "react";
import { AppRouteShell } from "@/components/layout/AppRouteShell";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider>
      <AppRouteShell>{children}</AppRouteShell>;
    </TooltipProvider>
  );
}
