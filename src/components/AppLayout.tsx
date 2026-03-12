"use client";

import { ReactNode, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CreatorCredits } from "@/components/CreatorCredits";
import { Header } from "@/components/Header";
import { useUserProfile } from "@/hooks/useUserProfile";
import { clearOnboardingStep, getOnboardingStep } from "@/lib/onboarding";

type AppLayoutProps = {
  children: ReactNode;
  /** Pass current XP to show the XP badge in the header (quest screen only). */
  xp?: number;
  /** Show the CreatorCredits footer. Defaults to false. */
  credits?: boolean;
  /** Render the credits in compact mode. */
  creditsCompact?: boolean;
};

export function AppLayout({ children, xp, credits = false, creditsCompact = false }: AppLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { hydrated, isProfileComplete } = useUserProfile();
  const onboardingStep = getOnboardingStep();

  const guardReady =
    hydrated &&
    (isProfileComplete ||
      (onboardingStep === "manual" && pathname === "/help") ||
      (onboardingStep === "profile" && pathname === "/profile") ||
      (!onboardingStep && (pathname === "/profile" || pathname === "/help")));

  useEffect(() => {
    if (!pathname || !hydrated) {
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
  }, [hydrated, isProfileComplete, onboardingStep, pathname, router]);

  if (!guardReady) {
    return (
      <div className="min-h-screen pb-12">
        <Header xp={xp} />
        <main className="flex min-h-[60vh] items-center justify-center px-4">
          <p className="font-[var(--font-pixel)] text-xs uppercase text-[var(--pixel-subtext)]">Carregando...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12">
      <Header xp={xp} />
      {children}
      {credits && <CreatorCredits compact={creditsCompact} />}
    </div>
  );
}
