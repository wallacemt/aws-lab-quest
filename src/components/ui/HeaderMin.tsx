import { HelpCircle, Moon, Settings2, Star, User, Users } from "lucide-react";
import Image from "next/image";
import appLogo from "@/assets/logo.png";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useSimulatedExam } from "@/hooks/useSimulatedExam";
import { useRouter } from "next/navigation";
import { useOnlineUsers } from "@/hooks/useOnlineUsers";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "./ThemeToggle";

export default function HeaderMin() {
  const { theme } = useTheme();

  const { user, signOut } = useAuth();
  const { onlineCount } = useOnlineUsers();
  const { isActive: simulatedExamActive, remainingSeconds } = useSimulatedExam();
  const router = useRouter();
  const { avatarUrl, profile } = useUserProfile();
  const name = profile?.username ?? "Anônimo";

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  const simMinutes = Math.floor(Math.max(0, remainingSeconds) / 60)
    .toString()
    .padStart(2, "0");
  const simSeconds = (Math.max(0, remainingSeconds) % 60).toString().padStart(2, "0");
  const simTimerLabel = `${simMinutes}:${simSeconds}`;

  return (
    <header className=" top-0 z-40 w-full border-b-2 border-pixel-border rounded-none bg-background/90 px-4 py-3 flex items-center justify-between">
      {/* Esquerda: Logo + Nome */}
      <div className="flex items-center gap-3">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <div className={`pixel-cloud-icon ${theme === "dark" ? "bg-primary" : ""}`} aria-hidden="true">
            <Image src={appLogo} alt="AWS Lab Quest logo" height={260} width={260} />
          </div>
          <div className="hidden min-w-0 sm:block">
            <h1 className="font-mono text-lg md:text-xl font-bold tracking-wider text-primary hidden sm:block mt-1">
              AWS QUEST
            </h1>
          </div>
        </Link>
      </div>
      {simulatedExamActive && (
        <div className="flex items-center gap-2 border-2 border-red-500 bg-red-900/20 px-3 py-2">
          <span className="font-[var(--font-pixel)] text-[10px] uppercase text-red-300">Simulado {simTimerLabel}</span>
        </div>
      )}
      {!simulatedExamActive && (
        <div className="flex items-center gap-2 md:gap-4">
          {/* Online Users */}
          {onlineCount > 1 && (
            <div className="hidden md:flex items-center gap-2 bg-pixel-card retro-border border-2 px-3 py-1 rounded-lg retro-shadow-sm">
              <div className="relative flex h-3 w-3 items-center justify-center">
                <span className="absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-95"></span>
              </div>
              <span className="font-mono font-bold text-pixel-text text-sm mt-0.5">{onlineCount}</span>
            </div>
          )}

          {/* XP Badge */}
          <div className="flex items-center gap-1.5 bg-pixel-card retro-border border-2 px-2 md:px-3 py-1 rounded-lg retro-shadow-sm">
            <Star className="w-4 h-4 text-primary fill-primary" />
            <span className="font-mono font-bold text-pixel-text text-[0.6rem] md:text-xs mt-0.5">
              <span className="hidden md:inline">XP: </span>
              {profile.totalXp}
            </span>
          </div>

          {/* Icons de utilidades*/}
          <div className="flex items-center gap-1 md:gap-2">
            <button className="p-2 text-pixel-subtext hover:text-pixel-text transition-colors rounded-lg hover:bg-pixel-muted active:scale-95">
              <HelpCircle className="w-5 h-5 md:w-6 md:h-6" />
            </button>
            <button className="p-2 text-pixel-subtext hover:text-pixel-text transition-colors rounded-lg hover:bg-pixel-muted active:scale-95 hidden sm:block">
              <Settings2 className="w-5 h-5 md:w-6 md:h-6" />
            </button>
            <ThemeToggle />

            {/* Avatar */}
            <button className="ml-1 w-9 h-9 md:w-10 md:h-10 retro-border border-2 rounded-full bg-accent flex items-center justify-center retro-shadow-sm active:translate-y-0.5 active:shadow-none transition-all">
              <User className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
