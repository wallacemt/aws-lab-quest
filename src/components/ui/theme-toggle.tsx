"use client";

import { useTheme } from "next-themes";
import { PixelButton } from "@/components/ui/pixel-button";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle({ className = "min-w-8 min-h-8" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  if (!theme) {
    return null;
  }

  const isDark = theme === "dark";

  return (
    <PixelButton
      variant="ghost"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Alternar tema"
      className={className}
    >
      {isDark ? <Sun /> : <Moon />}
    </PixelButton>
  );
}
