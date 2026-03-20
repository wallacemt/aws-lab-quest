import { ElementType } from "react";
import { FlaskConical, CheckSquare, Timer, BookOpen, Play } from "lucide-react";

interface GameCardProps {
  key?: string | number;
  id: string;
  title: string;
  description: string;
  cta: string;
  handleClick: () => void;
}

const ICONS: Record<string, ElementType> = {
  lab: FlaskConical,
  kc: CheckSquare,
  simulado: Timer,
  revisao: BookOpen,
};

const COLORS: Record<string, string> = {
  lab: "bg-blue-500",
  kc: "bg-accent",
  simulado: "bg-primary",
  revisao: "bg-purple-500",
};

export default function GameCard({ id, title, description, cta, handleClick }: GameCardProps) {
  const Icon = ICONS[id] || Play;
  const colorClass = COLORS[id] || "bg-pixel-border";

  return (
    <button className="group text-left w-full bg-pixel-card retro-border retro-shadow retro-btn flex flex-col h-full relative overflow-hidden focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/50">
      {/* Top "Cartridge" Ridge */}
      <div className="absolute top-0 left-4 right-4 h-2 bg-pixel-muted rounded-b-md border-x-2 border-b-2 border-pixel-border opacity-50" />

      <div className="p-5 md:p-6 flex-1 flex flex-col mt-2">
        <div className="flex items-start justify-between mb-4">
          <div
            className={`w-14 h-14 rounded-xl retro-border border-2 flex items-center justify-center retro-shadow-sm ${colorClass}`}
          >
            <Icon className="w-7 h-7 text-white" />
          </div>

          {/* Decorative dots */}
          <div className="flex gap-1">
            <div className="w-2 h-2 rounded-full bg-pixel-border/20" />
            <div className="w-2 h-2 rounded-full bg-pixel-border/20" />
          </div>
        </div>

        <h3 className="font-mono text-2xl font-bold text-pixel-text mb-2 uppercase tracking-wide">{title}</h3>

        <p className="text-pixel-subtext text-sm md:text-base flex-1 mb-6 leading-relaxed">{description}</p>

        <div
          className="mt-auto cursor-pointer flex items-center justify-between pt-4 border-t-2 border-pixel-border/10"
          onClick={handleClick}
        >
          <span className="font-mono font-bold text-primary group-hover:text-pixel-text transition-colors uppercase tracking-widest text-sm md:text-base">
            {cta}
          </span>
          <div className="w-8 h-8 rounded-full bg-pixel-muted flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
            <Play className="w-4 h-4 ml-0.5 fill-current" />
          </div>
        </div>
      </div>
    </button>
  );
}
