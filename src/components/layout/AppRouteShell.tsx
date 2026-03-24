"use client";

import { ReactNode, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSimulatedExam } from "@/hooks/useSimulatedExam";
import { useUserProfile } from "@/hooks/useUserProfile";
import { clearOnboardingStep, getOnboardingStep } from "@/lib/onboarding";
import { getAdminStatus } from "@/features/admin/services/admin-api";

import BottomNav from "../ui/bottom-nav";
import RetroLoading from "../ui/retro-loading";
import { Header } from "@/components/layout/header";

type AppRouteShellProps = {
  children: ReactNode;
};

export function AppRouteShell({ children }: AppRouteShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { hydrated, isProfileComplete, profile } = useUserProfile();
  const { hydrated: simHydrated, isActive: simulatedExamActive } = useSimulatedExam();
  const onboardingStep = getOnboardingStep();
  const guardReady =
    hydrated &&
    (isProfileComplete ||
      (onboardingStep === "manual" && pathname === "/help") ||
      (onboardingStep === "profile" && pathname === "/profile") ||
      (!onboardingStep && (pathname === "/profile" || pathname === "/help")));

  useEffect(() => {
    const checkAdminAndRedirect = async () => {
      try {
        const res = await getAdminStatus();
        if (res.ready) {
          router.replace("/admin");
        }
      } catch {
        return;
      }
    };
    if (profile.role === "admin") {
      checkAdminAndRedirect();
    }
    if (!pathname || !simHydrated) {
      return;
    }

    if (!simulatedExamActive) {
      return;
    }

    if (pathname !== "/simulado") {
      router.replace("/simulado");
    }
  }, [pathname, router, simHydrated, simulatedExamActive, profile.role]);

  useEffect(() => {
    if (!pathname || !hydrated) {
      return;
    }

    if (simHydrated && simulatedExamActive && pathname !== "/simulado") {
      return;
    }

    if (isProfileComplete) {
      if (onboardingStep) {
        clearOnboardingStep();
      }
      return;
    }

    if (onboardingStep === "manual") {
      if (pathname !== "/help") {
        router.replace("/help");
      }
      return;
    }

    if (onboardingStep === "profile") {
      if (pathname !== "/profile") {
        router.replace("/profile");
      }
      return;
    }

    if (pathname === "/profile" || pathname === "/help") {
      return;
    }

    router.replace("/profile");
  }, [hydrated, isProfileComplete, onboardingStep, pathname, router, simHydrated, simulatedExamActive]);

  if (!guardReady) {
    return (
      <div className="min-h-screen pb-12">
        <main className="flex min-h-[60vh] items-center justify-center px-4">
          <RetroLoading />
        </main>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen pb-28">
        <Header />
        {simHydrated && simulatedExamActive && pathname !== "/simulado" && (
          <div className="border-b-2 border-red-500 bg-red-900/20 px-4 py-2 text-center font-mono text-[10px] uppercase text-red-300">
            Simulado em andamento. Navegacao bloqueada ate finalizar a prova.
          </div>
        )}
        {children}
      </div>
      <BottomNav />
    </>
  );
}
