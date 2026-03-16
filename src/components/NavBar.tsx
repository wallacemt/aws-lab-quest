"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSimulatedExam } from "@/hooks/useSimulatedExam";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/kc", label: "KC" },
  { href: "/simulado", label: "Simulado" },
  { href: "/history", label: "Histórico" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/help", label: "Ajuda" },
];

export function NavBar({ onNavClick }: { onNavClick?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isActive: simulatedExamActive } = useSimulatedExam();

  return (
    <nav className="flex items-center">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={(event) => {
              if (simulatedExamActive && item.href !== "/simulado") {
                event.preventDefault();
                router.replace("/simulado");
              }
              onNavClick?.();
            }}
            className={[
              "border-b-2 px-3 py-2 font-[var(--font-pixel)] text-[10px] uppercase tracking-wider transition-colors",
              isActive
                ? "border-[var(--pixel-primary)] text-[var(--pixel-primary)]"
                : "border-transparent text-[var(--pixel-text)] hover:text-[var(--pixel-primary)] hover:border-[var(--pixel-border)]",
            ].join(" ")}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
