"use client";

import { memo, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FontSizeControl } from "@/components/FontSizeControl";
import { LevelBadge } from "@/components/ui/LevelBadge";
import { NavBar } from "@/components/NavBar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { useOnlineUsers } from "@/hooks/useOnlineUsers";
import { useSimulatedExam } from "@/hooks/useSimulatedExam";
import { useTheme } from "next-themes";
import Image from "next/image";
import { useUserProfile } from "@/hooks/useUserProfile";
import appLogo from "@/assets/logo.png";

type HeaderProps = {
  /** Pass XP to show the XP badge (e.g. on the quest screen). Omit on other screens. */
  xp?: number;
};

function HeaderComponent({ xp }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [totalXp, setTotalXp] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const { user, signOut } = useAuth();
  const { onlineCount } = useOnlineUsers();
  const { isActive: simulatedExamActive, remainingSeconds } = useSimulatedExam();
  const router = useRouter();
  const { avatarUrl, profile } = useUserProfile();
  const name = profile?.username ?? "Anônimo";
  const displayedXp = totalXp + (xp ?? 0);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!user) return;
    Promise.all([fetch("/api/quest-history"), fetch("/api/study/history")])
      .then(async ([questRes, studyRes]) => {
        const questData = (await questRes.json()) as { history?: { xp: number }[] };
        const studyData = (await studyRes.json()) as { history?: { gainedXp?: number }[] };

        const labsXp = (questData.history ?? []).reduce((sum, item) => sum + item.xp, 0);
        const studyXp = (studyData.history ?? []).reduce((sum, item) => sum + (item.gainedXp ?? 0), 0);

        const nextTotalXp = labsXp + studyXp;
        setTotalXp(nextTotalXp);
      })
      .catch(() => void 0);
  }, [user]);

  async function handleSignOut() {
    setDropdownOpen(false);
    setMobileMenuOpen(false);
    await signOut();
    router.replace("/login");
  }

  const simMinutes = Math.floor(Math.max(0, remainingSeconds) / 60)
    .toString()
    .padStart(2, "0");
  const simSeconds = (Math.max(0, remainingSeconds) % 60).toString().padStart(2, "0");
  const simTimerLabel = `${simMinutes}:${simSeconds}`;

  return (
    <header className="sticky top-0 z-30 border-b-2 border-[var(--pixel-border)] bg-[var(--pixel-bg)]/90 backdrop-blur">
      {/* Main bar */}
      <div className="mx-auto flex w-full max-w-[1600px] items-center gap-3 px-4 py-3 xl:px-8">
        {/* Logo */}
        <Link href="/" className="flex min-w-0 items-center gap-3" onClick={() => setMobileMenuOpen(false)}>
          <div className={`pixel-cloud-icon ${theme === "dark" ? "bg-primary" : ""}`} aria-hidden="true">
            <Image src={appLogo} alt="AWS Lab Quest logo" height={260} width={260} />
          </div>
          <div className="hidden min-w-0 sm:block">
            <p className="truncate font-[var(--font-pixel)] text-xs text-[var(--pixel-primary)]">AWS LAB QUEST</p>
            <p className="truncate font-[var(--font-body)] text-sm text-[var(--pixel-subtext)]">Player: @{name}</p>
          </div>
        </Link>

        {/* Desktop: center nav */}
        <div className="hidden flex-1 items-center justify-center md:flex">
          <NavBar />
        </div>

        {/* Desktop: right controls */}
        <div className="hidden items-center gap-2 md:flex">
          {onlineCount > 1 && (
            <div className="border-2 border-[var(--pixel-accent)] bg-[var(--pixel-accent)]/15 px-3 py-2">
              <span className="font-[var(--font-pixel)] text-[10px] uppercase text-[var(--pixel-accent)]">
                {onlineCount} online
              </span>
            </div>
          )}
          {simulatedExamActive && (
            <div className="flex items-center gap-2 border-2 border-red-500 bg-red-900/20 px-3 py-2">
              <span className="font-[var(--font-pixel)] text-[10px] uppercase text-red-300">
                Simulado {simTimerLabel}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 border-2 border-[var(--pixel-border)] bg-[var(--pixel-card)] px-3 py-2">
            <span className="font-[var(--font-pixel)] text-[10px] uppercase">XP {displayedXp}</span>
            <LevelBadge xp={displayedXp} />
          </div>
          <FontSizeControl />
          <ThemeToggle className="min-w-28" />
          {/* User dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((open) => !open)}
              aria-expanded={dropdownOpen}
              aria-haspopup="true"
              className="flex items-center justify-center hover:border-[var(--pixel-primary)]"
            >
              <div className="h-12 w-12 overflow-hidden border-4 border-[var(--pixel-border)] shadow-[4px_4px_0_0_var(--pixel-shadow)]">
                {avatarUrl ? (
                  <Image src={avatarUrl} alt="Avatar" width={96} height={96} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[var(--pixel-muted)] font-[var(--font-pixel)] text-2xl text-[var(--pixel-subtext)]">
                    {(user?.name ?? "?").charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </button>
            {dropdownOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 w-40 border-2 border-[var(--pixel-border)] bg-[var(--pixel-card)] shadow-[4px_4px_0_0_var(--pixel-shadow)]">
                <Link
                  href="/profile"
                  onClick={() => setDropdownOpen(false)}
                  className="block w-full px-3 py-2 font-[var(--font-pixel)] text-[10px] uppercase hover:bg-[var(--pixel-muted)]"
                >
                  Meu Perfil
                </Link>
                <button
                  onClick={handleSignOut}
                  className="block w-full px-3 py-2 text-left font-[var(--font-pixel)] text-[10px] uppercase text-red-400 hover:bg-[var(--pixel-muted)]"
                >
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile hamburger */}
        <div className="ml-auto md:hidden">
          <button
            type="button"
            aria-label="Abrir menu"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-card)] px-3 py-2 font-[var(--font-pixel)] text-[10px] uppercase"
          >
            {mobileMenuOpen ? "Fechar" : "Menu"}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 border-t border-[var(--pixel-border)] px-4 pb-4 pt-3 md:hidden xl:px-8">
          {onlineCount > 1 && (
            <div className="border-2 border-[var(--pixel-accent)] bg-[var(--pixel-accent)]/15 px-3 py-2 text-center font-[var(--font-pixel)] text-[10px] uppercase text-[var(--pixel-accent)]">
              {onlineCount} online
            </div>
          )}
          {simulatedExamActive && (
            <div className="border-2 border-red-500 bg-red-900/20 px-3 py-2 text-center font-[var(--font-pixel)] text-[10px] uppercase text-red-300">
              Simulado {simTimerLabel}
            </div>
          )}
          <div className="flex items-center gap-2 border-2 border-[var(--pixel-border)] bg-[var(--pixel-card)] px-3 py-2">
            <span className="font-[var(--font-pixel)] text-[10px] uppercase">XP {displayedXp}</span>
            <LevelBadge xp={displayedXp} />
          </div>
          <NavBar onNavClick={() => setMobileMenuOpen(false)} />
          <FontSizeControl />
          <ThemeToggle className="w-full justify-center" />
          <Link
            href="/profile"
            onClick={() => setMobileMenuOpen(false)}
            className="border-2 border-[var(--pixel-border)] bg-[var(--pixel-card)] px-3 py-2 text-center font-[var(--font-pixel)] text-[10px] uppercase hover:bg-[var(--pixel-muted)]"
          >
            Meu Perfil
          </Link>
          <button
            onClick={handleSignOut}
            className="border-2 border-red-500 bg-[var(--pixel-card)] px-3 py-2 font-[var(--font-pixel)] text-[10px] uppercase text-red-400"
          >
            Sair
          </button>
        </div>
      )}
    </header>
  );
}

export const Header = memo(HeaderComponent);
