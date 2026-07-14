"use client";

import { ButtonHTMLAttributes } from "react";

export type PixelButtonVariant = "primary" | "secondary" | "ghost" | "destructive" | "warning" | "info" | "default";

type PixelButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: PixelButtonVariant;
};

const variantClassMap: Record<PixelButtonVariant, string> = {
  primary:
    "bg-[var(--pixel-primary)] text-black border-black shadow-[4px_4px_0_0_#000] hover:translate-y-[-1px] active:translate-y-[2px]",
  secondary:
    "bg-[var(--pixel-accent)] text-black border-black shadow-[4px_4px_0_0_#000] hover:translate-y-[-1px] active:translate-y-[2px]",
  ghost:
    "bg-transparent text-[var(--pixel-text)] border-[var(--pixel-border)] shadow-[4px_4px_0_0_var(--pixel-border)] hover:bg-[var(--pixel-muted)] active:translate-y-[2px]",
  destructive:
    "bg-red-500 text-white border-black shadow-[4px_4px_0_0_#000] hover:translate-y-[-1px] active:translate-y-[2px]",
  warning:
    "bg-amber-500 text-black border-black shadow-[4px_4px_0_0_#000] hover:translate-y-[-1px] active:translate-y-[2px]",
  info:
    "bg-blue-500 text-white border-black shadow-[4px_4px_0_0_#000] hover:translate-y-[-1px] active:translate-y-[2px]",
  default:
    "bg-pixel-card text-pixel-text/90 border-black shadow-[4px_4px_0_0_#000] hover:translate-y-[-1px] active:translate-y-[2px]",
};

export function PixelButton({ className = "", variant = "primary", ...props }: PixelButtonProps) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 border-2 px-4 py-2 font-mono text-xs uppercase tracking-wide transition-all disabled:cursor-not-allowed disabled:opacity-50 ${variantClassMap[variant]} ${className}`}
    />
  );
}
