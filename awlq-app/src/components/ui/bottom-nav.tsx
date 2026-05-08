import { Home, Trophy, History, BarChart2, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home, active: false },

  { href: "/achievements", label: "Conquistas", icon: Trophy, active: false },
  { href: "/history", label: "Histórico", icon: History, active: false },
  { href: "/leaderboard", label: "Rank", icon: BarChart2, active: false },
];

export default function BottomNav() {
  const pathname = usePathname();
  NAV_ITEMS.forEach((item) => {
    item.active = pathname === item.href;
  });
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="fixed bottom-0 px-2 left-0 right-0 z-30 md:bottom-1 md:left-1/2 md:-translate-x-1/2 md:w-full xl:w-auto pointer-events-none">
      <div
        className={`relative w-full pointer-events-auto transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-y-0" : "translate-y-full md:translate-y-[calc(100%+1.5rem)]"
        }`}
      >
        {/* Toggle Button */}
        <Tooltip>
          <TooltipTrigger>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="absolute -top-12 right-1 bg-pixel-card retro-border border-2 p-1.5 md:p-2 rounded-full text-pixel-subtext hover:text-pixel-text transition-colors retro-shadow-sm active:translate-y-0.5 active:shadow-none backdrop-blur-2xl"
              aria-label={isOpen ? "Ocultar menu" : "Mostrar menu"}
              title={isOpen ? "Ocultar menu" : "Mostrar menu"}
            >
              {isOpen ? <ChevronDown className="w-5 h-5 " /> : <ChevronUp className="w-5 h-5" />}
            </button>
          </TooltipTrigger>
          <TooltipContent>{isOpen ? "Fechar Navegação" : "Abrir Navegação"}</TooltipContent>
        </Tooltip>

        <nav className="bg-pixel-card retro-border border-b-0 border-l-0 border-r-0 rounded-none pb-safe md:rounded-2xl md:border-4 md:px-2 md:pb-0 md:retro-shadow w-full backdrop-blur-lg">
          <ul className="flex items-center justify-around px-2 py-2 md:gap-4">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.label} className="flex-1 md:flex-none">
                  <Tooltip>
                    <TooltipTrigger>
                      <Link
                        href={item.href}
                        aria-label={item.label}
                        title={item.label}
                        className={`flex flex-col items-center justify-center gap-1 p-2 md:p-3 md:px-4 rounded-xl transition-all active:scale-95 ${
                          item.active ? "text-primary" : "text-pixel-subtext hover:text-pixel-text hover:bg-pixel-muted"
                        }`}
                      >
                        <div className={`relative ${item.active ? "animate-bounce-slight" : ""}`}>
                          <Icon className={`w-6 h-6 md:w-8 md:h-8 ${item.active ? "fill-primary/20" : ""}`} />
                          {item.active && (
                            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 md:w-1.5 md:h-1.5 md:-bottom-1.5 bg-primary rounded-full" />
                          )}
                        </div>
                        <span className="hidden md:text-[0.5rem] md:block font-bold uppercase tracking-wider font-mono mt-1">
                          {item.label}
                        </span>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent>{item.label}</TooltipContent>
                  </Tooltip>
                </li>
              );
            })}
          </ul>
          <style>{`
            .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
            @keyframes bounce-slight {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-2px); }
            }
            .animate-bounce-slight { animation: bounce-slight 2s ease-in-out infinite; }
          `}</style>
        </nav>
      </div>
    </div>
  );
}
