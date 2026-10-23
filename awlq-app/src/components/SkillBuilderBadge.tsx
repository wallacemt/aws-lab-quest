"use client";
import { BadgeCheck } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function SkillBuilderBadge() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 border border-amber-500 bg-slate-950 px-2 py-1 text-xs text-amber-300"
            aria-label="Origem AWS Skill Builder conferida pela equipe"
          >
            <svg viewBox="0 0 40 28" width="32" height="24" aria-hidden="true">
              <text x="2" y="17" fontSize="18" fontFamily="Arial, sans-serif" fill="currentColor">
                aws
              </text>
              <path d="M3 21 Q20 31 36 20 M30 20 L36 20 L35 25" fill="none" stroke="currentColor" strokeWidth="1.8" />
            </svg>
            <span className="hidden lg:flex items-center gap-2">
              <BadgeCheck size={14} aria-hidden="true" /> Skill Builder
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent>
          Extraído do AWS Skill Builder. Origem conferida pela equipe da plataforma; não implica verificação ou endosso
          pela AWS.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
