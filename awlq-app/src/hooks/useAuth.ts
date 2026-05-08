"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function useAuth() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();

  async function signOut() {
    await authClient.signOut();
    router.replace("/login");
  }

  return {
    session,
    user: session?.user ?? null,
    isAuthenticated: Boolean(session?.user),
    isPending,
    signOut,
  };
}
