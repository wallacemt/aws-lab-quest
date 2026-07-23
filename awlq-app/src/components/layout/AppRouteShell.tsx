"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSimulatedExam } from "@/hooks/useSimulatedExam";
import { useUserProfile } from "@/hooks/useUserProfile";
import { clearOnboardingStep, getOnboardingStep } from "@/lib/onboarding";
import { useAdminModeStore } from "@/stores/adminModeStore";
import { useArenaBattleStore } from "@/stores/arenaBattleStore";
import { findArenaScenario } from "@/lib/arena-scenarios";
import { abandonBattle } from "@/features/arena/services/arena-api";

import type { HomeConfig } from "@/app/api/admin/home-config/route";
import BottomNav from "../ui/bottom-nav";
import RetroLoading from "../ui/retro-loading";
import { Header } from "@/components/layout/header";
import { PixelButton } from "@/components/ui/pixel-button";
import { AdminModePickerModal } from "@/components/layout/AdminModePickerModal";
import Link from "next/link";

type AppRouteShellProps = {
  children: ReactNode;
};

export function AppRouteShell({ children }: AppRouteShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { hydrated, isProfileComplete, profile } = useUserProfile();
  const { mode: adminMode, hydrated: adminModeHydrated, hydrate: hydrateAdminMode, setMode } = useAdminModeStore();
  const isAdmin = profile.role === "admin";
  const [disabledRoutes, setDisabledRoutes] = useState<Set<string>>(new Set());

  const {
    hydrated: simHydrated,
    isActive: simulatedExamActive,
    restoredFromStorage,
    clearSession,
    acknowledgeRestoredSession,
  } = useSimulatedExam();
  const recoveredExamDialogOpen = Boolean(
    simHydrated && simulatedExamActive && restoredFromStorage && pathname !== "/simulado",
  );

  const arenaSession = useArenaBattleStore((s) => s.session);
  const endArenaBattle = useArenaBattleStore((s) => s.endBattle);
  const arenaScenario = useArenaBattleStore((s) => findArenaScenario(s.scenarioId));
  const arenaBattleActive = Boolean(arenaSession);
  const onboardingStep = getOnboardingStep();
  const guardReady =
    hydrated &&
    (!isAdmin || adminModeHydrated) &&
    (isProfileComplete ||
      (onboardingStep === "manual" && pathname === "/help") ||
      (onboardingStep === "profile" && pathname === "/profile") ||
      (!onboardingStep && (pathname === "/profile" || pathname === "/help")));

  useEffect(() => {
    hydrateAdminMode();
  }, [hydrateAdminMode]);

  // Fetch home config once on mount; build a set of disabled route ids for fast lookup
  useEffect(() => {
    void fetch("/api/admin/home-config")
      .then((r) => r.json())
      .then((data: HomeConfig) => {
        const disabled = new Set(data.apps.filter((a) => !a.enabled).map((a) => a.id));
        setDisabledRoutes(disabled);
      })
      .catch(() => undefined); // fail open — never block navigation on config errors
  }, []);

  // Redirect to /home if the user navigates directly to a disabled app route
  useEffect(() => {
    if (!pathname || disabledRoutes.size === 0) return;
    const segment = pathname.slice(1).split("/")[0];
    if (segment && disabledRoutes.has(segment)) {
      router.replace("/home");
    }
  }, [pathname, disabledRoutes, router]);

  useEffect(() => {
    if (!isAdmin || !adminModeHydrated || adminMode !== "admin") return;
    router.replace("/admin");
  }, [isAdmin, adminMode, adminModeHydrated, router]);

  useEffect(() => {
    if (!pathname || !simHydrated) {
      return;
    }

    if (pathname === "/simulado") {
      return;
    }

    if (!simulatedExamActive) {
      return;
    }

    if (restoredFromStorage) {
      return;
    }

    router.replace("/simulado");
  }, [pathname, restoredFromStorage, router, simHydrated, simulatedExamActive]);

  useEffect(() => {
    if (!pathname || !arenaSession || pathname === arenaSession.path) return;
    router.replace(arenaSession.path);
  }, [pathname, arenaSession, router]);

  useEffect(() => {
    if (arenaBattleActive) {
      document.documentElement.setAttribute("data-arena-bg", "1");
    } else {
      document.documentElement.removeAttribute("data-arena-bg");
    }
  }, [arenaBattleActive]);

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

  // Admin chose "admin" mode — redirect is in flight, show loading
  if (isAdmin && adminMode === "admin") {
    return (
      <div className="min-h-screen pb-12">
        <main className="flex min-h-[60vh] items-center justify-center px-4">
          <RetroLoading />
        </main>
      </div>
    );
  }

  // Admin hasn't chosen yet — show the mode picker
  if (isAdmin && adminMode === null) {
    return (
      <AdminModePickerModal
        userName={profile.name || undefined}
        onSelect={(mode) => {
          setMode(mode);
          if (mode === "admin") {
            router.replace("/admin");
          }
        }}
      />
    );
  }

  function handleResumeRecoveredExam() {
    acknowledgeRestoredSession();
    router.replace("/simulado");
  }

  function handleClearRecoveredExam() {
    clearSession();
  }

  async function handleAbandonBattle() {
    const bossId = arenaSession?.bossId;
    endArenaBattle();
    // Await the server-side reset before navigating — otherwise the arena list's
    // fetch on mount can race the DELETE and render the stale (pre-reset) HP.
    if (bossId) await abandonBattle(bossId).catch(() => undefined);
    router.push("/arena");
  }

  return (
    <>
      {arenaBattleActive && (
        <div className="fixed inset-0 z-0 overflow-hidden">
          <video
            key={arenaScenario.videoUrl}
            src={arenaScenario.videoUrl}
            poster={arenaScenario.posterUrl}
            autoPlay
            loop
            muted
            playsInline
            className="h-full w-full object-cover"
            style={{ imageRendering: "pixelated" }}
          />
          {/* darkens + separates the looping backdrop from the static battle panels above it (parallax depth) */}
          <div className="absolute inset-0 backdrop-blur-[2px] bg-black/30" />
        </div>
      )}
      <div className="pixel-bg-adaptive relative z-10 min-h-screen pb-28">
        <Header />
        {simHydrated && simulatedExamActive && pathname !== "/simulado" && (
          <div className="border-b-2 border-red-500 bg-red-900/20 px-4 py-2 text-center font-mono text-[10px] uppercase text-red-300">
            Simulado em andamento. Navegacao bloqueada ate finalizar a prova.
          </div>
        )}
        {arenaBattleActive && (
          <div className="flex flex-wrap items-center justify-center gap-3 border-b-2 border-orange-500 bg-orange-900/20 px-4 py-2 text-center font-mono text-[10px] uppercase text-orange-300">
            <span>Batalha em andamento. Navegacao bloqueada ate finalizar ou abandonar.</span>
            <button type="button" onClick={handleAbandonBattle} className="underline">
              Abandonar
            </button>
          </div>
        )}
        {children}
        {pathname !== "/simulado" && pathname !== arenaSession?.path && (
        <>
          <footer className="pb-2 pt-0 text-center">
            <Link
              href="/privacidade"
              className="font-mono text-[9px] uppercase text-[var(--pixel-subtext)] opacity-60 hover:opacity-100"
            >
              Politica de Privacidade
            </Link>
          </footer>
          <BottomNav />
        </>
      )}
      </div>

      {recoveredExamDialogOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md space-y-4 border-2 border-[var(--pixel-border)] bg-[var(--pixel-card)] p-4 shadow-[6px_6px_0_0_var(--pixel-shadow)]">
            <p className="font-mono text-xs uppercase text-[var(--pixel-primary)]">Simulado pendente detectado</p>
            <p className="font-[var(--font-body)] text-sm text-[var(--pixel-text)]">
              Encontramos uma sessao de simulado anterior. Voce pode retomar agora ou limpar a sessao para seguir
              navegando no app.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <PixelButton variant="ghost" onClick={handleClearRecoveredExam}>
                Limpar sessao
              </PixelButton>
              <PixelButton onClick={handleResumeRecoveredExam}>Retomar simulado</PixelButton>
            </div>
          </div>
        </div>
      )}

      
    </>
  );
}
