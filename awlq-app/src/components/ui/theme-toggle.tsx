"use client";

import { useTheme } from "next-themes";
import { PixelButton } from "@/components/ui/pixel-button";
import {  Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle({
  className = "min-w-8 min-h-8",
}: {
  className?: string;
  showTooltip?: boolean;
}) {
  const { theme, setTheme } = useTheme();
  if (!theme) {
    return null;
  }

  const isDark = theme === "dark";
  const nextModeLabel = isDark ? "Ativar modo claro" : "Ativar modo escuro";

  return (
    <Tooltip>
      <TooltipTrigger className="w-full">
        <PixelButton
          variant="ghost"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          aria-label="Alternar tema"
          title={nextModeLabel}
          className={className}
        >
          {isDark ? <Sun /> : <Moon />}
        </PixelButton>
      </TooltipTrigger>
      <TooltipContent>Trocar de Tema</TooltipContent>
    </Tooltip>
  );
}
