import { HTMLAttributes } from "react";

export function PixelCard({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={`border-2 border-[var(--pixel-border)] bg-[var(--pixel-card)] p-4 shadow-[4px_4px_0_0_var(--pixel-shadow)] ${className}`}
    />
  );
}
