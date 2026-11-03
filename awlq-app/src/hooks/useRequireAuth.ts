"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export function useRequireAuth() {
  const { isAuthenticated, isPending } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const requireAuth = useCallback(() => {
    if (isPending || !isAuthenticated) {
      router.push(`/login?from=${encodeURIComponent(pathname || "/")}`);
      return false;
    }
    return true;
  }, [isAuthenticated, isPending, pathname, router]);

  return { requireAuth };
}
