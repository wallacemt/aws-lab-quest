import { HelpCircle, Settings2, Star } from "lucide-react";
import Image from "next/image";

import { useTheme } from "next-themes";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useSimulatedExam } from "@/hooks/useSimulatedExam";
import { useRouter } from "next/navigation";
import { useOnlineUsers } from "@/hooks/useOnlineUsers";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "../ui/theme-toggle";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FontSizeControl } from "../ui/font-size-control";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

export const Header = () => {
  const { theme } = useTheme();

  const { user, signOut } = useAuth();
  const { onlineCount } = useOnlineUsers();
  const { isActive: simulatedExamActive, remainingSeconds } = useSimulatedExam();
  const router = useRouter();
  const { avatarUrl, profile } = useUserProfile();
  const xpTarget = profile.totalXp ?? 0;
  const [displayXp, setDisplayXp] = useState(xpTarget);
  const displayXpRef = useRef(xpTarget);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      displayXpRef.current = xpTarget;
      return;
    }

    const from = displayXpRef.current;
    const to = xpTarget;

    if (from === to) {
      return;
    }

    const startedAt = performance.now();
    const delta = to - from;
    const duration = Math.max(250, Math.min(900, Math.abs(delta) * 24));
    let frameId = 0;

    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextValue = Math.round(from + delta * eased);

      displayXpRef.current = nextValue;
      setDisplayXp(nextValue);

      if (progress < 1) {
        frameId = window.requestAnimationFrame(animate);
      }
    };

    frameId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frameId);
  }, [xpTarget]);

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
            <Image src={"/logo.png"} alt="AWS Quest logo" height={260} width={260} />
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
          <span className="font-mono text-[10px] uppercase text-red-300">Simulado {simTimerLabel}</span>
        </div>
      )}

      <div className="flex items-center gap-2 md:gap-4">
        {/* Online Users */}
        {!simulatedExamActive && onlineCount > 1 && (
          <>
            <Tooltip>
              <TooltipTrigger>
                <div className="hidden md:flex items-center gap-2 bg-pixel-card retro-border border-2 px-3 py-1 rounded-lg retro-shadow-sm">
                  <div className="relative flex h-3 w-3 items-center justify-center animate-pulse">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-95"></span>
                  </div>
                  <span className="font-mono font-bold text-pixel-text text-[0.6rem] mt-0.5">{onlineCount}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Usuarios Online</TooltipContent>
            </Tooltip>
            {/* XP Badge */}
            <Tooltip>
              <TooltipTrigger>
                <div className="flex items-center gap-1.5 bg-pixel-card retro-border border-2 px-2 md:px-2 py-1 rounded-lg retro-shadow-sm">
                  <Star className="w-4 h-4 text-primary fill-primary" />
                  <span className="font-mono font-bold text-pixel-text text-[0.6rem]  ">{displayXp}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>XP Acumulado</TooltipContent>
            </Tooltip>
          </>
        )}

        {/* Icons de utilidades*/}
        <div className="flex items-center gap-1 md:gap-2">
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger>
                <DropdownMenuTrigger
                  asChild
                  className="border-none p-2 text-pixel-subtext hover:text-pixel-text transition-colors rounded-lg hover:bg-pixel-muted active:scale-95  "
                >
                  <Button
                    className="bg-transparent cursor-pointer hover:bg-transparent"
                    size={"icon"}
                    aria-label="Configuracoes"
                    title="Configuracoes"
                  >
                    <span className="sr-only">Configuracoes</span>
                    <Settings2 className="size-5" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Preferencias</TooltipContent>
            </Tooltip>
            <DropdownMenuContent
              align="end"
              className="w-45 flex flex-col items-center justify-center bg-pixel-card retro-border border-2 rounded-lg"
            >
              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  <ThemeToggle className="w-full" />
                </DropdownMenuLabel>
                <DropdownMenuItem>
                  <FontSizeControl />
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator className="text-white border-2 w-full" />
              <DropdownMenuGroup>
                <DropdownMenuItem>
                  <Tooltip>
                    <TooltipTrigger>
                      <Link
                        href={"/help"}
                        className=" w-full px-3 py-2 font-mono text-[0.6rem] uppercase hover:bg-muted p-2 bg-transparent transition-colors rounded-lg hover:bg-pixel-muted active:scale-95 flex items-center justify-center"
                      >
                        <p>Ajuda</p>
                        <HelpCircle className="w-5 h-5 md:w-6 md:h-6" />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent>Area de Ajuda</TooltipContent>
                  </Tooltip>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Avatar */}
          {!simulatedExamActive && (
            <>
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger>
                    <DropdownMenuTrigger
                      asChild
                      className="flex items-center justify-center hover:border-[var(--pixel-primary)]"
                    >
                      <div
                        className="h-12 w-12 overflow-hidden border-4 border-[var(--pixel-border)] shadow-[4px_4px_0_0_var(--pixel-shadow)]"
                        aria-label="Menu do usuario"
                        title="Menu do usuario"
                      >
                        {avatarUrl ? (
                          <Image
                            src={avatarUrl}
                            alt="Avatar"
                            width={96}
                            height={96}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-[var(--pixel-muted)] font-mono text-2xl text-[var(--pixel-subtext)]">
                            {(user?.name ?? "?").charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>{user?.name ?? "Você"}</TooltipContent>
                </Tooltip>
                <DropdownMenuContent
                  align="end"
                  className="w-45 flex flex-col items-center justify-center bg-pixel-card retro-border border-2 rounded-lg"
                >
                  <DropdownMenuGroup>
                    <DropdownMenuItem>
                      <Link
                        href="/profile"
                        className="block w-full px-3 py-2 font-mono text-[0.6rem] uppercase hover:bg-muted"
                      >
                        Meu Perfil
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleSignOut}>
                      <div className="block w-full px-3 py-2 text-left font-mono text-[0.6rem] uppercase text-red-500 hover:bg-muted">
                        Sair
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
